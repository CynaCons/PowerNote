#!/usr/bin/env node
/**
 * powernote-notes — MCP server for writing notes into a running PowerNote.
 *
 * Topology: this process hosts a WebSocket on loopback; the PowerNote app dials
 * out to it (a browser page cannot listen on a port, and PowerNote ships as a
 * single static HTML file). Tool calls are forwarded to the connected app,
 * which applies them to its live stores; its normal auto-save then persists
 * them to the notebook file.
 *
 * MULTIPLE AGENTS (v0.36). One MCP server process is spawned per agent session,
 * so several of them race for the same port. The winner becomes the HUB and owns
 * the single app connection; the losers become PEERS and forward their tool
 * calls to the hub over the same loopback port. This keeps exactly one socket to
 * the notebook, which means the app needs no changes and there is one obvious
 * place for the lock.
 *
 * Agents may connect freely but may not operate concurrently: the hub hands out
 * a lease, held for the duration of a command and for a short idle grace after
 * it. A blocked agent is told who holds the lock and when to retry. Read-only
 * tools bypass the lease, because looking while someone writes is harmless and
 * refusing it would make a blocked agent unable to find out anything.
 *
 * IMPORTANT: stdout is the MCP transport. All logging goes to stderr.
 */

import { randomUUID } from 'node:crypto';
import { WebSocketServer, WebSocket } from 'ws';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

const PROTOCOL_VERSION = 1;
const PORT = Number(process.env.POWERNOTE_BRIDGE_PORT || 41777);
const HOST = '127.0.0.1';
const REQUEST_TIMEOUT_MS = Number(process.env.POWERNOTE_BRIDGE_TIMEOUT_MS || 10_000);

const log = (...args) => console.error('[powernote-notes]', ...args);

/** This process's agent identity. Stable for its lifetime. */
const AGENT_ID = randomUUID().slice(0, 8);
const AGENT_LABEL = process.env.POWERNOTE_AGENT_NAME || `agent-${AGENT_ID}`;

/**
 * Tools that only look. They bypass the lease: a blocked agent must still be
 * able to read, and above all to call `bridge_status` to find out why it is
 * blocked.
 */
const READ_ONLY = new Set([
  'list_pages',
  'read_page',
  'list_scrolls',
  'get_background',
  'check_update',
  'bridge_status',
]);

/** Idle grace between one agent's commands before another may take over. */
const LOCK_IDLE_MS = Number(process.env.POWERNOTE_LOCK_IDLE_MS || 10_000);
/** A holder that keeps working still yields after this, if anyone is waiting. */
const LOCK_MAX_HOLD_MS = Number(process.env.POWERNOTE_LOCK_MAX_HOLD_MS || 120_000);

// ── App connection ──────────────────────────────────────────

/** The currently connected PowerNote tab, if any. Latest connection wins. */
let app = null;
/** Metadata from the app's hello frame. */
let appInfo = null;
/** id → { resolve, reject, timer } for in-flight requests. */
const pending = new Map();

/** 'hub' once we own the port, 'peer' once we are talking to whoever does. */
let mode = 'starting';
/** Peer mode: our socket to the hub. */
let hub = null;
/** Hub mode: peer socket -> { agentId, label }. */
const peers = new Map();
/** Set when startup failed for a reason the user has to fix. */
let startupError = null;
/** Hub mode: the listening server, so shutdown can close it. */
let wss = null;

/**
 * The lease. `inFlight` is what stops it expiring underneath a slow command:
 * run_update downloads a couple of megabytes without issuing anything, and an
 * idle-only timer would hand the notebook to someone else mid-download.
 */
let lock = { holder: null, label: null, inFlight: 0, idleUntil: 0, since: 0 };
/** agentIds waiting, oldest first. Decides when a long holder must yield. */
const waiting = [];

function releaseLock(why) {
  if (!lock.holder) return;
  log('Lock released by ' + lock.label + ' (' + why + ').');
  lock = { holder: null, label: null, inFlight: 0, idleUntil: 0, since: 0 };
}

/**
 * Expiry is evaluated on use rather than on a timer: a timer that fires while
 * nothing is happening tells us nothing, and one that fires mid-command would
 * be wrong anyway.
 */
function currentHolder(now) {
  now = now || Date.now();
  if (lock.holder && lock.inFlight === 0 && now > lock.idleUntil) releaseLock('idle');
  return lock.holder;
}

function lockStatus(now) {
  now = now || Date.now();
  const holder = currentHolder(now);
  return {
    held: !!holder,
    holderId: holder,
    holder: holder ? lock.label : null,
    retryAfterMs: holder ? Math.max(0, lock.idleUntil - now) : 0,
    heldForMs: holder ? now - lock.since : 0,
    waiting: waiting.length,
  };
}

class Locked extends Error {}

/**
 * Grants the lease, or explains who has it. A holder past LOCK_MAX_HOLD_MS
 * yields at its next command boundary, but only when someone is actually
 * waiting -- otherwise a long solo task would interrupt itself for nothing.
 */
