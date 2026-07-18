/**
 * Test 84: Extended inline formatting (strike / code / underline)
 * Covers: REQ-TEXT-025, REQ-TEXT-026, REQ-TEXT-027, REQ-TOOL-007
 *
 * Extends v0.22.4 partial bold/italic with Strike/Code/Underline toolbar
 * buttons and shortcuts. Toolbar clicks must not commit the edit.
 */
import { test, expect } from '@playwright/test';
import { getCanvasStore, waitForCanvasReady, clickCanvas, activateTool } from '../helpers';

test.describe('84 - Extended inline formatting (REQ-TEXT-025..027, REQ-TOOL-007)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForCanvasReady(page);

    await activateTool(page, 'text');
    await clickCanvas(page, 400, 300);

    const textarea = page.locator('textarea');
    await expect(textarea).toBeVisible({ timeout: 2000 });
    await textarea.fill('Hello brave world');
  });

  test('toolbar Bold click on a partial selection does not commit the edit', async ({ page }) => {
    const textarea = page.locator('textarea');
    await textarea.evaluate((el) => {
      const ta = el as HTMLTextAreaElement;
      ta.setSelectionRange(6, 11);
    });

    await page.locator('[data-testid="format-bold"]').click();

    // Editor must still be open (no commit-on-click)
    await expect(textarea).toBeVisible();
    expect(await textarea.inputValue()).toBe('Hello **brave** world');
  });

  test('strike, code, underline buttons each wrap the selection appropriately', async ({ page }) => {
    const textarea = page.locator('textarea');

    await textarea.evaluate((el) => (el as HTMLTextAreaElement).setSelectionRange(6, 11));
    await page.locator('[data-testid="format-strike"]').click();
    expect(await textarea.inputValue()).toBe('Hello ~~brave~~ world');

    // Reset by selecting the wrapped region and unwrapping
    await textarea.fill('Hello brave world');
    await textarea.evaluate((el) => (el as HTMLTextAreaElement).setSelectionRange(6, 11));
    await page.locator('[data-testid="format-code"]').click();
    expect(await textarea.inputValue()).toBe('Hello `brave` world');

    await textarea.fill('Hello brave world');
    await textarea.evaluate((el) => (el as HTMLTextAreaElement).setSelectionRange(6, 11));
    await page.locator('[data-testid="format-underline"]').click();
    expect(await textarea.inputValue()).toBe('Hello <u>brave</u> world');
  });

  test('Ctrl+U / Ctrl+E / Ctrl+Shift+X wrap the selection', async ({ page }) => {
    const textarea = page.locator('textarea');

    await textarea.evaluate((el) => (el as HTMLTextAreaElement).setSelectionRange(6, 11));
    await page.keyboard.press('Control+u');
    expect(await textarea.inputValue()).toBe('Hello <u>brave</u> world');

    await textarea.fill('Hello brave world');
    await textarea.evaluate((el) => (el as HTMLTextAreaElement).setSelectionRange(6, 11));
    await page.keyboard.press('Control+e');
    expect(await textarea.inputValue()).toBe('Hello `brave` world');

    await textarea.fill('Hello brave world');
    await textarea.evaluate((el) => (el as HTMLTextAreaElement).setSelectionRange(6, 11));
    await page.keyboard.press('Control+Shift+x');
    expect(await textarea.inputValue()).toBe('Hello ~~brave~~ world');
  });

  test('clicking Bold with editor closed still toggles the whole-node fontStyle', async ({ page }) => {
    // Commit the edit so the editor closes but the node stays selected
    await page.evaluate(() => (document.activeElement as HTMLElement)?.blur());
    await page.waitForTimeout(200);

    let store = await getCanvasStore(page);
    expect(store.nodes[0].data.fontStyle).toBe('normal');

    await page.locator('[data-testid="format-bold"]').click();
    await page.waitForTimeout(150);

    store = await getCanvasStore(page);
    expect(store.nodes[0].data.fontStyle).toContain('bold');
    // The committed text content must not have markdown markers added
    expect(store.nodes[0].data.text).toBe('Hello brave world');
  });
});
