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
 * IMPORTANT: stdout is the MCP transport. All logging goes to stderr.
 */

import { randomUUID } from 'node:crypto';
import { WebSocketServer } from 'ws';
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

// ── App connection ──────────────────────────────────────────

/** The currently connected PowerNote tab, if any. Latest connection wins. */
let app = null;
/** Metadata from the app's hello frame. */
let appInfo = null;
/** id → { resolve, reject, timer } for in-flight requests. */
const pending = new Map();

const wss = new WebSocketServer({ host: HOST, port: PORT });

wss.on('listening', () => log(`WebSocket listening on ws://${HOST}:${PORT}`));

wss.on('error', (err) => {
  if (err && err.code === 'EADDRINUSE') {
    log(
      `Port ${PORT} is already in use — another powernote-notes server is probably ` +
      `running. Stop it, or set POWERNOTE_BRIDGE_PORT to a free port.`,
    );
  } else {
    log('WebSocket server error:', err?.message || err);
  }
});

/** Fail every in-flight request now, rather than letting each one time out. */
function rejectPending(message) {
  for (const [id, entry] of pending) {
    clearTimeout(entry.timer);
    pending.delete(id);
    entry.reject(new BridgeUnavailable(message));
  }
}

wss.on('connection', (socket) => {
  const previous = app;
  // Newest connection wins: a stale or zombie socket must never lock out a
  // notebook the user is actually looking at.
  app = socket;
  appInfo = null;

  if (previous && previous !== socket && previous.readyState === previous.OPEN) {
    log('A second notebook connected; displacing the previous one.');
    // Tell the old client to stand down BEFORE closing it. Without this it
    // reconnects on backoff, displaces this new client in turn, and the two
    // trade the slot forever — commands then land in whichever notebook
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
      log('Could not notify displaced notebook:', err?.message || err);
    }
    previous.close();
    rejectPending(
      'The notebook this request was sent to was displaced by another connection. Retry.',
    );
  }

  log('Notebook connected.');

  socket.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }

    if (msg.type === 'hello') {
      appInfo = { appVersion: msg.appVersion, notebook: msg.notebook };
      log(`Hello from PowerNote v${msg.appVersion} — notebook "${msg.notebook}"`);
      return;
    }

    const entry = pending.get(msg.id);
    if (!entry) return;
    clearTimeout(entry.timer);
    pending.delete(msg.id);
    entry.resolve(msg);
  });

  socket.on('close', () => {
    if (app === socket) {
      app = null;
      appInfo = null;
      log('Notebook disconnected.');
    }
  });

  socket.on('error', (err) => log('Socket error:', err?.message || err));
});

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
    name: 'get_background',
    description:
      'Read the notebook\'s canvas look: which guide style is active and which ' +
      'background colour. Call before set_background when you intend to restore ' +
      'the previous look afterwards.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'set_background',
    description:
      'Change the notebook\'s canvas look. "scroll" renders each column as one ' +
      'continuous vertical sheet with light page separators — best for long ' +
      'reading and for notes an agent is filling in. "pages" shows detached A4 ' +
      'cards, "grid" a dot grid, "none" a blank canvas. The setting is stored in ' +
      'the notebook itself, so it survives closing and reopening. Pass at least ' +
      'one of guideStyle or color.',
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

const server = new Server(
  { name: 'powernote-notes', version: '0.31.0' },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  if (!TOOLS.some((t) => t.name === name)) {
    return {
      isError: true,
      content: [{ type: 'text', text: `Unknown tool "${name}"` }],
    };
  }

  try {
    const response = await callApp(name, args ?? {});
    if (response.ok === false) {
      return {
        isError: true,
        content: [
          { type: 'text', text: `${response.error?.code}: ${response.error?.message}` },
        ],
      };
    }
    const payload = { ...response.result };
    if (appInfo) payload._notebook = appInfo.notebook;
    return { content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }] };
  } catch (err) {
    return { isError: true, content: [{ type: 'text', text: err.message }] };
  }
});

// ── Startup / shutdown ──────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  log('MCP server ready on stdio.');
}

function shutdown() {
  for (const { timer } of pending.values()) clearTimeout(timer);
  pending.clear();
  wss.close();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

main().catch((err) => {
  log('Fatal:', err?.stack || err);
  process.exit(1);
});