function acquireLock(agentId, label) {
  const now = Date.now();
  const holder = currentHolder(now);

  if (holder && holder !== agentId) {
    if (waiting.indexOf(agentId) < 0) waiting.push(agentId);
    const st = lockStatus(now);
    throw new Locked(
      'Another agent is operating this notebook. "' + st.holder + '" holds it and has ' +
      'been working for ' + Math.round(st.heldForMs / 1000) + 's; it frees up after about ' +
      Math.ceil(st.retryAfterMs / 1000) + 's of inactivity. Do other work and retry, or call ' +
      'bridge_status to check. You are queued at position ' + (waiting.indexOf(agentId) + 1) + '.',
    );
  }

  if (holder === agentId && now - lock.since > LOCK_MAX_HOLD_MS && waiting.length > 0) {
    const n = waiting.length;
    releaseLock('max hold reached with agents waiting');
    throw new Locked(
      'You have held this notebook for over ' + Math.round(LOCK_MAX_HOLD_MS / 1000) + 's and ' +
      n + ' agent(s) are waiting, so the lock was handed on. Retry to queue for it again.',
    );
  }

  const idx = waiting.indexOf(agentId);
  if (idx >= 0) waiting.splice(idx, 1);

  if (!holder) {
    lock = { holder: agentId, label: label, inFlight: 0, idleUntil: now + LOCK_IDLE_MS, since: now };
    log('Lock acquired by ' + label + '.');
  }
  lock.inFlight += 1;
  return function release() {
    lock.inFlight = Math.max(0, lock.inFlight - 1);
    lock.idleUntil = Date.now() + LOCK_IDLE_MS;
  };
}

/** Fail every in-flight request now, rather than letting each one time out. */
function rejectPending(message) {
  for (const [id, entry] of pending) {
    clearTimeout(entry.timer);
    pending.delete(id);
    entry.reject(new BridgeUnavailable(message));
  }
}

// -- Hub mode: own the port, own the app, own the lock -------

function startHub() {
  return new Promise((resolve, reject) => {
    const candidate = new WebSocketServer({ host: HOST, port: PORT });
    candidate.on('listening', () => {
      wss = candidate;
      log('Hub: listening on ws://' + HOST + ':' + PORT + ' as "' + AGENT_LABEL + '".');
      resolve(candidate);
    });
    candidate.on('error', (err) => reject(err));
    candidate.on('connection', (socket) => onHubConnection(socket));
  });
}

function onHubConnection(socket) {
  let kind = null;

  socket.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch (e) {
      return;
    }

    // A peer announces itself before anything else; the app sends 'hello'.
    if (msg.type === 'peer-hello') {
      kind = 'peer';
      peers.set(socket, { agentId: msg.agentId, label: msg.label });
      log('Peer agent "' + msg.label + '" connected. ' + peers.size + ' peer(s).');
      socket.send(JSON.stringify({ v: PROTOCOL_VERSION, type: 'peer-welcome', hub: AGENT_LABEL }));
      return;
    }

    if (msg.type === 'hello') {
      kind = 'app';
      adoptApp(socket, msg);
      return;
    }

    if (kind === 'peer' && msg.type === 'peer-request') {
      handlePeerRequest(socket, msg);
      return;
    }

    // Otherwise it is the app answering one of our requests.
    const entry = pending.get(msg.id);
    if (!entry) return;
    clearTimeout(entry.timer);
    pending.delete(msg.id);
    entry.resolve(msg);
  });

  socket.on('close', () => {
    if (kind === 'peer') {
      const info = peers.get(socket);
      peers.delete(socket);
      if (info) {
        // A peer that goes away must not keep the notebook locked.
        if (lock.holder === info.agentId) releaseLock('peer disconnected');
        const w = waiting.indexOf(info.agentId);
        if (w >= 0) waiting.splice(w, 1);
      }
      log('Peer agent disconnected. ' + peers.size + ' peer(s).');
      return;
    }
    if (app === socket) {
      app = null;
      appInfo = null;
      // The notebook going away invalidates any lease over it.
      releaseLock('notebook disconnected');
      log('Notebook disconnected.');
    }
  });

  socket.on('error', (err) => log('Socket error:', (err && err.message) || err));
}

function adoptApp(socket, msg) {
  const previous = app;
  // Newest connection wins: a stale or zombie socket must never lock out a
  // notebook the user is actually looking at.
  app = socket;
  appInfo = { appVersion: msg.appVersion, notebook: msg.notebook };
  log('Hello from PowerNote v' + msg.appVersion + ' -- notebook "' + msg.notebook + '"');

  if (previous && previous !== socket && previous.readyState === previous.OPEN) {
    log('A second notebook connected; displacing the previous one.');
    // Tell the old client to stand down BEFORE closing it. Without this it
    // reconnects on backoff, displaces this new client in turn, and the two
    // trade the slot forever -- commands then land in whichever notebook
    // happens to hold it, which is how writes ended up in the wrong file.
    try {
      previous.send(
        JSON.stringify({
          v: PROTOCOL_VERSION,
          type: 'displaced',
          reason: 'Another notebook connected to the agent bridge.',
        }),
      );
    } catch (err) {
      log('Could not notify displaced notebook:', (err && err.message) || err);
    }
    previous.close();
    releaseLock('notebook displaced');
    rejectPending(
      'The notebook this request was sent to was displaced by another connection. Retry.',
    );
  }
}

