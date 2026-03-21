/**
 * Test 14: Hierarchy Rename Page
 * Covers: REQ-HIER-009 — Rename a page via inline edit in the
 * hierarchy panel
 *
 * Verifies that clicking the rename button on a page shows a rename
 * input, typing a new name and pressing Enter updates the page title
 * in the panel and the breadcrumb.
 */
import { test, expect } from '@playwright/test';
import { getWorkspaceStore, waitForCanvasReady, activateTool } from '../helpers';

test.describe('14 - Hierarchy Rename Page (REQ-HIER-009)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForCanvasReady(page);
  });

  test('clicking rename-page-btn shows rename input', async ({ page }) => {
    // Open hierarchy panel
    await activateTool(page, 'hierarchy');
    await expect(page.locator('[data-testid="hierarchy-panel"]')).toBeVisible();

    // Click the rename page button (force click to bypass hover visibility)
    await page.locator('[data-testid="rename-page-btn"]').first().click({ force: true });

    // Rename input should appear
    const renameInput = page.locator('[data-testid="page-rename-input"]');
    await expect(renameInput).toBeVisible({ timeout: 2000 });
  });

  test('typing a new name and pressing Enter renames the page', async ({ page }) => {
    // Open hierarchy panel
    await activateTool(page, 'hierarchy');
    await expect(page.locator('[data-testid="hierarchy-panel"]')).toBeVisible();

    // Click the rename page button
    await page.locator('[data-testid="rename-page-btn"]').first().click({ force: true });

    const renameInput = page.locator('[data-testid="page-rename-input"]');
    await expect(renameInput).toBeVisible({ timeout: 2000 });

    // Clear and type new name
    await renameInput.fill('My Custom Page');
    await renameInput.press('Enter');
    await page.waitForTimeout(200);

    // Verify store updated
    const ws = await getWorkspaceStore(page);
    expect(ws.workspace.sections[0].pages[0].title).toBe('My Custom Page');
  });

  test('breadcrumb updates after renaming the active page', async ({ page }) => {
    // Open hierarchy panel
    await activateTool(page, 'hierarchy');
    await expect(page.locator('[data-testid="hierarchy-panel"]')).toBeVisible();

    // Verify initial breadcrumb
    await expect(page.locator('[data-testid="topbar-page"]')).toHaveText('Page 1');

    // Click the rename page button
    await page.locator('[data-testid="rename-page-btn"]').first().click({ force: true });

    const renameInput = page.locator('[data-testid="page-rename-input"]');
    await expect(renameInput).toBeVisible({ timeout: 2000 });

    await renameInput.fill('Renamed Page');
    await renameInput.press('Enter');
    await page.waitForTimeout(200);

    // Verify breadcrumb updated
    await expect(page.locator('[data-testid="topbar-page"]')).toHaveText('Renamed Page');
  });
});
