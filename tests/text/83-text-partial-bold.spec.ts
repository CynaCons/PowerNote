/**
 * Test 83: Partial bold/italic formatting inside a text block
 * Covers: REQ-TEXT-022, REQ-TEXT-023, REQ-TOOL-007
 *
 * Regression test for the bug where applying bold to a selected piece of text
 * inside a block bolded the ENTIRE block (block-level fontStyle) instead of just
 * the selection. The fix wraps only the selected text in inline markdown
 * (`**...**`) while editing, leaving the rest of the block untouched.
 */
import { test, expect } from '@playwright/test';
import { getCanvasStore, waitForCanvasReady, clickCanvas, activateTool } from '../helpers';

test.describe('83 - Partial bold/italic (REQ-TEXT-022/023, REQ-TOOL-007)', () => {
  test('toolbar bold formats only the selected text, not the whole block', async ({ page }) => {
    await page.goto('/');
    await waitForCanvasReady(page);

    // Place a text block — it auto-enters edit mode
    await activateTool(page, 'text');
    await clickCanvas(page, 400, 300);

    const textarea = page.locator('textarea');
    await expect(textarea).toBeVisible({ timeout: 2000 });
    await textarea.fill('hello world');

    // Select just the word "world" (chars 6..11) inside the textarea
    await page.evaluate(() => {
      const ta = document.querySelector('textarea') as HTMLTextAreaElement;
      ta.focus();
      ta.setSelectionRange(6, 11);
    });

    // Click Bold while still editing — must NOT blur/close the editor
    await page.locator('.text-toolbar__btn').first().click();
    await page.waitForTimeout(100);

    // Only the selection is wrapped in markdown bold markers
    await expect(textarea).toHaveValue('hello **world**');

    // Commit the edit
    await page.evaluate(() => (document.activeElement as HTMLElement)?.blur());
    await page.waitForTimeout(200);

    const store = await getCanvasStore(page);
    const node = store.nodes[0];
    expect(node.data.text).toBe('hello **world**');
    // The bug regression check: block-level fontStyle must remain 'normal'
    // (bold was NOT applied to the entire block)
    expect(node.data.fontStyle).toBe('normal');
  });

  test('Ctrl+I italicizes only the selected text', async ({ page }) => {
    await page.goto('/');
    await waitForCanvasReady(page);

    await activateTool(page, 'text');
    await clickCanvas(page, 400, 300);

    const textarea = page.locator('textarea');
    await expect(textarea).toBeVisible({ timeout: 2000 });
    await textarea.fill('keep stress calm');

    // Select "stress" (chars 5..11)
    await page.evaluate(() => {
      const ta = document.querySelector('textarea') as HTMLTextAreaElement;
      ta.focus();
      ta.setSelectionRange(5, 11);
    });

    await textarea.press('Control+i');
    await page.waitForTimeout(100);

    await expect(textarea).toHaveValue('keep *stress* calm');

    await page.evaluate(() => (document.activeElement as HTMLElement)?.blur());
    await page.waitForTimeout(200);

    const store = await getCanvasStore(page);
    expect(store.nodes[0].data.text).toBe('keep *stress* calm');
    expect(store.nodes[0].data.fontStyle).toBe('normal');
  });

  test('bold with no selection bolds the next typed text (Word-style)', async ({ page }) => {
    await page.goto('/');
    await waitForCanvasReady(page);

    await activateTool(page, 'text');
    await clickCanvas(page, 400, 300);

    const textarea = page.locator('textarea');
    await expect(textarea).toBeVisible({ timeout: 2000 });

    // Fresh block: place the cursor with nothing highlighted
    await page.evaluate(() => {
      const ta = document.querySelector('textarea') as HTMLTextAreaElement;
      ta.focus();
      ta.setSelectionRange(0, 0);
    });

    // Turn bold ON with no selection — must keep editor focused (no blur)
    await page.locator('.text-toolbar__btn').first().click();
    await page.waitForTimeout(50);

    // Type — the new text lands between the markers and comes out bold
    await page.keyboard.type('hello');
    await page.waitForTimeout(50);

    await expect(textarea).toHaveValue('**hello**');

    await page.evaluate(() => (document.activeElement as HTMLElement)?.blur());
    await page.waitForTimeout(200);

    const store = await getCanvasStore(page);
    expect(store.nodes[0].data.text).toBe('**hello**');
    expect(store.nodes[0].data.fontStyle).toBe('normal');
  });

  test('toolbar bold still toggles the whole block when not editing', async ({ page }) => {
    await page.goto('/');
    await waitForCanvasReady(page);

    await activateTool(page, 'text');
    await clickCanvas(page, 400, 300);

    const textarea = page.locator('textarea');
    await expect(textarea).toBeVisible({ timeout: 2000 });
    await textarea.fill('hello');
    await page.evaluate(() => (document.activeElement as HTMLElement)?.blur());
    await page.waitForTimeout(200);

    // Node stays selected, not editing — re-show the toolbar
    await activateTool(page, 'text');
    await page.waitForTimeout(100);

    await page.locator('.text-toolbar__btn').first().click();
    await page.waitForTimeout(100);

    const store = await getCanvasStore(page);
    // Legacy behavior preserved: whole-block fontStyle becomes bold
    expect(store.nodes[0].data.fontStyle).toContain('bold');
    // Text content is untouched (no markdown markers injected)
    expect(store.nodes[0].data.text).toBe('hello');
  });
});
