/**
 * Test 12: Hierarchy Rename Section
 * Covers: REQ-HIER-007 — Rename a section via inline edit in the
 * hierarchy panel
 *
 * Verifies that double-clicking a section title opens a rename input,
 * typing a new name and pressing Enter updates the section title
 * in the panel and the breadcrumb.
 */
import { test, expect } from '@playwright/test';
import { getWorkspaceStore, waitForCanvasReady, activateTool } from '../helpers';

test.describe('12 - Hierarchy Rename Section (REQ-HIER-007)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForCanvasReady(page);
  });

  test('double-clicking section title shows rename input', async ({ page }) => {
    // Open hierarchy panel
    await activateTool(page, 'hierarchy');
    await expect(page.locator('[data-testid="hierarchy-panel"]')).toBeVisible();

    // Double-click the section title
    const sectionTitle = page.locator('[data-testid="section-title"]').first();
    await sectionTitle.dblclick();

    // Rename input should appear
    const renameInput = page.locator('[data-testid="section-rename-input"]');
    await expect(renameInput).toBeVisible({ timeout: 2000 });
  });

  test('typing a new name and pressing Enter renames the section', async ({ page }) => {
    // Open hierarchy panel
    await activateTool(page, 'hierarchy');
    await expect(page.locator('[data-testid="hierarchy-panel"]')).toBeVisible();

    // Double-click the section title to enter rename mode
    const sectionTitle = page.locator('[data-testid="section-title"]').first();
    await sectionTitle.dblclick();

    const renameInput = page.locator('[data-testid="section-rename-input"]');
    await expect(renameInput).toBeVisible({ timeout: 2000 });

    // Clear and type new name
    await renameInput.fill('My Custom Section');
    await renameInput.press('Enter');
    await page.waitForTimeout(200);

    // Verify section title updated in the panel
    const updatedTitle = page.locator('[data-testid="section-title"]').first();
    await expect(updatedTitle).toHaveText('My Custom Section');
  });

  test('renamed section is reflected in the workspace store', async ({ page }) => {
    // Open hierarchy panel
    await activateTool(page, 'hierarchy');
    await expect(page.locator('[data-testid="hierarchy-panel"]')).toBeVisible();

    // Double-click the section title to enter rename mode
    const sectionTitle = page.locator('[data-testid="section-title"]').first();
    await sectionTitle.dblclick();

    const renameInput = page.locator('[data-testid="section-rename-input"]');
    await expect(renameInput).toBeVisible({ timeout: 2000 });

    // Clear and type new name
    await renameInput.fill('Renamed Section');
    await renameInput.press('Enter');
    await page.waitForTimeout(200);

    // Verify store updated
    const ws = await getWorkspaceStore(page);
    expect(ws.workspace.sections[0].title).toBe('Renamed Section');
  });

  test('breadcrumb updates after renaming the active section', async ({ page }) => {
    // Open hierarchy panel
    await activateTool(page, 'hierarchy');
    await expect(page.locator('[data-testid="hierarchy-panel"]')).toBeVisible();

    // Verify initial breadcrumb
    await expect(page.locator('[data-testid="topbar-section"]')).toHaveText('Section 1');

    // Double-click the section title to enter rename mode
    const sectionTitle = page.locator('[data-testid="section-title"]').first();
    await sectionTitle.dblclick();

    const renameInput = page.locator('[data-testid="section-rename-input"]');
    await expect(renameInput).toBeVisible({ timeout: 2000 });

    await renameInput.fill('Updated Name');
    await renameInput.press('Enter');
    await page.waitForTimeout(200);

    // Verify breadcrumb updated
    await expect(page.locator('[data-testid="topbar-section"]')).toHaveText('Updated Name');
  });
});
