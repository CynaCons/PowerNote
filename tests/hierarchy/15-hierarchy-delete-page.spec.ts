/**
 * Test 15: Hierarchy Delete Page
 * Covers: REQ-HIER-010 — Delete a page from the hierarchy panel,
 * with a guard preventing deletion of the last remaining page in a section
 *
 * Verifies that a page can be deleted when more than one exists in a
 * section, and that the last page in a section cannot be deleted.
 */
import { test, expect } from '@playwright/test';
import { getWorkspaceStore, waitForCanvasReady, activateTool } from '../helpers';

test.describe('15 - Hierarchy Delete Page (REQ-HIER-010)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForCanvasReady(page);
  });

  test('deleting a page removes it from the section', async ({ page }) => {
    // Open hierarchy panel
    await activateTool(page, 'hierarchy');
    await expect(page.locator('[data-testid="hierarchy-panel"]')).toBeVisible();

    // Add a second page to the first section
    await page.locator('[data-testid="add-page-btn"]').first().click();
    await page.waitForTimeout(200);

    // Verify 2 pages exist in the first section
    let ws = await getWorkspaceStore(page);
    expect(ws.workspace.sections[0].pages).toHaveLength(2);

    // Delete the second page (force click to bypass hover visibility)
    const deleteButtons = page.locator('[data-testid="delete-page-btn"]');
    await deleteButtons.nth(1).click({ force: true });
    await page.waitForTimeout(200);

    // Verify only 1 page remains
    ws = await getWorkspaceStore(page);
    expect(ws.workspace.sections[0].pages).toHaveLength(1);
  });

  test('cannot delete the last remaining page in a section', async ({ page }) => {
    // Open hierarchy panel
    await activateTool(page, 'hierarchy');
    await expect(page.locator('[data-testid="hierarchy-panel"]')).toBeVisible();

    // Verify only 1 page exists
    let ws = await getWorkspaceStore(page);
    expect(ws.workspace.sections[0].pages).toHaveLength(1);

    // Try to delete the only page (force click to bypass hover visibility)
    const deleteBtn = page.locator('[data-testid="delete-page-btn"]').first();
    await deleteBtn.click({ force: true });
    await page.waitForTimeout(200);

    // The page should still be there (guard prevents deletion)
    ws = await getWorkspaceStore(page);
    expect(ws.workspace.sections[0].pages).toHaveLength(1);
  });

  test('deleting a page updates the page count in the section', async ({ page }) => {
    // Open hierarchy panel
    await activateTool(page, 'hierarchy');
    await expect(page.locator('[data-testid="hierarchy-panel"]')).toBeVisible();

    // Add two more pages
    await page.locator('[data-testid="add-page-btn"]').first().click();
    await page.waitForTimeout(100);
    await page.locator('[data-testid="add-page-btn"]').first().click();
    await page.waitForTimeout(200);

    // Verify 3 pages exist
    let ws = await getWorkspaceStore(page);
    expect(ws.workspace.sections[0].pages).toHaveLength(3);

    // Delete the second page
    const deleteButtons = page.locator('[data-testid="delete-page-btn"]');
    await deleteButtons.nth(1).click({ force: true });
    await page.waitForTimeout(200);

    // Verify 2 pages remain
    ws = await getWorkspaceStore(page);
    expect(ws.workspace.sections[0].pages).toHaveLength(2);
  });
});
