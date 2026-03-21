/**
 * Test 07: Hierarchy Toggle
 * Covers: REQ-HIER-002, REQ-HIER-003 — Toggle the hierarchy panel open and
 * closed by clicking the NavRail hierarchy button
 *
 * Verifies that the hierarchy panel is hidden by default and can be toggled
 * by clicking the nav-hierarchy button.
 */
import { test, expect } from '@playwright/test';
import { waitForCanvasReady, activateTool } from '../helpers';

test.describe('07 - Hierarchy Toggle (REQ-HIER-002, REQ-HIER-003)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForCanvasReady(page);
  });

  test('hierarchy panel is hidden by default', async ({ page }) => {
    const panel = page.locator('[data-testid="hierarchy-panel"]');
    await expect(panel).not.toBeVisible();
  });

  test('clicking hierarchy button opens the panel', async ({ page }) => {
    const panel = page.locator('[data-testid="hierarchy-panel"]');
    await expect(panel).not.toBeVisible();

    // Click the hierarchy toggle button
    await activateTool(page, 'hierarchy');

    await expect(panel).toBeVisible();
  });

  test('clicking hierarchy button again closes the panel', async ({ page }) => {
    const panel = page.locator('[data-testid="hierarchy-panel"]');

    // Open
    await activateTool(page, 'hierarchy');
    await expect(panel).toBeVisible();

    // Close
    await activateTool(page, 'hierarchy');
    await expect(panel).not.toBeVisible();
  });
});
