/**
 * Test 00: Canvas Renders
 * Covers: REQ-CANVAS-001 — The app shall display an infinite canvas
 *
 * Verifies the app loads correctly with all shell components visible.
 */
import { test, expect } from '@playwright/test';
import { waitForCanvasReady } from '../helpers';

test.describe('00 - Canvas Renders (REQ-CANVAS-001)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForCanvasReady(page);
  });

  test('app shell renders with all components', async ({ page }) => {
    // App shell exists
    await expect(page.locator('[data-testid="app-shell"]')).toBeVisible();

    // Nav rail with tool buttons
    await expect(page.locator('[data-testid="nav-rail"]')).toBeVisible();
    await expect(page.locator('[data-testid="nav-hierarchy"]')).toBeVisible();
    await expect(page.locator('[data-testid="nav-text-tool"]')).toBeVisible();
    await expect(page.locator('[data-testid="nav-draw-tool"]')).toBeVisible();

    // Top bar with breadcrumb
    await expect(page.locator('[data-testid="topbar"]')).toBeVisible();
    await expect(page.locator('[data-testid="topbar-filename"]')).toHaveText('Untitled Notebook');
    await expect(page.locator('[data-testid="topbar-section"]')).toHaveText('Section 1');
    await expect(page.locator('[data-testid="topbar-page"]')).toHaveText('Page 1');

    // Canvas container with Konva canvas element
    await expect(page.locator('[data-testid="canvas-container"]')).toBeVisible();
    await expect(page.locator('[data-testid="canvas-container"] canvas').last()).toBeVisible();
  });

  test('canvas has non-zero dimensions', async ({ page }) => {
    const canvas = page.locator('[data-testid="canvas-container"] canvas').last();
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThan(100);
    expect(box!.height).toBeGreaterThan(100);
  });

  test('draw tool is disabled', async ({ page }) => {
    await expect(page.locator('[data-testid="nav-draw-tool"]')).toBeDisabled();
  });
});
