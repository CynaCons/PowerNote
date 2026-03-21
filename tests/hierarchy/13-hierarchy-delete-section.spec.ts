/**
 * Test 13: Hierarchy Delete Section
 * Covers: REQ-HIER-008 — Delete a section from the hierarchy panel,
 * with a guard preventing deletion of the last remaining section
 *
 * Verifies that a section can be deleted when more than one exists,
 * and that the last section cannot be deleted.
 */
import { test, expect } from '@playwright/test';
import { getWorkspaceStore, waitForCanvasReady, activateTool } from '../helpers';

test.describe('13 - Hierarchy Delete Section (REQ-HIER-008)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForCanvasReady(page);
  });

  test('deleting a section removes it from the panel', async ({ page }) => {
    // Open hierarchy panel
    await activateTool(page, 'hierarchy');
    await expect(page.locator('[data-testid="hierarchy-panel"]')).toBeVisible();

    // Add a second section
    await page.locator('[data-testid="add-section-btn"]').click();
    await page.waitForTimeout(200);

    // Verify 2 sections exist
    let ws = await getWorkspaceStore(page);
    expect(ws.workspace.sections).toHaveLength(2);

    // Delete the second section (force click to bypass hover visibility)
    const deleteButtons = page.locator('[data-testid="delete-section-btn"]');
    await deleteButtons.nth(1).click({ force: true });
    await page.waitForTimeout(200);

    // Verify only 1 section remains
    ws = await getWorkspaceStore(page);
    expect(ws.workspace.sections).toHaveLength(1);
  });

  test('cannot delete the last remaining section', async ({ page }) => {
    // Open hierarchy panel
    await activateTool(page, 'hierarchy');
    await expect(page.locator('[data-testid="hierarchy-panel"]')).toBeVisible();

    // Verify only 1 section exists
    let ws = await getWorkspaceStore(page);
    expect(ws.workspace.sections).toHaveLength(1);

    // Try to delete the only section (force click to bypass hover visibility)
    const deleteBtn = page.locator('[data-testid="delete-section-btn"]').first();
    await deleteBtn.click({ force: true });
    await page.waitForTimeout(200);

    // The section should still be there (guard prevents deletion)
    ws = await getWorkspaceStore(page);
    expect(ws.workspace.sections).toHaveLength(1);
  });

  test('deleting a section updates the section count in the panel', async ({ page }) => {
    // Open hierarchy panel
    await activateTool(page, 'hierarchy');
    await expect(page.locator('[data-testid="hierarchy-panel"]')).toBeVisible();

    // Add two more sections
    await page.locator('[data-testid="add-section-btn"]').click();
    await page.waitForTimeout(100);
    await page.locator('[data-testid="add-section-btn"]').click();
    await page.waitForTimeout(200);

    // Verify 3 sections exist
    let ws = await getWorkspaceStore(page);
    expect(ws.workspace.sections).toHaveLength(3);

    // Delete the second section
    const deleteButtons = page.locator('[data-testid="delete-section-btn"]');
    await deleteButtons.nth(1).click({ force: true });
    await page.waitForTimeout(200);

    // Verify 2 sections remain
    ws = await getWorkspaceStore(page);
    expect(ws.workspace.sections).toHaveLength(2);
  });
});
