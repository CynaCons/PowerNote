/**
 * Test 105: Agents writing into parallel scrolls
 * Covers: REQ-SCROLL-006, REQ-SCROLL-007, REQ-SCROLL-009, REQ-AGENT-024
 *
 * The point of named scrolls is SPATIAL ISOLATION: two workstreams share one
 * page, and neither's blocks ever land in the other's column — no matter what
 * order the commands arrive in. These tests interleave writes on purpose, since
 * the failure this design exists to prevent is content stacking under someone
 * else's.
 */
import { test, expect } from '@playwright/test';
import {
  waitForCanvasReady,
  waitForBridgeReady,
  runBridge,
  runBridgeExpectingError,
  stubBridgeUrl,
} from '../helpers';

const A4_WIDTH = 794;
const PAGE_GAP = 40;
const PAGE_MARGIN = 60;
const columnX = (col: number) => PAGE_MARGIN + col * (A4_WIDTH + PAGE_GAP);

test.describe('105 - Agent parallel scrolls (REQ-SCROLL-006..009)', () => {
  test.beforeEach(async ({ page }) => {
    await stubBridgeUrl(page);
    await page.goto('/');
    await waitForCanvasReady(page);
    await waitForBridgeReady(page);
  });

  test('list_scrolls reports the page bands with block counts', async ({ page }) => {
    const created = await runBridge(page, 'create_scroll', { title: 'Research log' });
    expect(created.column).toBe(1);
    expect(created.scrollId).toBeTruthy();

    await runBridge(page, 'append_block', {
      markdown: 'First finding',
      scrollId: created.scrollId,
    });

    const listed = await runBridge(page, 'list_scrolls');
    const target = listed.scrolls.find((s: any) => s.scrollId === created.scrollId);
    expect(target.title).toBe('Research log');
    expect(target.blockCount).toBe(1);
    // Reported left to right, so an agent can reason about order.
    expect(listed.scrolls.map((s: any) => s.column)).toEqual([0, 1]);
  });

  test('interleaved writes to two scrolls never cross bands', async ({ page }) => {
    const left = await runBridge(page, 'create_scroll', { title: 'Findings' });
    const right = await runBridge(page, 'create_scroll', { title: 'Open questions' });

    // Deliberately alternating — the isolation must not depend on batching.
    await runBridge(page, 'append_block', { markdown: 'A1', scrollId: left.scrollId });
    await runBridge(page, 'append_block', { markdown: 'B1', scrollId: right.scrollId });
    await runBridge(page, 'append_block', { markdown: 'A2', scrollId: left.scrollId });
    await runBridge(page, 'append_block', { markdown: 'B2', scrollId: right.scrollId });

    const content = await runBridge(page, 'read_page');
    const textOf = (id: string) =>
      content.blocks.filter((b: any) => b.scrollId === id).map((b: any) => b.markdown);

    expect(textOf(left.scrollId)).toEqual(['A1', 'A2']);
    expect(textOf(right.scrollId)).toEqual(['B1', 'B2']);
  });

  test('each scroll stacks from its own top, independent of its neighbour', async ({ page }) => {
    const right = await runBridge(page, 'create_scroll', { title: 'Short' });

    // Fill the default scroll first; the new one must still start at the top.
    await runBridge(page, 'append_block', { markdown: 'long one\n\nwith paragraphs\n\nand more' });
    await runBridge(page, 'append_block', { markdown: 'another long block' });
    const placed = await runBridge(page, 'append_block', {
      markdown: 'starts at the top',
      scrollId: right.scrollId,
    });

    expect(placed.scrollId).toBe(right.scrollId);
    expect(placed.column).toBe(right.column);

    const nodes = await page.evaluate(
      () => (window as any).__POWERNOTE_STORES__.canvas.getState().nodes,
    );
    const placedNode = nodes.find((n: any) => n.id === placed.blockId);
    const leftNodes = nodes.filter((n: any) => n.x === columnX(0));

    expect(placedNode.x).toBe(columnX(right.column));
    expect(placedNode.y).toBeLessThan(Math.max(...leftNodes.map((n: any) => n.y)));
  });

  test('a stale scrollId fails loudly instead of writing somewhere else', async ({ page }) => {
    await runBridge(page, 'create_scroll', { title: 'Findings' });

    const err = await runBridgeExpectingError(page, 'append_block', {
      markdown: 'orphan',
      scrollId: 'no-such-scroll',
    });

    expect(err.code).toBe('NOT_FOUND');
    expect(err.message).toContain('list_scrolls');
    // Nothing was written — a rejected target must not silently fall back to 0.
    const content = await runBridge(page, 'read_page');
    expect(content.blocks.map((b: any) => b.markdown)).not.toContain('orphan');
  });

  test('rename_scroll retitles the band and read_page reflects it', async ({ page }) => {
    const created = await runBridge(page, 'create_scroll', { title: 'Draft' });

    const renamed = await runBridge(page, 'rename_scroll', {
      scrollId: created.scrollId,
      title: 'Decisions',
    });
    expect(renamed.previousTitle).toBe('Draft');

    const content = await runBridge(page, 'read_page');
    const target = content.scrolls.find((s: any) => s.scrollId === created.scrollId);
    expect(target.title).toBe('Decisions');
  });

  test('the legacy column param still targets a band', async ({ page }) => {
    const placed = await runBridge(page, 'append_block', { markdown: 'legacy', column: 1 });
    expect(placed.column).toBe(1);

    const nodes = await page.evaluate(
      () => (window as any).__POWERNOTE_STORES__.canvas.getState().nodes,
    );
    expect(nodes.find((n: any) => n.id === placed.blockId).x).toBe(columnX(1));
  });
});
