/**
 * Test 10: Toolbar Show
 * Covers: REQ-TOOL-001 — Bottom toolbar visibility follows context
 * (text tool active or text node selected)
 *
 * Verifies that the bottom toolbar is hidden by default, visible when the
 * text tool is active, hidden again when deactivated, and visible when
 * a text node is selected.
 */
import { test, expect } from '@playwright/test';
import { waitForCanvasReady, clickCanvas, activateTool } from '../helpers';

test.describe('10 - Toolbar Show (REQ-TOOL-001)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForCanvasReady(page);
  });

  test('bottom toolbar is NOT visible initially (select tool, no selection)', async ({ page }) => {
    const toolbar = page.locator('[data-testid="bottom-toolbar"]');
    await expect(toolbar).not.toBeVisible();
  });

  test('activating text tool shows the bottom toolbar', async ({ page }) => {
    const toolbar = page.locator('[data-testid="bottom-toolbar"]');

    // Activate text tool
    await activateTool(page, 'text');

    await expect(toolbar).toBeVisible();
  });

  test('deactivating text tool hides the bottom toolbar', async ({ page }) => {
    const toolbar = page.locator('[data-testid="bottom-toolbar"]');

    // Activate text tool
    await activateTool(page, 'text');
    await expect(toolbar).toBeVisible();

    // Deactivate text tool (click it again to toggle)
    await activateTool(page, 'text');
    await expect(toolbar).not.toBeVisible();
  });

  test('selecting a text node shows the bottom toolbar', async ({ page }) => {
    const toolbar = page.locator('[data-testid="bottom-toolbar"]');

    // Place and commit a text node
    await activateTool(page, 'text');
    await clickCanvas(page, 400, 300);

    const textarea = page.locator('textarea');
    await expect(textarea).toBeVisible({ timeout: 2000 });

    await textarea.fill('Toolbar test');
    await page.evaluate(() => (document.activeElement as HTMLElement)?.blur());
    await page.waitForTimeout(300);

    // Deactivate text tool — switch to select mode
    await activateTool(page, 'text');
    await page.waitForTimeout(100);

    // Deselect by clicking an empty part of the canvas
    await clickCanvas(page, 200, 200);
    await page.waitForTimeout(200);

    // Toolbar should be hidden (no tool, no selection)
    await expect(toolbar).not.toBeVisible();

    // Click on the text node to select it (slightly right and down from its origin
    // to ensure we hit inside the text bounding box, not on the edge)
    await clickCanvas(page, 420, 310);
    await page.waitForTimeout(200);

    // Toolbar should be visible because a text node is selected
    await expect(toolbar).toBeVisible();
  });
});
