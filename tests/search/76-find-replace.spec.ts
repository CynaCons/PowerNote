/**
 * Test 76: Find & Replace
 * Covers: SearchPanel replace mode, Replace All
 */
import { test, expect } from '@playwright/test';
import { waitForCanvasReady, getCanvasStore } from '../helpers';

test.describe('76 - Find & Replace', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForCanvasReady(page);
  });

  test('Replace All updates all matching text nodes', async ({ page }) => {
    // Seed two text nodes with "old" in them
    await page.evaluate(() => {
      const cs = (window as any).__POWERNOTE_STORES__.canvas.getState();
      cs.addNode({
        id: 'r1', type: 'text', x: 100, y: 100, width: 200, height: 30, layer: 4,
        data: { text: 'The old way is slow', fontSize: 16,
                fontFamily: 'Inter', fontStyle: 'normal', fill: '#000' },
      });
      cs.addNode({
        id: 'r2', type: 'text', x: 100, y: 200, width: 200, height: 30, layer: 4,
        data: { text: 'old habits die hard', fontSize: 16,
                fontFamily: 'Inter', fontStyle: 'normal', fill: '#000' },
      });
    });
    await page.waitForTimeout(200);

    // Open search panel with Ctrl+F
    await page.keyboard.press('Control+f');
    await page.waitForTimeout(200);

    const searchPanel = page.locator('[data-testid="search-panel"]');
    await expect(searchPanel).toBeVisible();

    // Type query
    const searchInput = page.locator('[data-testid="search-input"]');
    await searchInput.fill('old');
    await page.waitForTimeout(200);

    // Toggle replace mode
    await page.locator('[data-testid="search-replace-toggle"]').click();
    await page.waitForTimeout(100);

    const replaceRow = page.locator('[data-testid="search-replace-row"]');
    await expect(replaceRow).toBeVisible();

    // Type replacement
    const replaceInput = page.locator('[data-testid="search-replace-input"]');
    await replaceInput.fill('new');

    // Click Replace All
    await page.locator('[data-testid="search-replace-all"]').click();
    await page.waitForTimeout(300);

    // Verify both nodes updated
    const store = await getCanvasStore(page);
    const n1 = store.nodes.find((n: any) => n.id === 'r1');
    const n2 = store.nodes.find((n: any) => n.id === 'r2');
    expect(n1.data.text).toBe('The new way is slow');
    expect(n2.data.text).toBe('new habits die hard');
  });

  test('Toggle replace shows/hides replace input', async ({ page }) => {
    await page.keyboard.press('Control+f');
    await page.waitForTimeout(200);

    // Replace row hidden by default
    const replaceRow = page.locator('[data-testid="search-replace-row"]');
    await expect(replaceRow).not.toBeVisible();

    // Toggle on
    await page.locator('[data-testid="search-replace-toggle"]').click();
    await page.waitForTimeout(100);
    await expect(replaceRow).toBeVisible();

    // Toggle off
    await page.locator('[data-testid="search-replace-toggle"]').click();
    await page.waitForTimeout(100);
    await expect(replaceRow).not.toBeVisible();
  });
});