async function handlePeerRequest(socket, msg) {
  const reply = (body) =>
    socket.send(
      JSON.stringify(Object.assign(
        { v: PROTOCOL_VERSION, type: 'peer-response', reqId: msg.reqId },
        body,
      )),
    );
  try {
    const result = await runToolAsAgent(msg.cmd, msg.params, msg.agentId, msg.label);
    reply({ ok: true, result: result });
  } catch (err) {
    reply({
      ok: false,
      error: { code: err instanceof Locked ? 'LOCKED' : 'ERROR', message: err.message },
    });
  }
}

// -- Peer mode: forward everything to the hub ----------------

function connectToHub() {
  const socket = new WebSocket('ws://' + HOST + ':' + PORT);
  socket.on('open', () => {
    hub = socket;
    socket.send(
      JSON.stringify({
        v: PROTOCOL_VERSION,
        type: 'peer-hello',
        agentId: AGENT_ID,
        label: AGENT_LABEL,
      }),
    );
    log('Peer: joined the hub on ws://' + HOST + ':' + PORT + ' as "' + AGENT_LABEL + '".');
  });
  socket.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch (e) {
      return;
    }
    if (msg.type !== 'peer-response') return;
    const entry = pending.get(msg.reqId);
    if (!entry) return;
    clearTimeout(entry.timer);
    pending.delete(msg.reqId);
    entry.resolve(msg);
  });
  socket.on('close', () => {
    hub = null;
    rejectPending('The agent hub went away. Retrying.');
    // The hub process exited, so the port is free again. Whoever gets there
    // first becomes the new hub; everyone else re-joins it. The jitter stops
    // every survivor retrying in lockstep.
    log('Hub connection lost -- re-racing for the port.');
    setTimeout(() => { void start(); }, 250 + Math.floor(Math.random() * 500));
  });
  socket.on('error', () => {
    // The close handler drives the retry; the error carries nothing useful.
  });
}

/** Peer side of a tool call: ask the hub to run it on our behalf. */
function askHub(cmd, params) {
  return new Promise((resolve, reject) => {
    if (!hub || hub.readyState !== hub.OPEN) {
      reject(new BridgeUnavailable('Not connected to the agent hub yet. Retry in a moment.'));
      return;
    }
    const reqId = randomUUID();
    const budget = timeoutFor(cmd);
    const timer = setTimeout(() => {
      pending.delete(reqId);
      reject(new Error('The agent hub did not answer "' + cmd + '" within ' + budget + 'ms'));
    }, budget);
    pending.set(reqId, { resolve: resolve, reject: reject, timer: timer });
    hub.send(
      JSON.stringify({
        v: PROTOCOL_VERSION,
        type: 'peer-request',
        reqId: reqId,
        agentId: AGENT_ID,
        label: AGENT_LABEL,
        cmd: cmd,
        params: params,
      }),
    );
  });
}

async function start() {
  try {
    await startHub();
    mode = 'hub';
    startupError = null;
  } catch (err) {
    if (err && err.code === 'EADDRINUSE') {
      mode = 'peer';
      connectToHub();
      return;
    }
    startupError =
      'Could not start the agent bridge on ' + HOST + ':' + PORT + ': ' +
      ((err && err.message) || err) + '. Set POWERNOTE_BRIDGE_PORT to a free port.';
    log(startupError);
  }
}

class BridgeUnavailable extends Error {}

/**
 * Commands that reach the network need more than the default budget: the
 * update path downloads a ~2.4MB single-file build from GitHub before it can
 * answer, which routinely outlasts 10s on a slow link.
 */
const SLOW_COMMAND_TIMEOUT_MS = Number(
  process.env.POWERNOTE_BRIDGE_SLOW_TIMEOUT_MS || 120_000,
);
const SLOW_COMMANDS = new Set(['check_update', 'run_update', 'save_notebook']);

function timeoutFor(cmd) {
  return SLOW_COMMANDS.has(cmd) ? SLOW_COMMAND_TIMEOUT_MS : REQUEST_TIMEOUT_MS;
}

function callApp(cmd, params) {
  return new Promise((resolve, reject) => {
    if (!app || app.readyState !== app.OPEN) {
      reject(
        new BridgeUnavailable(
          'No PowerNote notebook is connected. Open your notebook, then turn on ' +
          'Settings → Agent bridge → "Let a local agent write into this notebook".',
        ),
      );
      return;
    }

    const id = randomUUID();
    const budget = timeoutFor(cmd);
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`Notebook did not respond to "${cmd}" within ${budget}ms`));
    }, budget);

    pending.set(id, { resolve, reject, timer });
    app.send(JSON.stringify({ v: PROTOCOL_VERSION, id, cmd, params }));
  });
}

// ── MCP tools ───────────────────────────────────────────────

