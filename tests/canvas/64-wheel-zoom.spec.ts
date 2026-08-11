/**
 * Test 64: Wheel Zoom + Scale Bounds
 * Covers: REQ-CANVAS-003, REQ-CANVAS-004 — Zoom via wheel, scale clamped [0.1, 5.0]
 *
 * Verifies that wheel zoom changes scale, and that scale stays within
 * defined bounds after aggressive zooming.
 */
import { test, expect } from '@playwright/test';
import { getCanvasStore, waitForCanvasReady } from '../helpers';

test.describe('64 - Wheel Zoom + Scale Bounds (REQ-CANVAS-003, REQ-CANVAS-004)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForCanvasReady(page);
  });

  test('wheel zoom changes scale', async ({ page }) => {
    const canvas = page.locator('[data-testid="canvas-container"] canvas').last();
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();

    const centerX = box!.x + box!.width / 2;
    const centerY = box!.y + box!.height / 2;

    // Initial scale
    let store = await getCanvasStore(page);
    expect(store.viewport.scale).toBe(1);

    // Zoom in with Ctrl+wheel
    await page.mouse.move(centerX, centerY);
    await page.keyboard.down('Control');
    await page.mouse.wheel(0, -150);
    await page.keyboard.up('Control');
    await page.waitForTimeout(200);

    store = await getCanvasStore(page);
    expect(store.viewport.scale).toBeGreaterThan(1);
  });

  test('scale stays within bounds after many zoom-ins', async ({ page }) => {
    const canvas = page.locator('[data-testid="canvas-container"] canvas').last();
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();

    const centerX = box!.x + box!.width / 2;
    const centerY = box!.y + box!.height / 2;

    // Zoom in aggressively
    await page.mouse.move(centerX, centerY);
    await page.keyboard.down('Control');
    for (let i = 0; i < 80; i++) {
      await page.mouse.wheel(0, -200);
    }
    await page.keyboard.up('Control');
    await page.waitForTimeout(300);

    const store = await getCanvasStore(page);
    expect(store.viewport.scale).toBeLessThanOrEqual(5.0);
    expect(store.viewport.scale).toBeGreaterThan(0);
  });

  test('scale stays within bounds after many zoom-outs', async ({ page }) => {
    const canvas = page.locator('[data-testid="canvas-container"] canvas').last();
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();

    const centerX = box!.x + box!.width / 2;
    const centerY = box!.y + box!.height / 2;

    // Zoom out aggressively
    await page.mouse.move(centerX, centerY);
    await page.keyboard.down('Control');
    for (let i = 0; i < 80; i++) {
      await page.mouse.wheel(0, 200);
    }
    await page.keyboard.up('Control');
    await page.waitForTimeout(300);

    const store = await getCanvasStore(page);
    expect(store.viewport.scale).toBeGreaterThanOrEqual(0.1);
    expect(store.viewport.scale).toBeLessThanOrEqual(5.0);
  });

  test('zoom in then zoom out returns near original scale', async ({ page }) => {
    const canvas = page.locator('[data-testid="canvas-container"] canvas').last();
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();

    const centerX = box!.x + box!.width / 2;
    const centerY = box!.y + box!.height / 2;

    // Zoom in 5 steps
    await page.mouse.move(centerX, centerY);
    await page.keyboard.down('Control');
    for (let i = 0; i < 5; i++) {
      await page.mouse.wheel(0, -100);
    }
    await page.keyboard.up('Control');
    await page.waitForTimeout(200);

    const storeZoomed = await getCanvasStore(page);
    expect(storeZoomed.viewport.scale).toBeGreaterThan(1);

    // Zoom out 5 steps
    await page.keyboard.down('Control');
    for (let i = 0; i < 5; i++) {
      await page.mouse.wheel(0, 100);
    }
    await page.keyboard.up('Control');
    await page.waitForTimeout(200);

    const storeBack = await getCanvasStore(page);
    // Should be approximately back to 1 (within tolerance)
    expect(storeBack.viewport.scale).toBeGreaterThan(0.8);
    expect(storeBack.viewport.scale).toBeLessThan(1.2);
  });

  test('viewport position changes with zoom', async ({ page }) => {
    const canvas = page.locator('[data-testid="canvas-container"] canvas').last();
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();

    const centerX = box!.x + box!.width / 2;
    const centerY = box!.y + box!.height / 2;

    // Record initial position
    let store = await getCanvasStore(page);
    const initialX = store.viewport.x;
    const initialY = store.viewport.y;

    // Zoom in
    await page.mouse.move(centerX, centerY);
    await page.keyboard.down('Control');
    await page.mouse.wheel(0, -200);
    await page.keyboard.up('Control');
    await page.waitForTimeout(200);

    store = await getCanvasStore(page);
    // Viewport position should shift to keep zoom centered on cursor
    const posChanged = store.viewport.x !== initialX || store.viewport.y !== initialY;
    expect(posChanged).toBe(true);
  });

  test('scale is a positive number after all operations', async ({ page }) => {
    const canvas = page.locator('[data-testid="canvas-container"] canvas').last();
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();

    const centerX = box!.x + box!.width / 2;
    const centerY = box!.y + box!.height / 2;

    // Random zoom sequence
    await page.mouse.move(centerX, centerY);
    await page.keyboard.down('Control');
    await page.mouse.wheel(0, -300); // zoom in
    await page.mouse.wheel(0, 500);  // zoom out past origin
    await page.mouse.wheel(0, -100); // zoom in a bit
    await page.keyboard.up('Control');
    await page.waitForTimeout(200);

    const store = await getCanvasStore(page);
    expect(store.viewport.scale).toBeGreaterThan(0);
    expect(typeof store.viewport.scale).toBe('number');
    expect(Number.isFinite(store.viewport.scale)).toBe(true);
  });
});
