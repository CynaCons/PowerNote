/**
 * Test 32: Text Editor Features
 * Covers: REQ-TEXT-017, REQ-TEXT-018 — Auto-continue bullet lists on Enter,
 * and Shift+Tab to unindent
 *
 * Verifies that pressing Enter after a bullet line auto-continues the list,
 * and that Shift+Tab removes indentation from the current line.
 */
import { test, expect } from '@playwright/test';
import { waitForCanvasReady, clickCanvas, activateTool } from '../helpers';

test.describe('32 - Text Editor Features (REQ-TEXT-017, REQ-TEXT-018)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForCanvasReady(page);
  });

  test('Enter auto-continues bullet list', async ({ page }) => {
    // Place a text and enter edit mode
    await activateTool(page, 'text');
    await clickCanvas(page, 400, 300);

    const textarea = page.locator('textarea');
    await expect(textarea).toBeVisible({ timeout: 2000 });

    // Type a bullet item and press Enter
    await textarea.fill('');
    await textarea.press('End'); // ensure cursor at end
    await textarea.type('- first');
    await textarea.press('Enter');
    await page.waitForTimeout(100);

    // The textarea should now contain "- first\n- "
    const value = await textarea.inputValue();
    expect(value).toContain('- first');
    expect(value).toContain('\n- '); // Auto-continued bullet
  });

  test('Shift+Tab removes indent from current line', async ({ page }) => {
    await activateTool(page, 'text');
    await clickCanvas(page, 400, 300);

    const textarea = page.locator('textarea');
    await expect(textarea).toBeVisible({ timeout: 2000 });

    // Type an indented line: first indent with Tab, then type content
    await textarea.fill('');
    await textarea.press('Tab'); // adds 2 spaces
    await textarea.type('indented');
    await page.waitForTimeout(100);

    let value = await textarea.inputValue();
    expect(value).toMatch(/^\s{2}indented/); // starts with 2 spaces

    // Now Shift+Tab to remove the indent
    await textarea.press('Shift+Tab');
    await page.waitForTimeout(100);

    value = await textarea.inputValue();
    expect(value).toBe('indented'); // indent removed
  });
});
