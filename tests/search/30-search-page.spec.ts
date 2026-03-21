/**
 * Test 30: Search Page (Ctrl+F)
 * Covers: REQ-SEARCH-001 — Page-level search for text nodes
 *
 * Verifies that Ctrl+F opens the search panel, typing filters results
 * to matching text nodes on the current page, and Escape closes the panel.
 */
import { test, expect } from '@playwright/test';
import { waitForCanvasReady } from '../helpers';

test.describe('30 - Search Page (REQ-SEARCH-001)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForCanvasReady(page);

    // Place 2 text blocks via store
    await page.evaluate(() => {
      const store = (window as any).__POWERNOTE_STORES__.canvas.getState();
      store.addNode({
        id: 'alpha-node',
        type: 'text',
        x: 200,
        y: 200,
        width: 120,
        height: 30,
        data: { text: 'Alpha content', fontSize: 16, fontFamily: 'Inter', fontStyle: 'normal', fill: '#1a1a1a' },
      });
      store.addNode({
        id: 'beta-node',
        type: 'text',
        x: 400,
        y: 200,
        width: 120,
        height: 30,
        data: { text: 'Beta content', fontSize: 16, fontFamily: 'Inter', fontStyle: 'normal', fill: '#1a1a1a' },
      });
    });
    await page.waitForTimeout(200);
  });

  test('Ctrl+F opens search panel', async ({ page }) => {
    await page.keyboard.press('Control+f');
    await page.waitForTimeout(200);

    await expect(page.locator('[data-testid="search-panel"]')).toBeVisible();
  });

  test('typing "Alpha" shows 1 result', async ({ page }) => {
    await page.keyboard.press('Control+f');
    await page.waitForTimeout(200);

    const searchInput = page.locator('[data-testid="search-input"]');
    await expect(searchInput).toBeVisible();
    await searchInput.fill('Alpha');
    await page.waitForTimeout(300);

    const results = page.locator('[data-testid="search-result"]');
    expect(await results.count()).toBe(1);
  });

  test('typing "content" shows 2 results', async ({ page }) => {
    await page.keyboard.press('Control+f');
    await page.waitForTimeout(200);

    const searchInput = page.locator('[data-testid="search-input"]');
    await searchInput.fill('content');
    await page.waitForTimeout(300);

    const results = page.locator('[data-testid="search-result"]');
    expect(await results.count()).toBe(2);
  });

  test('Escape closes the search panel', async ({ page }) => {
    await page.keyboard.press('Control+f');
    await page.waitForTimeout(200);

    await expect(page.locator('[data-testid="search-panel"]')).toBeVisible();

    // Press Escape on the search input
    const searchInput = page.locator('[data-testid="search-input"]');
    await searchInput.press('Escape');
    await page.waitForTimeout(200);

    await expect(page.locator('[data-testid="search-panel"]')).not.toBeVisible();
  });
});
