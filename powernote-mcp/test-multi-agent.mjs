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
import { WebSocket } from 'ws';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

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
      ws.send(JSON.stringify({ v: 1, id: msg.id, ok: true, result: { ran: msg.cmd } }));
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

  console.log(failures === 0 ? '\nall passed' : `\n${failures} failed`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
