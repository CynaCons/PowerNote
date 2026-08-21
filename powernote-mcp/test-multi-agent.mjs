#!/usr/bin/env node
/**
 * Integration test for multi-agent arbitration.
 *
 * The Playwright suite drives the APP side of the bridge and never starts this
 * server, so the hub/peer topology and the lock have no coverage there. This
 * spawns two real server processes over stdio, stands up a fake notebook on the
 * WebSocket, and drives them as MCP clients.
 *
 * Run: npm run test:bridge
 */
import { spawn } from 'node:child_process';
import { existsSync, readFileSync, rmSync, writeFileSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { WebSocket } from 'ws';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
  'base64',
);

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SERVER = path.join(HERE, 'server.js');
const PORT = 41991; // off the default so a real notebook cannot interfere

let failures = 0;
const check = (name, ok, detail) => {
  console.log(`${ok ? '  ok  ' : '  FAIL'} ${name}${ok || !detail ? '' : ` — ${detail}`}`);
  if (!ok) failures += 1;
};

/** One MCP server process, driven over stdio with JSON-RPC. */
function startAgent(label, extraEnv = {}) {
  const proc = spawn(process.execPath, [SERVER], {
    env: {
      ...process.env,
      POWERNOTE_BRIDGE_PORT: String(PORT),
      POWERNOTE_AGENT_NAME: label,
      POWERNOTE_BRIDGE_TIMEOUT_MS: '4000',
      // Short lease so the idle-expiry check does not make the test crawl.
      POWERNOTE_LOCK_IDLE_MS: '1000',
      ...extraEnv,
    },
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  let buffer = '';
  const waiters = new Map();
  const logs = [];
  let nextId = 1;

  proc.stdout.on('data', (chunk) => {
    buffer += chunk.toString();
    let nl;
    while ((nl = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (!line) continue;
      let msg;
      try {
        msg = JSON.parse(line);
      } catch {
        continue;
      }
      const w = waiters.get(msg.id);
      if (w) {
        waiters.delete(msg.id);
        w(msg);
      }
    }
  });
  proc.stderr.on('data', (c) => logs.push(c.toString()));

  const rpc = (method, params) =>
    new Promise((resolve) => {
      const id = nextId++;
      waiters.set(id, resolve);
      proc.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`);
    });

  return {
    label,
    proc,
    logs,
    async init() {
      await rpc('initialize', {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: label, version: '1' },
      });
      proc.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' })}\n`);
    },
    async call(name, args = {}) {
      const res = await rpc('tools/call', { name, arguments: args });
      const text = res?.result?.content?.[0]?.text ?? '';
      return { isError: !!res?.result?.isError, text };
    },
    async listTools() {
      const res = await rpc('tools/list', {});
      return (res?.result?.tools ?? []).map((t) => t.name);
    },
    stop() {
      proc.kill();
    },
  };
}

/** A stand-in for the PowerNote tab: answers every command with a stub result. */
function fakeNotebook() {
  const ws = new WebSocket(`ws://127.0.0.1:${PORT}`);
  const seen = [];
  // Whole frames as well as names: a tool that rewrites its command or injects a
  // parameter is only observable from this side.
  const frames = [];
  ws.on('open', () => {
    ws.send(
      JSON.stringify({ v: 1, type: 'hello', app: 'powernote', appVersion: '0.36.0', notebook: 'Test.html' }),
    );
  });
  ws.on('message', (raw) => {
    const msg = JSON.parse(raw.toString());
    if (!msg.cmd) return;
    seen.push(msg.cmd);
    frames.push(msg);
    // A slow command, so the test can observe a lease being held across one.
    const delay = msg.cmd === 'save_notebook' ? 900 : 10;
    setTimeout(() => {
      let result = { ran: msg.cmd };
      if (msg.cmd === 'read_image') {
        result = {
          id: msg.params?.id ?? 'img-1',
          src: `data:image/png;base64,${PNG_1X1.toString('base64')}`,
          format: 'png',
          bytes: PNG_1X1.length,
          naturalWidth: 1,
          naturalHeight: 1,
          alt: 'stub',
        };
      }
      ws.send(JSON.stringify({ v: 1, id: msg.id, ok: true, result }));
    }, delay);
  });
  return { ws, seen, frames, close: () => ws.close() };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  console.log('multi-agent bridge');

  const alpha = startAgent('alpha');
  await alpha.init();
  await sleep(600); // let it win the port

  const beta = startAgent('beta');
  await beta.init();
  await sleep(600); // let it discover the hub and join as a peer

  const notebook = fakeNotebook();
  await sleep(500);

  // --- both agents are usable -------------------------------------------
  const tools = await beta.listTools();
  check('bridge_status is offered', tools.includes('bridge_status'));

  const aStatus = JSON.parse((await alpha.call('bridge_status')).text);
  check('hub sees both agents', aStatus.agents.length === 2, JSON.stringify(aStatus.agents));
  check('notebook is reported', aStatus.notebook === 'Test.html', aStatus.notebook);

  const bStatus = JSON.parse((await beta.call('bridge_status')).text);
  check('peer knows its own identity', bStatus.you.label === 'beta', JSON.stringify(bStatus.you));
  check('lock starts free', bStatus.lock.held === false);

  // --- a peer can write through the hub ---------------------------------
  const bWrite = await beta.call('append_block', { markdown: 'from beta' });
  check('peer write reaches the notebook', !bWrite.isError, bWrite.text);
  check('notebook actually ran it', notebook.seen.includes('append_block'));

  // --- diagram tools are named for the language they take ----------------
  check('plantuml diagram tool is offered', tools.includes('create_diagram_plantuml'));
  check('mermaid diagram tool is offered', tools.includes('create_diagram_mermaid'));
  check('svg diagram tool is offered', tools.includes('create_diagram_svg'));
  check('drawio diagram tool is offered', tools.includes('create_diagram_drawio'));
  // Kept on purpose: renaming a shipped tool would break anything written
  // against the old name, and an alias costs one route entry.
  check('the old name survives as a deprecated alias', tools.includes('create_diagram'));

  const legacy = await beta.call('create_diagram', { source: 'flowchart LR\nA-->B' });
  check('the deprecated alias still draws', !legacy.isError, legacy.text);

  const drawn = await beta.call('create_diagram_mermaid', { source: 'flowchart LR\nA-->B' });
  check('mermaid tool reaches the notebook', !drawn.isError, drawn.text);
  const frame = notebook.frames.filter((f) => f.cmd === 'create_diagram').pop();
  check(
    'mermaid tool routes to create_diagram naming its format',
    !!frame && frame.params.format === 'mermaid',
    JSON.stringify(frame),
  );

  const dio = await beta.call('create_diagram_drawio', {
    source: '<mxfile><diagram><mxGraphModel><root><mxCell id="0"/></root></mxGraphModel></diagram></mxfile>',
  });
  check('drawio tool reaches the notebook', !dio.isError, dio.text);
  const dioFrame = notebook.frames.filter((f) => f.cmd === 'create_diagram').pop();
  check(
    'drawio tool routes to create_diagram naming its format',
    !!dioFrame && dioFrame.params.format === 'drawio',
    JSON.stringify(dioFrame),
  );

  check('delete_diagram is offered', tools.includes('delete_diagram'));
  const delDiag = await beta.call('delete_diagram', { diagramId: 'frame-1', confirm: true });
  check('delete_diagram reaches the notebook', !delDiag.isError, delDiag.text);
  const delFrame = notebook.frames.filter((f) => f.cmd === 'delete_diagram').pop();
  check(
    'delete_diagram routes as delete_diagram',
    !!delFrame && delFrame.cmd === 'delete_diagram' && delFrame.params.diagramId === 'frame-1',
    JSON.stringify(delFrame),
  );

  check('read_diagram is offered', tools.includes('read_diagram'));
  check('get_block is offered', tools.includes('get_block'));
  check('fit_diagram is offered', tools.includes('fit_diagram'));
  const readDiag = await beta.call('read_diagram', { diagramId: 'frame-1' });
  check('read_diagram reaches the notebook', !readDiag.isError, readDiag.text);
  const readDiagFrame = notebook.frames.filter((f) => f.cmd === 'read_diagram').pop();
  check(
    'read_diagram routes as read_diagram',
    !!readDiagFrame && readDiagFrame.cmd === 'read_diagram' && readDiagFrame.params.diagramId === 'frame-1',
    JSON.stringify(readDiagFrame),
  );

  check('insert_block is offered', tools.includes('insert_block'));
  check('move_block is offered', tools.includes('move_block'));
  const inserted = await beta.call('insert_block', {
    scrollId: 's1',
    markdown: 'mid',
    index: 0,
  });
  check('insert_block reaches the notebook', !inserted.isError, inserted.text);
  const insertFrame = notebook.frames.filter((f) => f.cmd === 'insert_block').pop();
  check(
    'insert_block routes as insert_block',
    !!insertFrame &&
      insertFrame.cmd === 'insert_block' &&
      insertFrame.params.scrollId === 's1' &&
      insertFrame.params.index === 0,
    JSON.stringify(insertFrame),
  );

  const movedBlock = await beta.call('move_block', { blockId: 'b1', after: 'b0' });
  check('move_block reaches the notebook', !movedBlock.isError, movedBlock.text);
  const moveBlockFrame = notebook.frames.filter((f) => f.cmd === 'move_block').pop();
  check(
    'move_block routes as move_block',
    !!moveBlockFrame &&
      moveBlockFrame.cmd === 'move_block' &&
      moveBlockFrame.params.blockId === 'b1' &&
      moveBlockFrame.params.after === 'b0',
    JSON.stringify(moveBlockFrame),
  );

  check('insert_image is offered', tools.includes('insert_image'));
  const bothSources = await beta.call('insert_image', {
    scrollId: 's1',
    index: 0,
    data: 'data:image/png;base64,aaa',
    path: 'C:\\\\nope.png',
  });
  check(
    'insert_image both data+path is BAD_PARAMS',
    bothSources.isError && /BAD_PARAMS/.test(bothSources.text),
    bothSources.text,
  );
  const neitherSource = await beta.call('insert_image', { scrollId: 's1', index: 0 });
  check(
    'insert_image neither data nor path is BAD_PARAMS',
    neitherSource.isError && /BAD_PARAMS/.test(neitherSource.text),
    neitherSource.text,
  );
  const pngPath = path.join(tmpdir(), `powernote-insert-image-${Date.now()}.png`);
  writeFileSync(pngPath, PNG_1X1);
  try {
    const fromPath = await beta.call('insert_image', {
      scrollId: 's1',
      index: 0,
      path: pngPath,
      alt: 'from-path',
    });
    check('insert_image path variant reaches the notebook', !fromPath.isError, fromPath.text);
    const imgFrame = notebook.frames.filter((f) => f.cmd === 'insert_image').pop();
    check(
      'insert_image path is encoded server-side; app sees data not path',
      !!imgFrame &&
        imgFrame.cmd === 'insert_image' &&
        imgFrame.params.scrollId === 's1' &&
        imgFrame.params.index === 0 &&
        typeof imgFrame.params.data === 'string' &&
        imgFrame.params.data.startsWith('data:image/png;base64,') &&
        imgFrame.params.path === undefined &&
        imgFrame.params.alt === 'from-path',
      JSON.stringify(imgFrame),
    );
  } finally {
    try {
      unlinkSync(pngPath);
    } catch {
      // ignored
    }
  }

  check('read_image is offered', tools.includes('read_image'));
  const readOutDir = path.join(tmpdir(), `powernote-read-image-${Date.now()}`);
  const readOutPath = path.join(readOutDir, 'exported.png');
  const fromRead = await beta.call('read_image', { id: 'img-1', out_path: readOutPath });
  check('read_image reaches the notebook', !fromRead.isError, fromRead.text);
  let readParsed = {};
  try {
    readParsed = JSON.parse(fromRead.text);
  } catch {
    readParsed = {};
  }
  const readFrame = notebook.frames.filter((f) => f.cmd === 'read_image').pop();
  check(
    'read_image routes id to the notebook and keeps out_path server-side',
    !!readFrame &&
      readFrame.cmd === 'read_image' &&
      readFrame.params.id === 'img-1' &&
      readFrame.params.out_path === undefined,
    JSON.stringify(readFrame),
  );
  check(
    'read_image agent response has no payload',
    !fromRead.text.includes('data:image') &&
      readParsed.path === readOutPath &&
      readParsed.format === 'png' &&
      readParsed.bytes === PNG_1X1.length,
    fromRead.text,
  );
  check(
    'read_image writes the decoded file at out_path (parent dirs created)',
    existsSync(readOutPath) && readFileSync(readOutPath).equals(PNG_1X1),
    readOutPath,
  );
  const tmpRead = await beta.call('read_image', { id: 'img-1' });
  let tmpParsed = {};
  try {
    tmpParsed = JSON.parse(tmpRead.text);
  } catch {
    tmpParsed = {};
  }
  check(
    'read_image without out_path lands under os.tmpdir()/powernote-images',
    !tmpRead.isError &&
      typeof tmpParsed.path === 'string' &&
      tmpParsed.path.includes('powernote-images') &&
      existsSync(tmpParsed.path) &&
      readFileSync(tmpParsed.path).length === PNG_1X1.length,
    tmpRead.text,
  );
  try {
    rmSync(readOutDir, { recursive: true, force: true });
    if (tmpParsed.path) unlinkSync(tmpParsed.path);
  } catch {
    // ignored
  }

  check('move_scroll is offered', tools.includes('move_scroll'));
  const moved = await beta.call('move_scroll', { scrollId: 's1', direction: 'left' });
  check('move_scroll reaches the notebook', !moved.isError, moved.text);
  const moveFrame = notebook.frames.filter((f) => f.cmd === 'move_scroll').pop();
  check(
    'move_scroll routes as move_scroll',
    !!moveFrame &&
      moveFrame.cmd === 'move_scroll' &&
      moveFrame.params.scrollId === 's1' &&
      moveFrame.params.direction === 'left',
    JSON.stringify(moveFrame),
  );

  // --- exclusion --------------------------------------------------------
  // beta holds the lease from the write above; alpha must be refused.
  const aWrite = await alpha.call('append_block', { markdown: 'from alpha' });
  check('second agent is locked out', aWrite.isError, aWrite.text);
  check('lock error names the holder', aWrite.text.includes('beta'), aWrite.text);
  check('lock error says when to retry', /retry/i.test(aWrite.text), aWrite.text);

  const aStatus2 = JSON.parse((await alpha.call('bridge_status')).text);
  check('status shows who holds it', aStatus2.lock.heldBy === 'beta', JSON.stringify(aStatus2.lock));
  check('status says it is not you', aStatus2.lock.heldByYou === false);
  check('status counts the waiter', aStatus2.lock.agentsWaiting >= 1, String(aStatus2.lock.agentsWaiting));

  // --- reads are never blocked -----------------------------------------
  const aRead = await alpha.call('list_pages');
  check('blocked agent can still read', !aRead.isError, aRead.text);
  let compactOk = false;
  try {
    compactOk = aRead.text === JSON.stringify(JSON.parse(aRead.text));
  } catch {
    compactOk = false;
  }
  check(
    'MCP payloads are compact JSON (no pretty-print indent)',
    compactOk && !aRead.text.includes('\n  '),
    aRead.text.slice(0, 120),
  );

  // --- the lease expires so nobody is wedged ---------------------------
  await sleep(1400); // > POWERNOTE_LOCK_IDLE_MS set below
  const aWrite2 = await alpha.call('append_block', { markdown: 'alpha again' });
  check('lock frees up when idle', !aWrite2.isError, aWrite2.text);

  // --- a lease is held across a slow command ---------------------------
  const slow = alpha.call('save_notebook');
  await sleep(250);
  const bDuring = await beta.call('append_block', { markdown: 'during save' });
  check('lease holds across a slow command', bDuring.isError, bDuring.text);
  await slow;

  // --- hub death promotes a peer ---------------------------------------
  alpha.stop();
  await sleep(1600);
  const bAfter = JSON.parse((await beta.call('bridge_status')).text);
  check('surviving agent took over the hub', bAfter.you.label === 'beta');

  notebook.close();
  beta.stop();

  const summary = failures === 0 ? '\nall passed\n' : `\n${failures} failed\n`;
  await new Promise((resolve) => process.stdout.write(summary, () => resolve()));
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
