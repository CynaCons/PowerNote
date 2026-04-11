/**
 * Test 73: Tab/Shift+Tab Nested Bullet/Checkbox Indentation
 * Covers: Tab indents bullets and checkboxes, Shift+Tab un-indents
 */
import { test, expect } from '@playwright/test';
import { waitForCanvasReady, getCanvasStore, activateTool, clickCanvas } from '../helpers';

test.describe('73 - Text Indent for Nested Lists', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForCanvasReady(page);
  });

  test('Tab on a bullet line indents it (nesting)', async ({ page }) => {
    // Place a text block
    await activateTool(page, 'text');
    await clickCanvas(page, 300, 200);

    const textarea = page.locator('textarea');
    await textarea.waitFor({ state: 'visible' });

    // Type two bullets
    await textarea.fill('- parent\n- child');
    await page.waitForTimeout(100);

    // Move cursor to end of line 2 (on "child")
    await page.evaluate(() => {
      const ta = document.querySelector('textarea') as HTMLTextAreaElement;
      ta.setSelectionRange(ta.value.length, ta.value.length);
    });

    // Press Tab
    await textarea.press('Tab');
    await page.waitForTimeout(100);

    // Verify the second line is now indented
    const value = await textarea.inputValue();
    expect(value).toBe('- parent\n  - child');
  });

  test('Tab on a checkbox line indents it', async ({ page }) => {
    await activateTool(page, 'text');
    await clickCanvas(page, 300, 200);

    const textarea = page.locator('textarea');
    await textarea.waitFor({ state: 'visible' });
    await textarea.fill('- [ ] task\n- [ ] subtask');
    await page.waitForTimeout(100);

    // Cursor at end of line 2
    await page.evaluate(() => {
      const ta = document.querySelector('textarea') as HTMLTextAreaElement;
      ta.setSelectionRange(ta.value.length, ta.value.length);
    });

    await textarea.press('Tab');
    await page.waitForTimeout(100);

    const value = await textarea.inputValue();
    expect(value).toBe('- [ ] task\n  - [ ] subtask');
  });

  test('Shift+Tab on an indented line un-indents it', async ({ page }) => {
    await activateTool(page, 'text');
    await clickCanvas(page, 300, 200);

    const textarea = page.locator('textarea');
    await textarea.waitFor({ state: 'visible' });
    await textarea.fill('- parent\n  - indented');
    await page.waitForTimeout(100);

    await page.evaluate(() => {
      const ta = document.querySelector('textarea') as HTMLTextAreaElement;
      ta.setSelectionRange(ta.value.length, ta.value.length);
    });

    await textarea.press('Shift+Tab');
    await page.waitForTimeout(100);

    const value = await textarea.inputValue();
    expect(value).toBe('- parent\n- indented');
  });

  test('Tab at the middle of a line indents the line (cursor-agnostic)', async ({ page }) => {
    await activateTool(page, 'text');
    await clickCanvas(page, 300, 200);

    const textarea = page.locator('textarea');
    await textarea.waitFor({ state: 'visible' });
    await textarea.fill('- item');
    await page.waitForTimeout(100);

    // Cursor in the middle of "item"
    await page.evaluate(() => {
      const ta = document.querySelector('textarea') as HTMLTextAreaElement;
      ta.setSelectionRange(4, 4); // After "- it"
    });

    await textarea.press('Tab');
    await page.waitForTimeout(100);

    const value = await textarea.inputValue();
    expect(value).toBe('  - item');
  });
});
