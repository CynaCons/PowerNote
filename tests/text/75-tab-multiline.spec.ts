/**
 * Test 75: Tab/Shift+Tab Multi-line Selection
 * Covers: selecting multiple lines and indenting/unindenting all at once
 */
import { test, expect } from '@playwright/test';
import { waitForCanvasReady, activateTool, clickCanvas } from '../helpers';

test.describe('75 - Tab Multi-line Selection', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForCanvasReady(page);
  });

  test('Tab indents all selected lines', async ({ page }) => {
    await activateTool(page, 'text');
    await clickCanvas(page, 300, 200);

    const textarea = page.locator('textarea');
    await textarea.waitFor({ state: 'visible' });
    await textarea.fill('- item1\n- item2\n- item3');
    await page.waitForTimeout(100);

    // Select all three lines
    await page.evaluate(() => {
      const ta = document.querySelector('textarea') as HTMLTextAreaElement;
      ta.setSelectionRange(0, ta.value.length);
    });

    await textarea.press('Tab');
    await page.waitForTimeout(100);

    const value = await textarea.inputValue();
    expect(value).toBe('  - item1\n  - item2\n  - item3');
  });

  test('Shift+Tab un-indents all selected lines', async ({ page }) => {
    await activateTool(page, 'text');
    await clickCanvas(page, 300, 200);

    const textarea = page.locator('textarea');
    await textarea.waitFor({ state: 'visible' });
    await textarea.fill('  - item1\n  - item2\n  - item3');
    await page.waitForTimeout(100);

    await page.evaluate(() => {
      const ta = document.querySelector('textarea') as HTMLTextAreaElement;
      ta.setSelectionRange(0, ta.value.length);
    });

    await textarea.press('Shift+Tab');
    await page.waitForTimeout(100);

    const value = await textarea.inputValue();
    expect(value).toBe('- item1\n- item2\n- item3');
  });

  test('Tab indents checkbox lines in multi-line selection', async ({ page }) => {
    await activateTool(page, 'text');
    await clickCanvas(page, 300, 200);

    const textarea = page.locator('textarea');
    await textarea.waitFor({ state: 'visible' });
    await textarea.fill('- [ ] todo1\n- [x] done\n- [ ] todo2');
    await page.waitForTimeout(100);

    // Select the middle 2 lines (from start of line 2 to end of line 3)
    await page.evaluate(() => {
      const ta = document.querySelector('textarea') as HTMLTextAreaElement;
      const firstNl = ta.value.indexOf('\n');
      ta.setSelectionRange(firstNl + 1, ta.value.length);
    });

    await textarea.press('Tab');
    await page.waitForTimeout(100);

    const value = await textarea.inputValue();
    expect(value).toBe('- [ ] todo1\n  - [x] done\n  - [ ] todo2');
  });

  test('Shift+Tab on line with no indent is a no-op', async ({ page }) => {
    await activateTool(page, 'text');
    await clickCanvas(page, 300, 200);

    const textarea = page.locator('textarea');
    await textarea.waitFor({ state: 'visible' });
    await textarea.fill('- unindented');
    await page.waitForTimeout(100);

    await page.evaluate(() => {
      const ta = document.querySelector('textarea') as HTMLTextAreaElement;
      ta.setSelectionRange(ta.value.length, ta.value.length);
    });

    await textarea.press('Shift+Tab');
    await page.waitForTimeout(100);

    const value = await textarea.inputValue();
    expect(value).toBe('- unindented');
  });

  test('Tab removes any selected text and replaces with indent (standard behavior)', async ({ page }) => {
    // When text is selected on a single line, Tab should indent the line
    await activateTool(page, 'text');
    await clickCanvas(page, 300, 200);

    const textarea = page.locator('textarea');
    await textarea.waitFor({ state: 'visible' });
    await textarea.fill('- item');
    await page.waitForTimeout(100);

    // Select "item" (partial single line)
    await page.evaluate(() => {
      const ta = document.querySelector('textarea') as HTMLTextAreaElement;
      ta.setSelectionRange(2, 6); // "item"
    });

    await textarea.press('Tab');
    await page.waitForTimeout(100);

    const value = await textarea.inputValue();
    // Single-line partial selection: indent whole line
    expect(value).toBe('  - item');
  });
});
