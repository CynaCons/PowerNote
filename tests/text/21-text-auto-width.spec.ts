/**
 * Test 21: Text Auto-Width
 * Covers: REQ-TEXT-020 — Text blocks shall auto-size width to fit rendered content
 *
 * Verifies that text blocks grow/shrink width based on content.
 */
import { test, expect } from '@playwright/test';
import { getCanvasStore, waitForCanvasReady, activateTool, clickCanvas } from '../helpers';

test.describe('21 - Text Auto-Width (REQ-TEXT-020)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForCanvasReady(page);
  });

  test('short text has small width', async ({ page }) => {
    await activateTool(page, 'text');
    await clickCanvas(page, 400, 300);

    const textarea = page.locator('textarea');
    await expect(textarea).toBeVisible({ timeout: 2000 });
    await textarea.fill('Hi');
    await page.evaluate(() => (document.activeElement as HTMLElement)?.blur());
    await page.waitForTimeout(200);

    const store = await getCanvasStore(page);
    expect(store.nodes).toHaveLength(1);
    // Short text should have a small width (min 60)
    expect(store.nodes[0].width).toBeGreaterThanOrEqual(60);
    expect(store.nodes[0].width).toBeLessThan(200);
  });

  test('long text has larger width', async ({ page }) => {
    await activateTool(page, 'text');
    await clickCanvas(page, 400, 300);

    const textarea = page.locator('textarea');
    await expect(textarea).toBeVisible({ timeout: 2000 });
    await textarea.fill('This is a longer piece of text that should cause the block to be wider');
    await page.evaluate(() => (document.activeElement as HTMLElement)?.blur());
    await page.waitForTimeout(200);

    const store = await getCanvasStore(page);
    expect(store.nodes).toHaveLength(1);
    // Longer text should have a wider width
    expect(store.nodes[0].width).toBeGreaterThan(200);
  });

  test('width is capped at 800px', async ({ page }) => {
    // Add a node with very long text via store
    await page.evaluate(() => {
      const s = (window as any).__POWERNOTE_STORES__.canvas.getState();
      s.addNode({
        id: 'wide-text',
        type: 'text',
        x: 100, y: 100,
        width: 120, height: 30,
        data: {
          text: 'A'.repeat(500),
          fontSize: 16, fontFamily: 'sans-serif', fontStyle: 'normal', fill: '#1a1a1a',
        },
      });
    });
    await page.waitForTimeout(200);

    const store = await getCanvasStore(page);
    const node = store.nodes.find((n: any) => n.id === 'wide-text');
    // Should be capped at max 800 + padding
    expect(node.width).toBeLessThanOrEqual(820);
  });
});
