// Covers: REQ-IMAGE-017, REQ-IMAGE-018
/**
 * Test 168: Image Mini state
 * Toggle Mini via the ImageToolbar, remembered miniWidth, restore full-size
 * dims, clamp, and save/load round-trip.
 */
import { test, expect } from '@playwright/test';
import { waitForCanvasReady, getCanvasStore } from '../helpers';

// 1x1 red pixel PNG as base64
const RED_PIXEL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';

const FULL_W = 400;
const FULL_H = 300;
const DEFAULT_MINI = 160;

async function addAndSelectImage(page: import('@playwright/test').Page, id = 'test-img-mini') {
  await page.evaluate(
    ({ src, id, width, height }) => {
      const stores = (window as any).__POWERNOTE_STORES__;
      stores.canvas.getState().addNode({
        id,
        type: 'image',
        x: 200,
        y: 200,
        width,
        height,
        data: { src, alt: 'mini-test', naturalWidth: width, naturalHeight: height },
      });
      stores.canvas.getState().selectNode(id, false);
    },
    { src: RED_PIXEL, id, width: FULL_W, height: FULL_H },
  );
}

test.describe('168 - Image Mini state (REQ-IMAGE-017, REQ-IMAGE-018)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForCanvasReady(page);
  });

  test('toggle mini ON: width 160, aspect-locked, full dims stashed', async ({ page }) => {
    await addAndSelectImage(page);
    const toggle = page.locator('[data-testid="image-mini-toggle"]');
    await expect(toggle).toBeVisible();
    await toggle.click();

    const store = await getCanvasStore(page);
    const node = store.nodes[0];
    expect(node.width).toBe(DEFAULT_MINI);
    expect(node.height).toBe(DEFAULT_MINI * (FULL_H / FULL_W));
    expect(node.data.mini).toBe(true);
    expect(node.data.fullWidth).toBe(FULL_W);
    expect(node.data.fullHeight).toBe(FULL_H);
    await expect(toggle).toHaveClass(/text-toolbar__btn--active/);
  });

  test('selection transformer follows an external resize (mini toggle)', async ({ page }) => {
    // The Transformer caches its box against changes it did not initiate; a
    // store-side resize (the Mini toggle) left a stale full-size frame until
    // the next-frame forceUpdate in SelectionTransformer. Found in v0.63.0
    // showcase capture; asserted here via Konva's stage registry. A single
    // image no longer attaches at all (REQ-IMAGE-024, T173), so the external
    // resize is exercised through a two-image multi-selection.
    await addAndSelectImage(page, 'mini-a');
    await addAndSelectImage(page, 'mini-b');
    await page.evaluate(() => {
      const stores = (window as any).__POWERNOTE_STORES__;
      stores.canvas.getState().selectNode('mini-a', false);
      stores.canvas.getState().selectNode('mini-b', true);
    });
    await page.locator('[data-testid="image-mini-toggle"]').click();
    await page.waitForTimeout(150); // recompute is deferred one animation frame

    const tr = await page.evaluate(() => {
      const stage = (window as any).Konva.stages[0];
      const t = stage.findOne('Transformer');
      return { w: t.width(), attached: t.nodes().length };
    });
    expect(tr.attached).toBe(2);
    // Both images sit at x=200 and are 160 wide when mini — the union box is
    // ~160 plus chrome. Anything near the old 400-wide frame means stale.
    expect(tr.w).toBeLessThan(240);
    expect(tr.w).toBeGreaterThan(140);
  });

  test('toggle mini OFF restores exact prior display dims', async ({ page }) => {
    await addAndSelectImage(page);
    const toggle = page.locator('[data-testid="image-mini-toggle"]');
    await expect(toggle).toBeVisible();
    await toggle.click();
    await toggle.click();

    const store = await getCanvasStore(page);
    const node = store.nodes[0];
    expect(node.width).toBe(FULL_W);
    expect(node.height).toBe(FULL_H);
    expect(node.data.mini).toBe(false);
    expect(node.data.fullWidth).toBeUndefined();
    expect(node.data.fullHeight).toBeUndefined();
  });

  test('resize while mini writes miniWidth; re-toggle returns to it', async ({ page }) => {
    await addAndSelectImage(page);
    const toggle = page.locator('[data-testid="image-mini-toggle"]');
    await expect(toggle).toBeVisible();
    await toggle.click();

    const resizedW = 200;
    const resizedH = resizedW * (FULL_H / FULL_W);
    await page.evaluate(({ width, height }) => {
      const stores = (window as any).__POWERNOTE_STORES__;
      const node = stores.canvas.getState().nodes[0];
      stores.canvas.getState().updateNode(node.id, { width, height });
    }, { width: resizedW, height: resizedH });

    let store = await getCanvasStore(page);
    expect(store.nodes[0].data.miniWidth).toBe(resizedW);
    expect(store.nodes[0].width).toBe(resizedW);
    expect(store.nodes[0].data.fullWidth).toBe(FULL_W);
    expect(store.nodes[0].data.fullHeight).toBe(FULL_H);

    await toggle.click(); // OFF
    store = await getCanvasStore(page);
    expect(store.nodes[0].width).toBe(FULL_W);
    expect(store.nodes[0].height).toBe(FULL_H);
    expect(store.nodes[0].data.miniWidth).toBe(resizedW);

    await toggle.click(); // ON again
    store = await getCanvasStore(page);
    expect(store.nodes[0].width).toBe(resizedW);
    expect(store.nodes[0].height).toBe(resizedH);
    expect(store.nodes[0].data.mini).toBe(true);
  });

  test('mini state and miniWidth survive save/load round-trip', async ({ page }) => {
    await addAndSelectImage(page);
    const toggle = page.locator('[data-testid="image-mini-toggle"]');
    await expect(toggle).toBeVisible();
    await toggle.click();

    const resizedW = 220;
    const resizedH = resizedW * (FULL_H / FULL_W);
    await page.evaluate(({ width, height }) => {
      const stores = (window as any).__POWERNOTE_STORES__;
      const node = stores.canvas.getState().nodes[0];
      stores.canvas.getState().updateNode(node.id, { width, height });
      stores.workspace.getState().savePageNodes(stores.canvas.getState().nodes);
      stores.canvas.getState().loadPageNodes([]);
    }, { width: resizedW, height: resizedH });

    let store = await getCanvasStore(page);
    expect(store.nodes).toHaveLength(0);

    await page.evaluate(() => {
      const stores = (window as any).__POWERNOTE_STORES__;
      const ws = stores.workspace.getState();
      const activePage = ws.getActivePage();
      stores.canvas.getState().loadPageNodes(activePage.nodes);
    });

    store = await getCanvasStore(page);
    expect(store.nodes).toHaveLength(1);
    const node = store.nodes[0];
    expect(node.data.mini).toBe(true);
    expect(node.data.miniWidth).toBe(resizedW);
    expect(node.width).toBe(resizedW);
    expect(node.height).toBe(resizedH);
    expect(node.data.fullWidth).toBe(FULL_W);
    expect(node.data.fullHeight).toBe(FULL_H);
  });

  test('miniWidth clamps: 20 → 48, 900 → 480', async ({ page }) => {
    await addAndSelectImage(page);
    const toggle = page.locator('[data-testid="image-mini-toggle"]');
    await expect(toggle).toBeVisible();
    await toggle.click();

    await page.evaluate(() => {
      const stores = (window as any).__POWERNOTE_STORES__;
      const node = stores.canvas.getState().nodes[0];
      const aspect = node.height / node.width;
      stores.canvas.getState().updateNode(node.id, { width: 20, height: 20 * aspect });
    });

    let store = await getCanvasStore(page);
    expect(store.nodes[0].width).toBe(48);
    expect(store.nodes[0].data.miniWidth).toBe(48);
    expect(store.nodes[0].height).toBeCloseTo(48 * (FULL_H / FULL_W), 5);

    await page.evaluate(() => {
      const stores = (window as any).__POWERNOTE_STORES__;
      const node = stores.canvas.getState().nodes[0];
      const aspect = node.height / node.width;
      stores.canvas.getState().updateNode(node.id, { width: 900, height: 900 * aspect });
    });

    store = await getCanvasStore(page);
    expect(store.nodes[0].width).toBe(480);
    expect(store.nodes[0].data.miniWidth).toBe(480);
    expect(store.nodes[0].height).toBeCloseTo(480 * (FULL_H / FULL_W), 5);
  });
});
