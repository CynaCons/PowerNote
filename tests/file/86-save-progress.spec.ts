/**
 * Test 86: Save-in-progress indicator
 * Covers: REQ-FILE-021
 *
 * Manual Save shows a spinner / busy state on the TopBar Save button
 * while the write is in flight, then clears it when done. Concurrent
 * saveNotebook calls are ignored while isSaving is true.
 */
import { test, expect } from '@playwright/test';
import { waitForCanvasReady, disableFSA } from '../helpers';

test.describe('86 - Save-in-progress animation (REQ-FILE-021)', () => {
  test('Save button shows spinner while saving and clears afterward', async ({ page }) => {
    await disableFSA(page);
    await page.addInitScript(() => {
      (window as unknown as { __POWERNOTE_SAVE_DELAY__: number }).__POWERNOTE_SAVE_DELAY__ = 600;
    });
    await page.goto('/');
    await waitForCanvasReady(page);

    await page.evaluate(() => {
      const stores = (window as unknown as { __POWERNOTE_STORES__: any }).__POWERNOTE_STORES__;
      stores.workspace.getState().markDirty();
    });

    const saveBtn = page.locator('[data-testid="save-btn"]');
    await expect(saveBtn).toBeEnabled();

    const downloadPromise = page.waitForEvent('download');
    await saveBtn.click();

    await expect(page.locator('[data-testid="save-spinner"]')).toBeVisible({ timeout: 2000 });
    await expect(saveBtn).toBeDisabled();
    await expect(saveBtn).toHaveAttribute('aria-busy', 'true');

    // Concurrent call while busy must no-op (isSaving stays true, dirty uncleared mid-flight)
    const midFlight = await page.evaluate(async () => {
      const store = (window as any).__POWERNOTE_STORES__.workspace;
      const { saveNotebook } = await import('/src/utils/saveNotebook.ts');
      const before = store.getState().isSaving;
      await saveNotebook(false);
      return {
        wasSaving: before,
        stillSaving: store.getState().isSaving,
      };
    });
    expect(midFlight.wasSaving).toBe(true);
    expect(midFlight.stillSaving).toBe(true);

    await downloadPromise;

    await expect(page.locator('[data-testid="save-spinner"]')).toHaveCount(0, { timeout: 5000 });
    await expect(saveBtn).toBeEnabled();
    await expect(saveBtn).toHaveAttribute('aria-busy', 'false');
  });
});
