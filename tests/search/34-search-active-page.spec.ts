/**
 * Test 34: Search Active Page (unsaved nodes)
 * Covers: Notebook-wide search must include the active page's unsaved canvas nodes
 *
 * Bug: Ctrl+Shift+F only searched workspace store data. Active page's nodes
 * live in the canvas store and haven't been saved back yet, so they were missed.
 */
import { test, expect } from '@playwright/test';
import { waitForCanvasReady, activateTool, clickCanvas } from '../helpers';

test.describe('34 - Search Active Page Unsaved Nodes', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForCanvasReady(page);
  });

  test('notebook search finds text on current page without saving first', async ({ page }) => {
    // Place text on the current page via UI — this lives in canvas store, NOT workspace store
    await activateTool(page, 'text');
    await clickCanvas(page, 400, 300);

    const textarea = page.locator('textarea');
    await expect(textarea).toBeVisible({ timeout: 2000 });
    await textarea.fill('findable_unique_text');
    await page.evaluate(() => (document.activeElement as HTMLElement)?.blur());
    await page.waitForTimeout(300);

    // Open notebook-wide search (NOT page search)
    await page.keyboard.press('Control+Shift+f');
    await page.waitForTimeout(200);

    const searchInput = page.locator('[data-testid="search-input"]');
    await searchInput.fill('findable_unique');
    await page.waitForTimeout(300);

    // Should find the text even though we never saved/navigated away
    const results = page.locator('[data-testid="search-result"]');
    expect(await results.count()).toBe(1);
  });
});
