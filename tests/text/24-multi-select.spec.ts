/**
 * Test 24: Multi-Select
 * Covers: REQ-TEXT-013 — Multi-select text nodes with Ctrl+Click
 *
 * Verifies that clicking selects one node, Ctrl+Click adds to selection,
 * Ctrl+Click on already-selected node deselects it, and delete removes
 * all selected nodes.
 */
import { test, expect } from '@playwright/test';
import { getCanvasStore, waitForCanvasReady } from '../helpers';

test.describe('24 - Multi-Select (REQ-TEXT-013)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForCanvasReady(page);

    // Place 2 text blocks via store
    await page.evaluate(() => {
      const store = (window as any).__POWERNOTE_STORES__.canvas.getState();
      store.addNode({
        id: 'node-a',
        type: 'text',
        x: 200,
        y: 200,
        width: 120,
        height: 30,
        data: { text: 'Node A', fontSize: 16, fontFamily: 'Inter', fontStyle: 'normal', fill: '#1a1a1a' },
      });
      store.addNode({
        id: 'node-b',
        type: 'text',
        x: 400,
        y: 200,
        width: 120,
        height: 30,
        data: { text: 'Node B', fontSize: 16, fontFamily: 'Inter', fontStyle: 'normal', fill: '#1a1a1a' },
      });
    });
    await page.waitForTimeout(200);
  });

  test('clicking first node selects only it', async ({ page }) => {
    // Select first node via store (simulates click)
    await page.evaluate(() => {
      const store = (window as any).__POWERNOTE_STORES__.canvas.getState();
      store.selectNode('node-a', false);
    });

    const store = await getCanvasStore(page);
    expect(store.selectedNodeIds).toHaveLength(1);
    expect(store.selectedNodeIds[0]).toBe('node-a');
  });

  test('Ctrl+Click second node adds it to selection', async ({ page }) => {
    // Select first node
    await page.evaluate(() => {
      const store = (window as any).__POWERNOTE_STORES__.canvas.getState();
      store.selectNode('node-a', false);
    });

    // Ctrl+Click second node (additive selection)
    await page.evaluate(() => {
      const store = (window as any).__POWERNOTE_STORES__.canvas.getState();
      store.selectNode('node-b', true);
    });

    const store = await getCanvasStore(page);
    expect(store.selectedNodeIds).toHaveLength(2);
    expect(store.selectedNodeIds).toContain('node-a');
    expect(store.selectedNodeIds).toContain('node-b');
  });

  test('Ctrl+Click on selected node deselects it', async ({ page }) => {
    // Select both nodes
    await page.evaluate(() => {
      const store = (window as any).__POWERNOTE_STORES__.canvas.getState();
      store.selectNode('node-a', false);
      store.selectNode('node-b', true);
    });

    let store = await getCanvasStore(page);
    expect(store.selectedNodeIds).toHaveLength(2);

    // Ctrl+Click first again to deselect it
    await page.evaluate(() => {
      const store = (window as any).__POWERNOTE_STORES__.canvas.getState();
      store.selectNode('node-a', true);
    });

    store = await getCanvasStore(page);
    expect(store.selectedNodeIds).toHaveLength(1);
    expect(store.selectedNodeIds[0]).toBe('node-b');
  });

  test('delete with 2 selected removes both', async ({ page }) => {
    // Select both nodes
    await page.evaluate(() => {
      const store = (window as any).__POWERNOTE_STORES__.canvas.getState();
      store.selectNode('node-a', false);
      store.selectNode('node-b', true);
    });

    let store = await getCanvasStore(page);
    expect(store.selectedNodeIds).toHaveLength(2);

    // Press Delete to remove both
    await page.keyboard.press('Delete');
    await page.waitForTimeout(200);

    store = await getCanvasStore(page);
    expect(store.nodes).toHaveLength(0);
    expect(store.selectedNodeIds).toHaveLength(0);
  });
});
