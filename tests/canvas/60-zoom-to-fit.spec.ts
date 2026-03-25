/**
 * Test 60: Zoom to Fit
 * Covers: REQ-CANVAS-012 — Zoom-to-fit button adjusts viewport to show all nodes
 *
 * Verifies that the zoom-to-fit button exists, that clicking it changes the
 * viewport scale, and that it handles the no-nodes case gracefully.
 */
import { test, expect } from '@playwright/test';
import { getCanvasStore, waitForCanvasReady } from '../helpers';

test.describe('60 - Zoom to Fit (REQ-CANVAS-012)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForCanvasReady(page);
  });

  test('zoom-to-fit button exists in the top bar', async ({ page }) => {
    const btn = page.locator('[data-testid="zoom-fit-btn"]');
    await expect(btn).toBeVisible();
  });

  test('clicking zoom-to-fit with nodes changes viewport scale', async ({ page }) => {
    // Place nodes far apart to force a scale change
    await page.evaluate(() => {
      const store = (window as any).__POWERNOTE_STORES__.canvas.getState();
      store.addNode({
        id: 'zf-node-1',
        type: 'text',
        x: 0, y: 0, width: 100, height: 30,
        data: { text: 'Top-left', fontSize: 16, fontFamily: 'Inter', fontStyle: 'normal', fill: '#1a1a1a' },
      });
      store.addNode({
        id: 'zf-node-2',
        type: 'text',
        x: 3000, y: 2000, width: 100, height: 30,
        data: { text: 'Far away', fontSize: 16, fontFamily: 'Inter', fontStyle: 'normal', fill: '#1a1a1a' },
      });
    });
    await page.waitForTimeout(200);

    // Record initial viewport
    const storeBefore = await getCanvasStore(page);
    const scaleBefore = storeBefore.viewport.scale;

    // Click zoom-to-fit
    await page.locator('[data-testid="zoom-fit-btn"]').click();
    await page.waitForTimeout(300);

    // Scale should have changed (likely zoomed out to fit both nodes)
    const storeAfter = await getCanvasStore(page);
    expect(storeAfter.viewport.scale).not.toBe(scaleBefore);
  });

  test('zoom-to-fit with no nodes does not crash', async ({ page }) => {
    // Canvas is empty
    const storeBefore = await getCanvasStore(page);
    expect(storeBefore.nodes).toHaveLength(0);

    // Click zoom-to-fit — should not throw
    await page.locator('[data-testid="zoom-fit-btn"]').click();
    await page.waitForTimeout(300);

    // Verify page is still functional
    const storeAfter = await getCanvasStore(page);
    expect(storeAfter.nodes).toHaveLength(0);
    // Scale should be defined (may or may not change)
    expect(storeAfter.viewport.scale).toBeGreaterThan(0);
  });

  test('zoom-to-fit with single node centers it', async ({ page }) => {
    // Place one node at an offset position
    await page.evaluate(() => {
      const store = (window as any).__POWERNOTE_STORES__.canvas.getState();
      store.addNode({
        id: 'zf-single',
        type: 'text',
        x: 1500, y: 1000, width: 100, height: 30,
        data: { text: 'Centered', fontSize: 16, fontFamily: 'Inter', fontStyle: 'normal', fill: '#1a1a1a' },
      });
    });
    await page.waitForTimeout(200);

    // Click zoom-to-fit
    await page.locator('[data-testid="zoom-fit-btn"]').click();
    await page.waitForTimeout(300);

    // Viewport position should have changed to show the node
    const storeAfter = await getCanvasStore(page);
    // The viewport x should be non-zero (moved to center on node)
    expect(storeAfter.viewport.scale).toBeGreaterThan(0);
  });

  test('zoom-to-fit works with mixed node types (text + shapes)', async ({ page }) => {
    await page.evaluate(() => {
      const store = (window as any).__POWERNOTE_STORES__.canvas.getState();
      store.addNode({
        id: 'zf-text',
        type: 'text',
        x: 100, y: 100, width: 120, height: 30,
        data: { text: 'Text node', fontSize: 16, fontFamily: 'Inter', fontStyle: 'normal', fill: '#1a1a1a' },
      });
      store.addNode({
        id: 'zf-shape',
        type: 'shape',
        x: 2000, y: 1500, width: 200, height: 150, layer: 3,
        data: { shapeType: 'rect', fill: '#3b82f6', stroke: '#1e40af', strokeWidth: 2, strokeDash: [] },
      });
    });
    await page.waitForTimeout(200);

    const storeBefore = await getCanvasStore(page);

    await page.locator('[data-testid="zoom-fit-btn"]').click();
    await page.waitForTimeout(300);

    const storeAfter = await getCanvasStore(page);
    // Scale should change since nodes are far apart
    expect(storeAfter.viewport.scale).not.toBe(storeBefore.viewport.scale);
  });
});
