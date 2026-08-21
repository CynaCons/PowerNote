/**
 * Test 186: scroll widths are user/agent resizable, persistent and undoable.
 * Covers: REQ-HIER-024, REQ-HIER-025, REQ-SCROLL-031, REQ-AGENT-071
 */
import { test, expect, type Page } from '@playwright/test';
import { runBridge, runBridgeExpectingError, stubBridgeUrl, waitForBridgeReady, waitForCanvasReady } from '../helpers';

async function seedTwoScrolls(page: Page) {
  return page.evaluate(async () => {
    const layout = await import('/src/utils/pageLayout.ts');
    const stores = (window as any).__POWERNOTE_STORES__;
    const ws = stores.workspace.getState();
    const pageId = ws.activePageId;
    const first = ws.getActivePage().scrolls[0];
    ws.renameScroll(pageId, first.id, 'Backend');
    const second = ws.createScroll(pageId, 'Frontend');
    const scrolls = ws.getActivePage().scrolls;
    const rightX = layout.columnLeft(1, scrolls);
    stores.canvas.getState().addNode({
      id: 'right-block',
      type: 'text',
      x: rightX,
      y: 80,
      width: 220,
      height: 40,
      layer: 2,
      data: { text: 'Frontend', fontSize: 16, fontFamily: 'Inter', fontStyle: 'normal', fill: '#14181a' },
    });
    return { pageId, firstId: first.id, secondId: second.id, rightX, defaultWidth: layout.A4_WIDTH };
  });
}

async function dragFirstResizeHandle(page: Page, delta: number) {
  const point = await page.evaluate(() => {
    const stage = (window as any).Konva?.stages?.[0];
    const handle = stage?.find('.scroll-resize-handle')?.[0];
    if (!handle) throw new Error('scroll resize handle not rendered');
    const rect = handle.getClientRect();
    const box = stage.container().getBoundingClientRect();
    return { x: box.left + rect.x + rect.width / 2, y: box.top + rect.y + rect.height / 2 };
  });
  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  await page.mouse.move(point.x + delta, point.y, { steps: 6 });
  await page.mouse.up();
}

test.describe('186 - Resize scroll width (REQ-HIER-024/025, REQ-SCROLL-031, REQ-AGENT-071)', () => {
  test.beforeEach(async ({ page }) => {
    await stubBridgeUrl(page);
    await page.goto('/');
    await waitForCanvasReady(page);
    await waitForBridgeReady(page);
  });

  test('header drag commits once, shifts the right band, and one undo restores all geometry', async ({ page }) => {
    const seeded = await seedTwoScrolls(page);
    await page.waitForFunction(() => (window as any).Konva.stages[0].find('.scroll-resize-handle').length === 2);

    await dragFirstResizeHandle(page, 120);

    const changed = await page.evaluate(async ({ firstId }) => {
      const layout = await import('/src/utils/pageLayout.ts');
      const stores = (window as any).__POWERNOTE_STORES__;
      const scrolls = stores.workspace.getState().getActivePage().scrolls;
      return {
        width: scrolls.find((scroll: any) => scroll.id === firstId).width,
        rightX: stores.canvas.getState().nodes.find((node: any) => node.id === 'right-block').x,
        columnLeft: layout.columnLeft(1, scrolls),
      };
    }, seeded);

    expect(changed.width).toBeCloseTo(seeded.defaultWidth + 120, 0);
    expect(changed.rightX).toBeCloseTo(seeded.rightX + 120, 0);
    expect(changed.columnLeft).toBeCloseTo(seeded.rightX + 120, 0);

    await page.keyboard.press('Control+z');
    const restored = await page.evaluate(async ({ firstId }) => {
      const layout = await import('/src/utils/pageLayout.ts');
      const stores = (window as any).__POWERNOTE_STORES__;
      const scrolls = stores.workspace.getState().getActivePage().scrolls;
      return {
        storedWidth: scrolls.find((scroll: any) => scroll.id === firstId).width ?? null,
        rightX: stores.canvas.getState().nodes.find((node: any) => node.id === 'right-block').x,
        columnLeft: layout.columnLeft(1, scrolls),
      };
    }, seeded);
    expect(restored.storedWidth).toBeNull();
    expect(restored.rightX).toBeCloseTo(seeded.rightX, 5);
    expect(restored.columnLeft).toBeCloseTo(seeded.rightX, 5);
  });

  test('double-clicking the handle resets to an absent default width', async ({ page }) => {
    const seeded = await seedTwoScrolls(page);
    await runBridge(page, 'resize_scroll', { scrollId: seeded.firstId, width: 1000 });
    await page.waitForFunction(() => (window as any).Konva.stages[0].find('.scroll-resize-handle').length === 2);

    const point = await page.evaluate(() => {
      const stage = (window as any).Konva.stages[0];
      const rect = stage.find('.scroll-resize-handle')[0].getClientRect();
      const box = stage.container().getBoundingClientRect();
      return { x: box.left + rect.x + rect.width / 2, y: box.top + rect.y + rect.height / 2 };
    });
    await page.mouse.dblclick(point.x, point.y);

    const reset = await page.evaluate(({ firstId }) => {
      const stores = (window as any).__POWERNOTE_STORES__;
      return stores.workspace.getState().getActivePage().scrolls.find((scroll: any) => scroll.id === firstId).width ?? null;
    }, seeded);
    expect(reset).toBeNull();
  });

  test('resize_scroll clamps and list_scrolls reports width; unknown ids fail loudly', async ({ page }) => {
    const seeded = await seedTwoScrolls(page);
    const max = await page.evaluate(async () => (await import('/src/utils/pageLayout.ts')).MAX_SCROLL_WIDTH);
    const result = await runBridge(page, 'resize_scroll', { scrollId: seeded.firstId, width: 99999 });
    expect(result.requestedWidth).toBe(99999);
    expect(result.width).toBe(max);
    expect(result.delta).toBe(max - seeded.defaultWidth);

    const listed = await runBridge(page, 'list_scrolls');
    expect(listed.scrolls.find((scroll: any) => scroll.scrollId === seeded.firstId).width).toBe(max);

    const error = await runBridgeExpectingError(page, 'resize_scroll', { scrollId: 'missing', width: 900 });
    expect(error.code).toBe('NOT_FOUND');
  });
});
