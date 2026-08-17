/**
 * Test 159: read_page reshape, get_block, member guards
 * Covers: REQ-AGENT-055, REQ-AGENT-058, REQ-AGENT-059, REQ-DIAG-006
 *
 * Label leak is a correctness bug, not just bloat: every diagram label is a
 * type:'text' node that used to land in blocks[] with the label's own x as
 * its scroll. diagrams[] is how agents discover ids for delete_diagram.
 */
import { test, expect } from '@playwright/test';
import {
  waitForCanvasReady,
  waitForBridgeReady,
  runBridge,
  runBridgeExpectingError,
} from '../helpers';
import { READ_PAGE_RESPONSE_BUDGET } from '../../src/bridge/protocol';

const COMPOSITE = `@startuml
component "gateway" as gw {
  portin telemetry
  portout storage
  component "broker : MqttBroker [1]" as broker
  component "buffer : StoreForward [1..*]" as buffer
  broker --> buffer : Queue
  telemetry --> broker
  buffer --> storage
}
@enduml`;

const A4_WIDTH = 794;
const PAGE_GAP = 40;
const PAGE_MARGIN = 60;
const columnX = (col: number) => PAGE_MARGIN + col * (A4_WIDTH + PAGE_GAP);

test.describe('159 - read_page reshape (REQ-AGENT-055, REQ-AGENT-058, REQ-AGENT-059)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForCanvasReady(page);
    await waitForBridgeReady(page);
  });

  test('diagram labels do not leak into blocks[] and scroll attribution stays on the frame', async ({
    page,
  }) => {
    await runBridge(page, 'append_block', { markdown: 'Real content' });
    const drawn = await runBridge(page, 'create_diagram', {
      source: COMPOSITE,
      title: 'Gateway internals',
    });

    // A label planted in column 1 must not become a column-1 block.
    await page.evaluate(
      ({ frameId, x }) => {
        const canvas = (window as any).__POWERNOTE_STORES__.canvas;
        canvas.getState().addNode({
          id: 'leaky-label',
          type: 'text',
          x,
          y: 400,
          width: 80,
          height: 24,
          layer: 4,
          groupId: frameId,
          data: {
            text: 'leaked label',
            fontSize: 12,
            fontFamily: 'Inter',
            fontStyle: 'normal',
            fill: '#111',
          },
        });
        const ws = (window as any).__POWERNOTE_STORES__.workspace.getState();
        ws.savePageNodes(canvas.getState().nodes);
      },
      { frameId: drawn.diagramId, x: columnX(1) },
    );

    const content = await runBridge(page, 'read_page');
    const store = await page.evaluate(
      () => (window as any).__POWERNOTE_STORES__.canvas.getState().nodes,
    );
    const groupedText = store.filter((n: any) => n.type === 'text' && n.groupId);
    expect(groupedText.length).toBeGreaterThan(0);

    expect(content.blocks.every((b: any) => !groupedText.some((n: any) => n.id === b.blockId))).toBe(
      true,
    );
    expect(content.blocks.map((b: any) => b.markdown)).toEqual(['Real content']);
    expect(content.blocks[0].scrollId).toBeTruthy();
    expect(content.blocks.map((b: any) => b.blockId)).not.toContain('leaky-label');

    expect(content.diagrams).toHaveLength(1);
    const entry = content.diagrams[0];
    expect(entry.id).toBe(drawn.diagramId);
    expect(entry.title).toBe('Gateway internals');
    expect(entry.format).toBe('plantuml');
    expect(entry.memberCount).toBeGreaterThan(0);
    expect(entry.bounds).toEqual(
      expect.objectContaining({
        x: expect.any(Number),
        y: expect.any(Number),
        width: expect.any(Number),
        height: expect.any(Number),
      }),
    );
    expect(entry.source).toBeUndefined();
    expect(entry.members).toBeUndefined();
  });

  test('user-grouped (Ctrl+G) text blocks remain visible in blocks[]', async ({ page }) => {
    // Only DIAGRAM-owned text is chrome. A user's own group of ordinary text
    // blocks is still content — the first cut of this feature excluded every
    // grouped text node, which silently hid grouped notes from agents.
    await runBridge(page, 'append_block', { markdown: 'Grouped note' });
    await page.evaluate(() => {
      const canvas = (window as any).__POWERNOTE_STORES__.canvas;
      const textNode = canvas.getState().nodes.find((n: any) => n.type === 'text');
      // A plain group id that belongs to no diagram frame — Ctrl+G semantics.
      canvas.getState().updateNode(textNode.id, { groupId: 'user-group-1' });
      const ws = (window as any).__POWERNOTE_STORES__.workspace.getState();
      ws.savePageNodes(canvas.getState().nodes);
    });

    const content = await runBridge(page, 'read_page');
    expect(content.blocks.map((b: any) => b.markdown)).toContain('Grouped note');
  });

  test('diagrams[].id is usable by delete_diagram', async ({ page }) => {
    await runBridge(page, 'create_diagram', { source: COMPOSITE, title: 'To delete' });
    const content = await runBridge(page, 'read_page');
    expect(content.diagrams).toHaveLength(1);

    await runBridge(page, 'delete_diagram', {
      diagramId: content.diagrams[0].id,
      confirm: true,
    });

    const after = await runBridge(page, 'read_page');
    expect(after.diagrams).toEqual([]);
  });

  test('include diagrams-only omits blocks', async ({ page }) => {
    await runBridge(page, 'append_block', { markdown: 'Keep me out' });
    await runBridge(page, 'create_diagram', { source: COMPOSITE, title: 'Only this' });

    const content = await runBridge(page, 'read_page', { include: ['diagrams'] });
    expect(content.blocks).toEqual([]);
    expect(content.diagrams).toHaveLength(1);
    expect(content.diagrams[0].title).toBe('Only this');
  });

  test('scrollId filters blocks and diagrams', async ({ page }) => {
    const left = await runBridge(page, 'create_scroll', { title: 'Left stream' });
    const right = await runBridge(page, 'create_scroll', { title: 'Right stream' });
    await runBridge(page, 'append_block', { markdown: 'L-block', scrollId: left.scrollId });
    await runBridge(page, 'append_block', { markdown: 'R-block', scrollId: right.scrollId });
    await runBridge(page, 'create_diagram', {
      source: COMPOSITE,
      title: 'Right diagram',
      scrollId: right.scrollId,
    });

    const filtered = await runBridge(page, 'read_page', { scrollId: right.scrollId });
    expect(filtered.blocks.map((b: any) => b.markdown)).toEqual(['R-block']);
    expect(filtered.diagrams.map((d: any) => d.title)).toEqual(['Right diagram']);

    const missing = await runBridgeExpectingError(page, 'read_page', {
      scrollId: 'no-such-scroll',
    });
    expect(missing.code).toBe('NOT_FOUND');
  });

  test('limit/cursor walk covers every block exactly once', async ({ page }) => {
    const ids: string[] = [];
    for (const text of ['A', 'B', 'C', 'D', 'E']) {
      const placed = await runBridge(page, 'append_block', { markdown: text });
      ids.push(placed.blockId);
    }

    const seen: string[] = [];
    let cursor: string | undefined;
    for (let i = 0; i < 10; i++) {
      const pageful = await runBridge(page, 'read_page', {
        include: ['blocks'],
        limit: 2,
        ...(cursor ? { cursor } : {}),
      });
      const chunk = pageful.blocks.map((b: any) => b.blockId);
      expect(new Set(chunk).size).toBe(chunk.length);
      seen.push(...chunk);
      if (!pageful.nextCursor) break;
      cursor = pageful.nextCursor;
    }

    expect(seen).toEqual(ids);
    expect(new Set(seen).size).toBe(ids.length);
  });

  test('size-cap truncation notice on a generated huge page', async ({ page }) => {
    await page.evaluate((n) => {
      const canvas = (window as any).__POWERNOTE_STORES__.canvas;
      const chunk = 'W'.repeat(800);
      const nodes = [];
      for (let i = 0; i < n; i++) {
        nodes.push({
          id: `huge-${i}`,
          type: 'text',
          x: 60,
          y: 48 + i * 40,
          width: 794,
          height: 32,
          layer: 4,
          data: {
            text: `${chunk}-${i}`,
            fontSize: 16,
            fontFamily: 'Inter',
            fontStyle: 'normal',
            fill: '#111',
          },
        });
      }
      canvas.setState({ nodes });
      (window as any).__POWERNOTE_STORES__.workspace.getState().savePageNodes(nodes);
    }, 40);

    const content = await runBridge(page, 'read_page', { include: ['blocks'] });
    expect(content.truncated).toBeTruthy();
    expect(content.truncated.at).toBeTruthy();
    expect(content.truncated.notice).toContain(String(READ_PAGE_RESPONSE_BUDGET));
    expect(content.blocks.length).toBeGreaterThan(0);
    expect(content.blocks.length).toBeLessThan(40);
    expect(content.blocks[content.blocks.length - 1].blockId).toBe(content.truncated.at);
    expect(JSON.stringify(content).length).toBeLessThanOrEqual(READ_PAGE_RESPONSE_BUDGET);

    const first = await runBridge(page, 'get_block', { blockId: content.blocks[0].blockId });
    expect(first.markdown.startsWith('W')).toBe(true);
    expect(first.blockId).toBe(content.blocks[0].blockId);
  });

  test('include_diagram_source expands source on each diagram entry', async ({ page }) => {
    await runBridge(page, 'create_diagram', { source: COMPOSITE, title: 'With source' });
    const bare = await runBridge(page, 'read_page', { include: ['diagrams'] });
    expect(bare.diagrams[0].source).toBeUndefined();

    const full = await runBridge(page, 'read_page', {
      include: ['diagrams'],
      include_diagram_source: true,
    });
    expect(full.diagrams[0].source).toContain('MqttBroker');
  });

  test('get_block returns one block and NOT_FOUND otherwise', async ({ page }) => {
    const placed = await runBridge(page, 'append_block', { markdown: 'solo' });
    const got = await runBridge(page, 'get_block', { blockId: placed.blockId });
    expect(got.markdown).toBe('solo');
    expect(got.blockId).toBe(placed.blockId);
    expect(got.pageId).toBeTruthy();

    const missing = await runBridgeExpectingError(page, 'get_block', { blockId: 'nope' });
    expect(missing.code).toBe('NOT_FOUND');
  });

  test('delete_block and update_block refuse diagram members by name', async ({ page }) => {
    const drawn = await runBridge(page, 'create_diagram', {
      source: COMPOSITE,
      title: 'Owned',
    });
    const memberId = await page.evaluate((frameId) => {
      const nodes = (window as any).__POWERNOTE_STORES__.canvas.getState().nodes;
      const label = nodes.find((n: any) => n.groupId === frameId && n.type === 'text' && n.id !== frameId);
      return label?.id ?? null;
    }, drawn.diagramId);
    expect(memberId).toBeTruthy();

    const del = await runBridgeExpectingError(page, 'delete_block', {
      blockId: memberId,
      confirm: true,
    });
    expect(del.code).toBe('UNSUPPORTED');
    expect(del.message).toContain('Owned');
    expect(del.message).toContain(drawn.diagramId);
    expect(del.message).toContain('delete_diagram');

    const upd = await runBridgeExpectingError(page, 'update_block', {
      blockId: memberId,
      markdown: 'nope',
    });
    expect(upd.code).toBe('UNSUPPORTED');
    expect(upd.message).toContain('Owned');
    expect(upd.message).toMatch(/redraw/i);

    const still = await page.evaluate(
      (id) =>
        (window as any).__POWERNOTE_STORES__.canvas.getState().nodes.some((n: any) => n.id === id),
      memberId,
    );
    expect(still).toBe(true);
  });
});
