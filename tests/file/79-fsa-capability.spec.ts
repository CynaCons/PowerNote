/**
 * Test 79: File System Access API capability detection
 * Covers: feature detection and graceful fallback
 */
import { test, expect } from '@playwright/test';
import { waitForCanvasReady, disableFSA } from '../helpers';

test.describe('79 - FSA Capability Detection', () => {
  test('isFSASupported returns true in Chromium with FSA available', async ({ page }) => {
    await page.goto('/');
    await waitForCanvasReady(page);

    const result = await page.evaluate(async () => {
      const mod = await import('/src/utils/fileSystemAccess.ts');
      return mod.isFSASupported();
    });
    expect(result).toBe(true);
  });

  test('isFSASupported returns false when FSA is disabled', async ({ page }) => {
    await disableFSA(page);
    await page.goto('/');
    await waitForCanvasReady(page);

    const result = await page.evaluate(async () => {
      const mod = await import('/src/utils/fileSystemAccess.ts');
      return mod.isFSASupported();
    });
    expect(result).toBe(false);
  });

  test('Save As menu item is hidden when FSA unavailable', async ({ page }) => {
    await disableFSA(page);
    await page.goto('/');
    await waitForCanvasReady(page);

    // Open export menu
    await page.locator('[data-testid="save-dropdown-btn"]').click();
    await page.waitForTimeout(200);

    // Save As button should NOT be rendered when FSA unavailable
    const saveAsBtn = page.locator('[data-testid="save-as-btn"]');
    await expect(saveAsBtn).toHaveCount(0);
  });

  test('Save As menu item is visible when FSA available', async ({ page }) => {
    await page.goto('/');
    await waitForCanvasReady(page);

    await page.locator('[data-testid="save-dropdown-btn"]').click();
    await page.waitForTimeout(200);

    const saveAsBtn = page.locator('[data-testid="save-as-btn"]');
    await expect(saveAsBtn).toBeVisible();
  });
});
