/**
 * Test 23: Copy/Paste
 * Covers: REQ-TEXT-014 — Copy and paste text nodes with Ctrl+C/Ctrl+V
 *
 * Verifies that copying a selected text node and pasting creates a duplicate
 * with the same text content, offset by 20px, and the pasted node is selected.
 */
import { test, expect } from '@playwright/test';
import { getCanvasStore, waitForCanvasReady } from '../helpers';

test.describe('23 - Copy/Paste (REQ-TEXT-014)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForCanvasReady(page);
  });

  test('Ctrl+C then Ctrl+V duplicates selected text node', async ({ page }) => {
    // Place a text node via store
    await page.evaluate(() => {
      const store = (window as any).__POWERNOTE_STORES__.canvas.getState();
      store.addNode({
        id: 'original-node',
        type: 'text',
        x: 200,
        y: 200,
        width: 120,
        height: 30,
        data: { text: 'Original', fontSize: 16, fontFamily: 'Inter', fontStyle: 'normal', fill: '#1a1a1a' },
      });
      store.selectNode('original-node', false);
    });
    await page.waitForTimeout(200);

    // Copy
    await page.keyboard.press('Control+c');
    await page.waitForTimeout(100);

    // Paste
    await page.keyboard.press('Control+v');
    await page.waitForTimeout(200);

    // Should have 2 nodes
    const store = await getCanvasStore(page);
    expect(store.nodes).toHaveLength(2);
  });

  test('pasted node is offset by 20px from original', async ({ page }) => {
    await page.evaluate(() => {
      const store = (window as any).__POWERNOTE_STORES__.canvas.getState();
      store.addNode({
        id: 'original-node',
        type: 'text',
        x: 200,
        y: 200,
        width: 120,
        height: 30,
        data: { text: 'Original', fontSize: 16, fontFamily: 'Inter', fontStyle: 'normal', fill: '#1a1a1a' },
      });
      store.selectNode('original-node', false);
    });
    await page.waitForTimeout(200);

    await page.keyboard.press('Control+c');
    await page.waitForTimeout(100);
    await page.keyboard.press('Control+v');
    await page.waitForTimeout(200);

    const store = await getCanvasStore(page);
    const original = store.nodes.find((n: any) => n.id === 'original-node');
    const pasted = store.nodes.find((n: any) => n.id !== 'original-node');

    expect(pasted).toBeDefined();
    expect(pasted!.x).toBe(original!.x + 20);
    expect(pasted!.y).toBe(original!.y + 20);
  });

  test('pasted node has same text content as original', async ({ page }) => {
    await page.evaluate(() => {
      const store = (window as any).__POWERNOTE_STORES__.canvas.getState();
      store.addNode({
        id: 'original-node',
        type: 'text',
        x: 200,
        y: 200,
        width: 120,
        height: 30,
        data: { text: 'Original', fontSize: 16, fontFamily: 'Inter', fontStyle: 'normal', fill: '#1a1a1a' },
      });
      store.selectNode('original-node', false);
    });
    await page.waitForTimeout(200);

    await page.keyboard.press('Control+c');
    await page.waitForTimeout(100);
    await page.keyboard.press('Control+v');
    await page.waitForTimeout(200);

    const store = await getCanvasStore(page);
    const pasted = store.nodes.find((n: any) => n.id !== 'original-node');
    expect(pasted!.data.text).toBe('Original');
  });

  test('pasted node is selected, original is deselected', async ({ page }) => {
    await page.evaluate(() => {
      const store = (window as any).__POWERNOTE_STORES__.canvas.getState();
      store.addNode({
        id: 'original-node',
        type: 'text',
        x: 200,
        y: 200,
        width: 120,
        height: 30,
        data: { text: 'Original', fontSize: 16, fontFamily: 'Inter', fontStyle: 'normal', fill: '#1a1a1a' },
      });
      store.selectNode('original-node', false);
    });
    await page.waitForTimeout(200);

    await page.keyboard.press('Control+c');
    await page.waitForTimeout(100);
    await page.keyboard.press('Control+v');
    await page.waitForTimeout(200);

    const store = await getCanvasStore(page);
    const pastedNode = store.nodes.find((n: any) => n.id !== 'original-node');

    // Pasted node should be the selected one
    expect(store.selectedNodeIds).toHaveLength(1);
    expect(store.selectedNodeIds[0]).toBe(pastedNode!.id);
    // Original should not be selected
    expect(store.selectedNodeIds).not.toContain('original-node');
  });
});
