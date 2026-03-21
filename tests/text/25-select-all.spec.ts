/**
 * Test 25: Select All
 * Covers: REQ-TEXT-015 — Select all nodes with Ctrl+A
 *
 * Verifies that pressing Ctrl+A selects all text nodes on the canvas,
 * and that deleting them removes all nodes.
 */
import { test, expect } from '@playwright/test';
import { getCanvasStore, waitForCanvasReady } from '../helpers';

test.describe('25 - Select All (REQ-TEXT-015)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForCanvasReady(page);

    // Place 3 text blocks via store
    await page.evaluate(() => {
      const store = (window as any).__POWERNOTE_STORES__.canvas.getState();
      for (let i = 0; i < 3; i++) {
        store.addNode({
          id: `node-${i}`,
          type: 'text',
          x: 100 + i * 150,
          y: 200,
          width: 120,
          height: 30,
          data: { text: `Text ${i}`, fontSize: 16, fontFamily: 'Inter', fontStyle: 'normal', fill: '#1a1a1a' },
        });
      }
    });
    await page.waitForTimeout(200);
  });

  test('Ctrl+A selects all 3 nodes', async ({ page }) => {
    await page.keyboard.press('Control+a');
    await page.waitForTimeout(200);

    const store = await getCanvasStore(page);
    expect(store.selectedNodeIds).toHaveLength(3);
    expect(store.selectedNodeIds).toContain('node-0');
    expect(store.selectedNodeIds).toContain('node-1');
    expect(store.selectedNodeIds).toContain('node-2');
  });

  test('delete after select all removes all nodes', async ({ page }) => {
    await page.keyboard.press('Control+a');
    await page.waitForTimeout(100);
    await page.keyboard.press('Delete');
    await page.waitForTimeout(200);

    const store = await getCanvasStore(page);
    expect(store.nodes).toHaveLength(0);
  });
});
