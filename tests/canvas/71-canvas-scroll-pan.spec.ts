/**
 * Test 71: Canvas Scroll Pan
 * Covers: scroll = vertical pan, shift+scroll = horizontal pan
 */
import { test, expect } from '@playwright/test';
import { waitForCanvasReady, getCanvasStore } from '../helpers';

test.describe('71 - Canvas Scroll Pan', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForCanvasReady(page);
  });

  test('scroll down moves viewport up (pans down)', async ({ page }) => {
    const before = await getCanvasStore(page);
    const canvas = page.locator('[data-testid="canvas-container"]');
    await canvas.hover({ position: { x: 400, y: 300 } });
    await page.mouse.wheel(0, 100); // deltaY = 100 (scroll down)
    await page.waitForTimeout(200);
    const after = await getCanvasStore(page);
    // Viewport y should decrease (canvas moves up = pan down)
    expect(after.viewport.y).toBeLessThan(before.viewport.y);
  });

  test('scroll up moves viewport down (pans up)', async ({ page }) => {
    const before = await getCanvasStore(page);
    const canvas = page.locator('[data-testid="canvas-container"]');
    await canvas.hover({ position: { x: 400, y: 300 } });
    await page.mouse.wheel(0, -100); // deltaY = -100 (scroll up)
    await page.waitForTimeout(200);
    const after = await getCanvasStore(page);
    expect(after.viewport.y).toBeGreaterThan(before.viewport.y);
  });

  test('shift+scroll moves viewport horizontally', async ({ page }) => {
    const before = await getCanvasStore(page);
    const canvas = page.locator('[data-testid="canvas-container"]');
    await canvas.hover({ position: { x: 400, y: 300 } });
    // Shift+scroll = horizontal pan
    await page.keyboard.down('Shift');
    await page.mouse.wheel(0, 100); // With shift, deltaY maps to horizontal
    await page.keyboard.up('Shift');
    await page.waitForTimeout(200);
    const after = await getCanvasStore(page);
    // Viewport x should change, y should stay roughly the same
    expect(after.viewport.x).not.toBe(before.viewport.x);
  });
});
