/**
 * Test 31: Search Notebook (Ctrl+Shift+F)
 * Covers: REQ-SEARCH-002 — Notebook-wide search across all sections and pages
 *
 * Verifies that Ctrl+Shift+F opens the search panel in notebook-wide mode,
 * searching across sections finds text on other pages, results show section/page
 * path, and clicking a result navigates to that page.
 */
import { test, expect } from '@playwright/test';
import { getWorkspaceStore, waitForCanvasReady, activateTool } from '../helpers';

test.describe('31 - Search Notebook (REQ-SEARCH-002)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForCanvasReady(page);

    // Add a second section via hierarchy panel
    await activateTool(page, 'hierarchy');
    await expect(page.locator('[data-testid="hierarchy-panel"]')).toBeVisible();
    await page.locator('[data-testid="add-section-btn"]').click();
    await page.waitForTimeout(200);

    // Save "needle" text on the second section's page via store
    await page.evaluate(() => {
      const ws = (window as any).__POWERNOTE_STORES__.workspace.getState();
      const secondSection = ws.workspace.sections[1];
      const secondPage = secondSection.pages[0];
      // Add a node to the second section's page directly in workspace data
      const node = {
        id: 'needle-node',
        type: 'text',
        x: 200,
        y: 200,
        width: 120,
        height: 30,
        data: { text: 'needle', fontSize: 16, fontFamily: 'Inter', fontStyle: 'normal', fill: '#1a1a1a' },
      };
      ws.workspace.sections[1].pages[0].nodes = [node];
      // Force re-render by calling a state update
      (window as any).__POWERNOTE_STORES__.workspace.setState({
        workspace: { ...ws.workspace },
      });
    });
    await page.waitForTimeout(200);
  });

  test('Ctrl+Shift+F opens search panel', async ({ page }) => {
    await page.keyboard.press('Control+Shift+f');
    await page.waitForTimeout(200);

    await expect(page.locator('[data-testid="search-panel"]')).toBeVisible();
  });

  test('searching for "needle" finds 1 result from the second section', async ({ page }) => {
    await page.keyboard.press('Control+Shift+f');
    await page.waitForTimeout(200);

    const searchInput = page.locator('[data-testid="search-input"]');
    await searchInput.fill('needle');
    await page.waitForTimeout(300);

    const results = page.locator('[data-testid="search-result"]');
    expect(await results.count()).toBe(1);

    // The result should show section > page path
    const resultPath = page.locator('.search-panel__result-path');
    await expect(resultPath.first()).toBeVisible();
    const pathText = await resultPath.first().innerText();
    expect(pathText).toContain('>');
  });

  test('clicking a result navigates to the target page', async ({ page }) => {
    // Record initial breadcrumb
    const initialSection = await page.locator('[data-testid="topbar-section"]').innerText();

    await page.keyboard.press('Control+Shift+f');
    await page.waitForTimeout(200);

    const searchInput = page.locator('[data-testid="search-input"]');
    await searchInput.fill('needle');
    await page.waitForTimeout(300);

    // Click the result
    const result = page.locator('[data-testid="search-result"]').first();
    await result.click();
    await page.waitForTimeout(300);

    // Breadcrumb should have changed (navigated to second section)
    const newSection = await page.locator('[data-testid="topbar-section"]').innerText();
    expect(newSection).not.toBe(initialSection);
  });
});