const TOOLS = [
  {
    name: 'list_pages',
    description:
      'List every section and page in the connected notebook, with the number of ' +
      'text blocks on each and which page is currently open. Call this first to ' +
      'discover page ids.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'read_page',
    description:
      'Read a page back as ordered markdown blocks. Use this before editing so you ' +
      'know the current contents and each block id.',
    inputSchema: {
      type: 'object',
      properties: {
        pageId: {
          type: 'string',
          description: 'Page to read. Defaults to the page currently open in the app.',
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'create_section',
    description:
      'Create a new section (a tab in the notebook sidebar). Sections contain pages. ' +
      'A first empty page is created along with it.',
    inputSchema: {
      type: 'object',
      properties: { title: { type: 'string', description: 'Section title.' } },
      required: ['title'],
      additionalProperties: false,
    },
  },
  {
    name: 'create_page',
    description:
      'Create a new page and open it. By default also writes the title onto the ' +
      'canvas as an H1 block so the page reads as a titled note.',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Page title.' },
        sectionId: {
          type: 'string',
          description: 'Section to create the page in. Defaults to the active section.',
        },
        withHeading: {
          type: 'boolean',
          description: 'Write an "# Title" block onto the canvas too. Default true.',
        },
        column: {
          type: 'integer',
          minimum: 0,
          description:
            'A4 page guide to place the heading in: 0 is the leftmost (default).',
        },
      },
      required: ['title'],
      additionalProperties: false,
    },
  },
  {
    name: 'append_block',
    description:
      'Append a markdown block to the bottom of a page. This is the main way to ' +
      'write content. The markdown is rendered live in the app: use "- " for ' +
      'bullets, "1. " for numbered lists, "- [ ] " for checkboxes (which the user ' +
      'can then click to tick), "#"/"##" for headings, **bold**, `code`, tables, ' +
      'and $math$. Prefer one block per logical chunk (one list, one paragraph) ' +
      'rather than one block per line.',
    inputSchema: {
      type: 'object',
      properties: {
        markdown: { type: 'string', description: 'Markdown content for the block.' },
        pageId: {
          type: 'string',
          description: 'Page to append to. Defaults to the page currently open.',
        },
        scrollId: {
          type: 'string',
          description:
            'Scroll (named column) to write into. THIS IS THE PREFERRED WAY to choose ' +
            'where a block lands — call list_scrolls first and pass an id from it. ' +
            'Each scroll stacks independently, so two workstreams can fill different ' +
            'scrolls on one page without ever interleaving. Defaults to the leftmost.',
        },
        column: {
          type: 'integer',
          minimum: 0,
          description:
            'Raw A4 page-guide index: 0 is the leftmost, 1 the guide to its right. ' +
            'Legacy fallback — prefer scrollId, which keeps pointing at the same ' +
            'scroll after scrolls are reordered. Ignored when scrollId is given.',
        },
      },
      required: ['markdown'],
      additionalProperties: false,
    },
  },
  {
    name: 'create_diagram_plantuml',
    description:
      'Draw a UML diagram on the page from PLANTUML source. (For Mermaid source, use ' +
      'create_diagram_mermaid instead - this tool refuses it rather than half-drawing it.) ' +
      'Two PlantUML dialects are supported, and the right one is detected automatically. ' +
      '(1) COMPONENT / COMPOSITE STRUCTURE: components, nested components, ports ' +
      '(port / portin / portout), provided and required interfaces, and assembly and ' +
      'delegation connectors. A composite-structure part puts its role in the label, as ' +
      'component "role : Type [multiplicity]" as alias. Nesting uses braces. ' +
      '(2) ACTIVITY / SWIMLANE FLOWCHARTS: |Lane| switches the swimlane, start and stop ' +
      'are the pseudostates, :action; is a step, and if (cond) then (label) / else ' +
      '(label) / endif adds a decision with guards on the arrows. Steps run top to bottom ' +
      'in source order and the lane fixes the column. ' +
      'What lands on the canvas is ordinary PowerNote shapes and text inside a diagram ' +
      'frame, so the user can drag any part of it afterwards - this is NOT an image. ' +
      'Supply semantics only: name the steps or entities and what connects to what. Every ' +
      'coordinate is computed here from real text metrics, and there is no way to position ' +
      'anything yourself. Do NOT include skinparam, !include, !theme or any styling - ' +
      'PowerNote supplies the style and those lines come back as skipped diagnostics. ' +
      'fork, split, while and repeat are refused rather than drawn wrong, and activity ' +
      'branches currently render in source order rather than as parallel paths that rejoin. ' +
      'The response carries the diagnostics, so one call is enough to know whether it came out right.',
    inputSchema: {
      type: 'object',
      properties: {
        source: {
          type: 'string',
          description:
            'PlantUML text; @startuml/@enduml optional, one statement per line. ' +
            'Component example: component "gateway" as gw { portin telemetry ... }. ' +
            'Swimlane example: |Sensor| then start then :sample burst; then |Gateway| ' +
            'then :buffer to flash; then stop.',
        },
        title: {
          type: 'string',
          description: 'Title shown on the diagram frame. Defaults to "Diagram".',
        },
        pageId: {
          type: 'string',
          description: 'Page to draw on. Defaults to the page currently open.',
        },
        scrollId: {
          type: 'string',
          description:
            'Scroll (named column) to draw into - call list_scrolls first. The diagram ' +
            'lands below whatever is already in that column, like append_block. Defaults to the leftmost.',
        },
        column: {
          type: 'integer',
          minimum: 0,
          description: 'Raw A4 page-guide index. Legacy fallback - prefer scrollId. Ignored when scrollId is given.',
        },
      },
      required: ['source'],
      additionalProperties: false,
    },
  },
  {
    name: 'create_diagram_mermaid',
    description:
      'Draw a diagram on the page from MERMAID source. (For PlantUML source, use ' +
      'create_diagram_plantuml instead.) A DOCUMENTED SUBSET is read, and anything ' +
      'outside it comes back as a diagnostic instead of being drawn wrong. ' +
      '(1) FLOWCHART: "flowchart TD" / "flowchart LR" / "graph LR" as the first line, then ' +
      'nodes A[Label], A(Label) and A{Label}, and edges A --> B, A -->|guard| B and ' +
      'A --- B. Chains such as A --> B --> C work. ' +
      '(2) SEQUENCE: "sequenceDiagram" as the first line, then participant X (optionally ' +
      '"participant X as Label") and messages A->>B: text and A-->>B: reply. ' +
      'TWO THINGS TO EXPECT. Node SHAPE is carried as a stereotype above the name, not as ' +
      'geometry: a {decision} renders as a box labelled "decision" rather than as a diamond, ' +
      'because the shared layout has one box shape. LAYOUT is left to right whatever direction ' +
      'the header names, and a sequence renders as participants side by side with numbered ' +
      'messages between them, not as lifelines running down the page. ' +
      'NOT SUPPORTED, and refused with a diagnostic: subgraphs, dotted (-.->), thick (==>) ' +
      'and circle/cross (--o, --x) links, compound node shapes such as A[[Sub]] or ' +
      'A((Circle)), loop/alt/opt/par/note blocks, and the class, state, ER and Gantt families. ' +
      'What lands on the canvas is ordinary PowerNote shapes and text inside a diagram frame, ' +
      'so the user can drag any part of it afterwards - this is NOT an image. Supply semantics ' +
      'only; every coordinate is computed here from real text metrics. The response carries ' +
      'the diagnostics, so one call is enough to know whether it came out right.',
    inputSchema: {
      type: 'object',
      properties: {
        source: {
          type: 'string',
          description:
            'Mermaid text. The FIRST line must be flowchart/graph with a direction, or ' +
            'sequenceDiagram. Example: "flowchart LR" then A[Read sensor] --> B{Uplink up?} ' +
            'then B -->|yes| C[Send batch].',
        },
        title: {
          type: 'string',
          description: 'Title shown on the diagram frame. Defaults to "Diagram".',
        },
        pageId: {
          type: 'string',
          description: 'Page to draw on. Defaults to the page currently open.',
        },
        scrollId: {
          type: 'string',
          description:
            'Scroll (named column) to draw into - call list_scrolls first. The diagram ' +
            'lands below whatever is already in that column, like append_block. Defaults to the leftmost.',
        },
        column: {
          type: 'integer',
          minimum: 0,
          description: 'Raw A4 page-guide index. Legacy fallback - prefer scrollId. Ignored when scrollId is given.',
        },
      },
      required: ['source'],
      additionalProperties: false,
    },
  },
  {
    name: 'bridge_status',
    description:
      'Who else is working in this notebook. Several agents may be connected at ' +
      'once but only one may operate at a time, so call this when a tool comes ' +
      'back LOCKED, or before starting a long piece of work. Reports the ' +
      'connected notebook, every connected agent, which one holds the notebook, ' +
      'how long until it frees up, and whether that is you. This tool is never ' +
      'blocked. Note that a free result can go stale immediately -- another agent ' +
      'may take the lock before your next call -- so treat the LOCKED error as the ' +
      'real signal and this as a way to understand it.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'create_diagram_svg',
    description:
      'Draw an SVG onto the page as native PowerNote shapes. Every element becomes an ' +
      'ordinary rectangle, circle, line or text run that the user can select and drag ' +
      'afterwards -- it is transpiled, NOT embedded as an image. ' +
      'THIS TOOL IS THE OPPOSITE OF THE OTHER TWO: create_diagram_plantuml and ' +
      'create_diagram_mermaid want semantics and compute every coordinate for you, ' +
      'whereas here YOU have already done the layout and the coordinates are the ' +
      'payload. Use this when you want exact placement, and one of the others when you ' +
      'want a diagram laid out well without doing the geometry yourself. ' +
      'Supported: svg (viewBox and width/height set a uniform scale), g with translate ' +
      'and uniform scale, rect (incl. rx), circle, ellipse, line, polyline, polygon, ' +
      'and text with tspan and text-anchor. Paint via fill, stroke, stroke-width, ' +
      'stroke-dasharray and font-*, read from attributes or a style attribute and ' +
      'inherited down the tree. ' +
      'REFUSED, each with a diagnostic naming it: path (a bezier has no native node, ' +
      'and flattening it to line segments is a lie that survives every later edit), ' +
      'gradients, patterns, filters, masks, clipPath, use, symbol, image, ' +
      'foreignObject, textPath, style, script, animation and nested svg. rotate() ' +
      'transforms are refused too, because the native rotation turns about an ' +
      'element\'s own corner rather than the user-space origin, so honouring it would ' +
      'move your drawing. Keep to the supported subset and nothing is silently lost. ' +
      'The response carries the diagnostics, so one call tells you what was dropped.',
    inputSchema: {
      type: 'object',
      properties: {
        source: {
          type: 'string',
          description:
            'SVG markup. A root <svg> with a viewBox is best -- it fixes the scale and ' +
            'the corner lands where the diagram is placed.',
        },
        title: {
          type: 'string',
          description: 'Title shown on the diagram frame. Defaults to "Diagram".',
        },
        pageId: {
          type: 'string',
          description: 'Page to draw on. Defaults to the page currently open.',
        },
        scrollId: {
          type: 'string',
          description:
            'Scroll (named column) to draw into - call list_scrolls first. Lands below ' +
            'whatever is already in that column. Defaults to the leftmost.',
        },
        column: {
          type: 'integer',
          minimum: 0,
          description: 'Raw A4 page-guide index. Legacy fallback - prefer scrollId.',
        },
      },
      required: ['source'],
      additionalProperties: false,
    },
  },
  {
    name: 'create_diagram',
    description:
      'DEPRECATED - use create_diagram_plantuml, create_diagram_mermaid or ' +
      'create_diagram_svg instead, which name the language they take and each ' +
      'document their own subset. This name still works and sniffs the format from ' +
      'the source, but it will be removed. Behaviour is otherwise identical.',
    inputSchema: {
      type: 'object',
      properties: {
        source: { type: 'string', description: 'Diagram source. The format is sniffed.' },
        title: { type: 'string', description: 'Title shown on the diagram frame.' },
        pageId: { type: 'string', description: 'Page to draw on. Defaults to the open page.' },
        scrollId: { type: 'string', description: 'Scroll to draw into. Defaults to the leftmost.' },
        column: { type: 'integer', minimum: 0, description: 'Legacy fallback - prefer scrollId.' },
      },
      required: ['source'],
      additionalProperties: false,
    },
  },
  {
    name: 'list_scrolls',
    description:
      'List the scrolls (named vertical columns) on a page, with how many blocks ' +
      'each holds. Call this before writing when a page may have more than one ' +
      'workstream on it: passing the returned scrollId to append_block keeps your ' +
      'blocks in their own column instead of stacking under someone else\'s. ' +
      'A block belongs to whichever scroll it physically sits in, so a block the ' +
      'user drags to another scroll moves with it.',
    inputSchema: {
      type: 'object',
      properties: {
        pageId: {
          type: 'string',
          description: 'Page to inspect. Defaults to the page currently open.',
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'create_scroll',
    description:
      'Create a new named scroll on a page — a fresh vertical column to the right ' +
      'of the existing ones, with its title shown at the top on the canvas. Use ' +
      'this to keep a separate workstream (say "Open questions" beside "Research ' +
      'log") from interleaving with what is already there. Returns a scrollId to ' +
      'pass to append_block.',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Title shown at the top of the scroll.' },
        pageId: {
          type: 'string',
          description: 'Page to add the scroll to. Defaults to the page currently open.',
        },
      },
      required: ['title'],
      additionalProperties: false,
    },
  },
  {
    name: 'rename_scroll',
    description:
      'Rename a scroll. The new title appears immediately at the top of that ' +
      'column on the canvas. Naming a previously untitled scroll is how its ' +
      'header first appears.',
    inputSchema: {
      type: 'object',
      properties: {
        scrollId: { type: 'string', description: 'Scroll to rename (from list_scrolls).' },
        title: { type: 'string', description: 'New title.' },
      },
      required: ['scrollId', 'title'],
      additionalProperties: false,
    },
  },
  {
    name: 'update_block',
    description:
      'Replace the markdown of an existing block, found via read_page. Use this to ' +
      'revise content or tick a checkbox ("- [ ]" to "- [x]") rather than appending ' +
      'a duplicate block.',
    inputSchema: {
      type: 'object',
      properties: {
        blockId: { type: 'string', description: 'Block id from read_page.' },
        markdown: { type: 'string', description: 'New markdown content.' },
      },
      required: ['blockId', 'markdown'],
      additionalProperties: false,
    },
  },
  {
    name: 'rename_page',
    description:
      'Retitle a page in the sidebar. If the page still opens with the "# Old title" ' +
      'heading block that create_page wrote, that block is retitled too so the two ' +
      'do not drift apart; a hand-edited heading is left alone.',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'New page title.' },
        pageId: {
          type: 'string',
          description: 'Page to rename. Defaults to the page currently open.',
        },
        updateHeading: {
          type: 'boolean',
          description: 'Also rewrite the matching canvas H1. Default true.',
        },
      },
      required: ['title'],
      additionalProperties: false,
    },
  },
  {
    name: 'move_page',
    description:
      'Move a page into a different section. Section ids come from list_pages. ' +
      'A section must keep at least one page, so moving the only page out of a ' +
      'section is refused — create another page there first.',
    inputSchema: {
      type: 'object',
      properties: {
        toSectionId: { type: 'string', description: 'Destination section id.' },
        pageId: {
          type: 'string',
          description: 'Page to move. Defaults to the page currently open.',
        },
        toIndex: {
          type: 'integer',
          minimum: 0,
          description:
            'Position within the destination section. Defaults to last.',
        },
      },
      required: ['toSectionId'],
      additionalProperties: false,
    },
  },
  {
    name: 'rename_notebook',
    description:
      'Rename the notebook itself (the title shown in the app and used for future ' +
      'Save As filenames). This does NOT rename the .html file already on disk — ' +
      'that keeps its current name until the user saves to a new location. The ' +
      'result reports the bound filename so you can tell them.',
    inputSchema: {
      type: 'object',
      properties: {
        filename: { type: 'string', description: 'New notebook name.' },
      },
      required: ['filename'],
      additionalProperties: false,
    },
  },
  {
    name: 'delete_page',
    description:
      'Delete a page and everything on it. Cannot be undone from here — the app ' +
      'has no agent-facing undo — so ask the user before calling, then pass ' +
      'confirm:true. Refuses when the page is the last one in its section.',
    inputSchema: {
      type: 'object',
      properties: {
        pageId: {
          type: 'string',
          description: 'Page to delete. Defaults to the page currently open.',
        },
        confirm: {
          type: 'boolean',
          description: 'Must be true. Confirms the user agreed to the deletion.',
        },
      },
      required: ['confirm'],
      additionalProperties: false,
    },
  },
  {
    name: 'delete_section',
    description:
      'Delete a section AND every page inside it. This is the widest-reaching ' +
      'delete available — confirm the page list with the user first (list_pages ' +
      'shows what would go). Refuses when it is the notebook\'s only section.',
    inputSchema: {
      type: 'object',
      properties: {
        sectionId: { type: 'string', description: 'Section to delete.' },
        confirm: {
          type: 'boolean',
          description: 'Must be true. Confirms the user agreed to the deletion.',
        },
      },
      required: ['sectionId', 'confirm'],
      additionalProperties: false,
    },
  },
  {
    name: 'delete_scroll',
    description:
      'Delete a named scroll (a column). By default its blocks are KEPT and the ' +
      'remaining scrolls close the gap — only the name and the band go. Pass ' +
      'withBlocks:true to remove its content too. Refuses when it is the page\'s ' +
      'only scroll.',
    inputSchema: {
      type: 'object',
      properties: {
        scrollId: { type: 'string', description: 'Scroll to delete (from list_scrolls).' },
        withBlocks: {
          type: 'boolean',
          description: 'Also delete the blocks sitting in that scroll. Default false.',
        },
        confirm: {
          type: 'boolean',
          description: 'Must be true. Confirms the user agreed to the deletion.',
        },
      },
      required: ['scrollId', 'confirm'],
      additionalProperties: false,
    },
  },
  {
    name: 'delete_block',
    description:
      'Delete a single markdown block by id. Use read_page first to get block ids ' +
      'and check you are removing the right one.',
    inputSchema: {
      type: 'object',
      properties: {
        blockId: { type: 'string', description: 'Block to delete (from read_page).' },
        confirm: {
          type: 'boolean',
          description: 'Must be true. Confirms the user agreed to the deletion.',
        },
      },
      required: ['blockId', 'confirm'],
      additionalProperties: false,
    },
  },
  {
    name: 'get_background',
    description:
      'Read the canvas look a page is actually drawn with: which guide style is ' +
      'active and which background colour. A page may override the notebook ' +
      'default, so the reply also carries "source" (whether each value came from ' +
      'the page or the notebook) and "notebookDefault". Call before ' +
      'set_background when you intend to restore the previous look afterwards.',
    inputSchema: {
      type: 'object',
      properties: {
        pageId: {
          type: 'string',
          description: 'Page to read. Defaults to the active page.',
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'set_background',
    description:
      'Change the notebook\'s canvas look. "scroll" renders each column as one ' +
      'continuous vertical sheet with light page separators — best for long ' +
      'reading and for notes an agent is filling in. "pages" shows detached A4 ' +
      'cards, "grid" a dot grid, "none" a blank canvas. The setting is stored in ' +
      'the notebook itself, so it survives closing and reopening. Pass at least ' +
      'one of guideStyle or color.\n\n' +
      'Scope defaults to "notebook" (every page that has not overridden it). Pass ' +
      'scope:"page" to change one page only — useful when a notebook wants a ' +
      'scrolling page of notes next to a grid page of diagrams.',
    inputSchema: {
      type: 'object',
      properties: {
        guideStyle: {
          type: 'string',
          enum: ['pages', 'scroll', 'grid', 'none'],
          description: 'Guide overlay to use.',
        },
        color: {
          type: 'string',
          enum: ['white', 'light-gray', 'gray', 'paper'],
          description: 'Canvas background colour. "paper" is a warm off-white.',
        },
        scope: {
          type: 'string',
          enum: ['notebook', 'page'],
          description:
            'Which layer to write. "notebook" (default) sets the default every ' +
            'page follows unless it overrides it, and leaves existing overrides ' +
            'alone. "page" overrides one page only.',
        },
        pageId: {
          type: 'string',
          description: 'Page to change when scope is "page". Defaults to the active page.',
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'save_notebook',
    description:
      'Write the notebook back to the file it was opened from. Only works when the ' +
      'notebook is already bound to a file: the Save As picker needs a click from ' +
      'the user, which an agent cannot supply. Call this after a batch of edits so ' +
      'the work is on disk.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'check_update',
    description:
      'Check whether a newer PowerNote release exists on GitHub. Reports the running ' +
      'version and the latest one. Note "checked": when false the API was unreachable ' +
      'or rate limited and the status is unknown — that is not the same as up to date.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'run_update',
    description:
      'Install the latest PowerNote release into the current notebook file. This ' +
      'rewrites the .html on disk and reloads the app, which drops this bridge ' +
      'connection until the notebook reconnects. Ask the user before calling it, ' +
      'then pass confirm:true. A safety backup is downloaded first where the browser ' +
      'allows it. Run check_update first.',
    inputSchema: {
      type: 'object',
      properties: {
        confirm: {
          type: 'boolean',
          description: 'Must be true. Confirms the user agreed to the overwrite + reload.',
        },
      },
      required: ['confirm'],
      additionalProperties: false,
    },
  },
];

/**
 * Tools that are one app command carrying a fixed argument.
 *
 * The TOOL is named for the language, because choosing between languages is the
 * decision a model actually has to make and a name it can read beats a `format`
 * enum it has to remember. The COMMAND is one, because once a source is parsed
 * into a spec the language is nothing but which parser ran.
 */
const TOOL_ROUTES = {
  create_diagram_plantuml: { cmd: 'create_diagram', params: { format: 'plantuml' } },
  create_diagram_mermaid: { cmd: 'create_diagram', params: { format: 'mermaid' } },
  create_diagram_svg: { cmd: 'create_diagram', params: { format: 'svg' } },
  // Deprecated alias, kept so anything written against the pre-v0.37 name still
  // works. No `format`, so the grammar is sniffed exactly as it used to be.
  create_diagram: { cmd: 'create_diagram', params: {} },
};

const server = new Server(
  { name: 'powernote-notes', version: '0.33.0' },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

/** Everyone connected right now, from the hub's point of view. */
function connectedAgents() {
  const list = [{ agentId: AGENT_ID, label: AGENT_LABEL, role: 'hub' }];
  for (const info of peers.values()) {
    list.push({ agentId: info.agentId, label: info.label, role: 'peer' });
  }
  return list;
}

/**
 * Runs one tool on behalf of an agent, holding the lease for its duration.
 *
 * Only the hub ever gets here: peers forward to it, so there is exactly one
 * arbiter no matter how many agent processes are running.
 */
async function runToolAsAgent(name, params, agentId, label) {
  if (name === 'bridge_status') {
    const st = lockStatus();
    return {
      notebook: appInfo ? appInfo.notebook : null,
      notebookConnected: !!app,
      you: { agentId: agentId, label: label, isHolder: st.holderId === agentId },
      agents: connectedAgents(),
      lock: {
        held: st.held,
        heldBy: st.holder,
        heldByYou: st.holderId === agentId,
        heldForMs: st.heldForMs,
        freesUpInMs: st.retryAfterMs,
        agentsWaiting: st.waiting,
      },
    };
  }

  const route = TOOL_ROUTES[name];
  const cmd = route ? route.cmd : name;
  const args = route ? { ...params, ...route.params } : params;

  // Reads never queue: an agent that cannot look also cannot find out why.
  if (READ_ONLY.has(name)) {
    const response = await callApp(cmd, args);
    return unwrap(response);
  }

  const release = acquireLock(agentId, label);
  try {
    const response = await callApp(cmd, args);
    return unwrap(response);
  } finally {
    release();
  }
}

class CommandFailed extends Error {}

function unwrap(response) {
  if (response.ok === false) {
    throw new CommandFailed(
      (response.error && response.error.code) + ': ' + (response.error && response.error.message),
    );
  }
  return response.result;
}

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  if (!TOOLS.some((t) => t.name === name)) {
    return {
      isError: true,
      content: [{ type: 'text', text: `Unknown tool "${name}"` }],
    };
  }

  if (startupError) {
    return { isError: true, content: [{ type: 'text', text: startupError }] };
  }

  try {
    // Hub runs it directly; a peer asks the hub, so the lease is decided in one
    // place regardless of which process the agent happens to be talking to.
    let result;
    if (mode === 'peer') {
      const response = await askHub(name, args ?? {});
      if (response.ok === false) {
        return {
          isError: true,
          content: [
            {
              type: 'text',
              text: (response.error && response.error.code) + ': ' + (response.error && response.error.message),
            },
          ],
        };
      }
      result = response.result;
    } else {
      result = await runToolAsAgent(name, args ?? {}, AGENT_ID, AGENT_LABEL);
    }

    const payload = { ...result };
    if (appInfo) payload._notebook = appInfo.notebook;
    // Stamp identity on every result: an agent that never learns who it is
    // cannot make sense of a LOCKED message naming someone else.
    payload._agent = { id: AGENT_ID, label: AGENT_LABEL, role: mode };
    return { content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }] };
  } catch (err) {
    const code = err instanceof Locked ? 'LOCKED: ' : '';
    return { isError: true, content: [{ type: 'text', text: code + err.message }] };
  }
});

// ── Startup / shutdown ──────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // Race for the port: winner hosts the notebook connection and the lock,
  // losers become peers of whoever won.
  await start();
  log('MCP server ready on stdio (' + mode + ').');
}

function shutdown() {
  for (const { timer } of pending.values()) clearTimeout(timer);
  pending.clear();
  if (wss) wss.close();
  if (hub) hub.close();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

main().catch((err) => {
  log('Fatal:', err?.stack || err);
  process.exit(1);
});
