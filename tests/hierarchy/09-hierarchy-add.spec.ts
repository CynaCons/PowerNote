/**
 * Test 09: Hierarchy Add
 * Covers: REQ-HIER-005, REQ-HIER-006 — Add sections and pages via the
 * hierarchy panel
 *
 * Verifies that clicking add-section-btn creates a new section, and that
 * clicking the add-page button inside a section creates a new page.
 */
import { test, expect } from '@playwright/test';
import { getWorkspaceStore, waitForCanvasReady, activateTool } from '../helpers';

test.describe('09 - Hierarchy Add (REQ-HIER-005, REQ-HIER-006)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForCanvasReady(page);
  });

  test('initial state has 1 section with 1 page', async ({ page }) => {
    const ws = await getWorkspaceStore(page);
    expect(ws.workspace.sections).toHaveLength(1);
    expect(ws.workspace.sections[0].pages).toHaveLength(1);
  });

  test('add-section-btn creates a new section', async ({ page }) => {
    // Open hierarchy panel
    await activateTool(page, 'hierarchy');
    await expect(page.locator('[data-testid="hierarchy-panel"]')).toBeVisible();

    // Click add section button
    await page.locator('[data-testid="add-section-btn"]').click();
    await page.waitForTimeout(200);

    // Verify 2 sections exist in the store
    const ws = await getWorkspaceStore(page);
    expect(ws.workspace.sections).toHaveLength(2);

    // New section should have 1 page by default
    expect(ws.workspace.sections[1].pages).toHaveLength(1);
  });

  test('add-page button within a section creates a new page', async ({ page }) => {
    // Open hierarchy panel
    await activateTool(page, 'hierarchy');
    await expect(page.locator('[data-testid="hierarchy-panel"]')).toBeVisible();

    // Find the add-page button in the first (and only) section
    // It's the Plus button inside the section header (not the add-section-btn)
    const sectionAddBtn = page.locator('[data-testid="add-page-btn"]').first();
    await sectionAddBtn.click();
    await page.waitForTimeout(200);

    // Verify the first section now has 2 pages
    const ws = await getWorkspaceStore(page);
    expect(ws.workspace.sections[0].pages).toHaveLength(2);
  });

  test('can add multiple sections and pages', async ({ page }) => {
    // Open hierarchy panel
    await activateTool(page, 'hierarchy');
    await expect(page.locator('[data-testid="hierarchy-panel"]')).toBeVisible();

    // Add a section
    await page.locator('[data-testid="add-section-btn"]').click();
    await page.waitForTimeout(100);

    // Add a page to the first section
    const sectionAddBtns = page.locator('[data-testid="add-page-btn"]');
    await sectionAddBtns.nth(0).click();
    await page.waitForTimeout(100);

    // Add a page to the second section
    await sectionAddBtns.nth(1).click();
    await page.waitForTimeout(100);

    const ws = await getWorkspaceStore(page);
    expect(ws.workspace.sections).toHaveLength(2);
    expect(ws.workspace.sections[0].pages).toHaveLength(2);
    expect(ws.workspace.sections[1].pages).toHaveLength(2);
  });
});
