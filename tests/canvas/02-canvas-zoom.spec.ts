/**
 * Test 02: Canvas Zoom
 * Covers: REQ-CANVAS-003, REQ-CANVAS-004 — Ctrl+wheel zoom changes scale,
 * scale is clamped within [0.1, 5.0]
 *
 * Verifies that Ctrl+wheel events change the viewport scale in the canvas store
 * and that the scale stays within allowed bounds.
 */
import { test, expect } from '@playwright/test';
import { getCanvasStore, waitForCanvasReady } from '../helpers';

test.describe('02 - Canvas Zoom (REQ-CANVAS-003, REQ-CANVAS-004)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForCanvasReady(page);
  });

  test('initial scale is 1', async ({ page }) => {
    const store = await getCanvasStore(page);
    expect(store.viewport.scale).toBe(1);
  });

  test('Ctrl+wheel zoom in increases scale', async ({ page }) => {
    const canvas = page.locator('[data-testid="canvas-container"] canvas').last();
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();

    const centerX = box!.x + box!.width / 2;
    const centerY = box!.y + box!.height / 2;

    // Hold Ctrl, then wheel to zoom in (negative deltaY = zoom in)
    await page.mouse.move(centerX, centerY);
    await page.keyboard.down('Control');
    await page.mouse.wheel(0, -100);
    await page.keyboard.up('Control');

    await page.waitForTimeout(200);

    const store = await getCanvasStore(page);
    expect(store.viewport.scale).toBeGreaterThan(1);
  });

  test('Ctrl+wheel zoom out decreases scale', async ({ page }) => {
    const canvas = page.locator('[data-testid="canvas-container"] canvas').last();
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();

    const centerX = box!.x + box!.width / 2;
    const centerY = box!.y + box!.height / 2;

    // Hold Ctrl, then wheel to zoom out (positive deltaY = zoom out)
    await page.mouse.move(centerX, centerY);
    await page.keyboard.down('Control');
    await page.mouse.wheel(0, 100);
    await page.keyboard.up('Control');

    await page.waitForTimeout(200);

    const store = await getCanvasStore(page);
    expect(store.viewport.scale).toBeLessThan(1);
  });

  test('scale is clamped within [0.1, 5.0]', async ({ page }) => {
    const canvas = page.locator('[data-testid="canvas-container"] canvas').last();
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();

    const centerX = box!.x + box!.width / 2;
    const centerY = box!.y + box!.height / 2;

    // Zoom out aggressively (many scroll events)
    await page.mouse.move(centerX, centerY);
    await page.keyboard.down('Control');
    for (let i = 0; i < 50; i++) {
      await page.mouse.wheel(0, 200);
    }
    await page.keyboard.up('Control');
    await page.waitForTimeout(300);

    let store = await getCanvasStore(page);
    expect(store.viewport.scale).toBeGreaterThanOrEqual(0.1);

    // Zoom in aggressively
    await page.keyboard.down('Control');
    for (let i = 0; i < 100; i++) {
      await page.mouse.wheel(0, -200);
    }
    await page.keyboard.up('Control');
    await page.waitForTimeout(300);

    store = await getCanvasStore(page);
    expect(store.viewport.scale).toBeLessThanOrEqual(5.0);
  });
});
