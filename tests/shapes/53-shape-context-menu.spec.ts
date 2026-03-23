/**
 * Test 53: Shape Context Menu
 * Covers: REQ-SHAPE-014 — Right-click context menu with layer controls
 *
 * Verifies that right-clicking a shape node shows the context menu with
 * Copy, Duplicate, Delete actions and the 5-layer z-index selector.
 */
import { test, expect } from '@playwright/test';
import { waitForCanvasReady, getCanvasStore } from '../helpers';

/** Helper: add a shape node via the store */
async function addShapeNode(page: import('@playwright/test').Page, id: string) {
  await page.evaluate((nodeId) => {
    const stores = (window as any).__POWERNOTE_STORES__;
    stores.canvas.getState().addNode({
      id: nodeId,
      type: 'shape',
      x: 300,
      y: 300,
      width: 120,
      height: 80,
      layer: 3,
      data: {
        shapeType: 'rect',
        fill: '#dbeafe',
        stroke: '#2563eb',
        strokeWidth: 2,
        strokeDash: [],
      },
    });
  }, id);
}

test.describe('53 - Shape Context Menu (REQ-SHAPE-014)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForCanvasReady(page);
  });

  test('right-clicking a shape shows the context menu', async ({ page }) => {
    await addShapeNode(page, 'ctx-shape-1');

    // Right-click on the shape area
    const canvas = page.locator('[data-testid="canvas-container"] canvas').last();
    await canvas.click({ position: { x: 360, y: 340 }, button: 'right' });
    await page.waitForTimeout(300);

    await expect(page.locator('[data-testid="context-menu"]')).toBeVisible();
  });

  test('context menu has layer buttons 1-5 (REQ-SHAPE-014)', async ({ page }) => {
    await addShapeNode(page, 'ctx-shape-2');

    const canvas = page.locator('[data-testid="canvas-container"] canvas').last();
    await canvas.click({ position: { x: 360, y: 340 }, button: 'right' });
    await page.waitForTimeout(300);

    for (let layer = 1; layer <= 5; layer++) {
      await expect(page.locator(`[data-testid="layer-${layer}"]`)).toBeVisible();
    }
  });

  test('changing layer via context menu updates the node', async ({ page }) => {
    await addShapeNode(page, 'ctx-shape-3');

    // Verify initial layer is 3
    let store = await getCanvasStore(page);
    expect(store.nodes[0].layer).toBe(3);

    // Right-click and change to layer 5
    const canvas = page.locator('[data-testid="canvas-container"] canvas').last();
    await canvas.click({ position: { x: 360, y: 340 }, button: 'right' });
    await page.waitForTimeout(300);

    await page.click('[data-testid="layer-5"]');
    await page.waitForTimeout(200);

    store = await getCanvasStore(page);
    expect(store.nodes[0].layer).toBe(5);
  });

  test('context menu closes on Escape', async ({ page }) => {
    await addShapeNode(page, 'ctx-shape-4');

    const canvas = page.locator('[data-testid="canvas-container"] canvas').last();
    await canvas.click({ position: { x: 360, y: 340 }, button: 'right' });
    await page.waitForTimeout(300);
    await expect(page.locator('[data-testid="context-menu"]')).toBeVisible();

    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
    await expect(page.locator('[data-testid="context-menu"]')).not.toBeVisible();
  });

  test('delete from context menu removes the shape', async ({ page }) => {
    await addShapeNode(page, 'ctx-shape-5');

    let store = await getCanvasStore(page);
    expect(store.nodes).toHaveLength(1);

    const canvas = page.locator('[data-testid="canvas-container"] canvas').last();
    await canvas.click({ position: { x: 360, y: 340 }, button: 'right' });
    await page.waitForTimeout(300);

    // Click Delete in context menu
    await page.locator('[data-testid="context-menu"] .context-menu__item--danger').click();
    await page.waitForTimeout(200);

    store = await getCanvasStore(page);
    expect(store.nodes).toHaveLength(0);
  });
});
