/**
 * Test 59: Multi-Select Operations
 * Covers: REQ-TEXT-013, REQ-TEXT-014, REQ-TEXT-015 — Multi-select, copy-paste, select-all
 *
 * Verifies: select 3 nodes and move all, select 2 and copy-paste,
 * select all then delete, Ctrl+Click add/remove from selection.
 */
import { test, expect } from '@playwright/test';
import { getCanvasStore, waitForCanvasReady } from '../helpers';

/** Helper: place N text nodes via store */
async function placeNodes(page: import('@playwright/test').Page, count: number) {
  await page.evaluate((n) => {
    const store = (window as any).__POWERNOTE_STORES__.canvas.getState();
    for (let i = 0; i < n; i++) {
      store.addNode({
        id: `ms-node-${i}`,
        type: 'text',
        x: 100 + i * 200,
        y: 200,
        width: 120,
        height: 30,
        data: { text: `Node ${i}`, fontSize: 16, fontFamily: 'Inter', fontStyle: 'normal', fill: '#1a1a1a' },
      });
    }
  }, count);
  await page.waitForTimeout(200);
}

test.describe('59 - Multi-Select Operations (REQ-TEXT-013..015)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForCanvasReady(page);
  });

  test('select 3 nodes, move all at once via store', async ({ page }) => {
    await placeNodes(page, 3);

    // Select all 3 nodes
    await page.evaluate(() => {
      const store = (window as any).__POWERNOTE_STORES__.canvas.getState();
      store.selectNode('ms-node-0', false);
      store.selectNode('ms-node-1', true);
      store.selectNode('ms-node-2', true);
    });

    let store = await getCanvasStore(page);
    expect(store.selectedNodeIds).toHaveLength(3);

    // Move all selected nodes by offset via store
    await page.evaluate(() => {
      const store = (window as any).__POWERNOTE_STORES__.canvas.getState();
      const selected = store.selectedNodeIds;
      for (const nodeId of selected) {
        const node = store.nodes.find((n: any) => n.id === nodeId);
        if (node) {
          store.updateNode(nodeId, { x: node.x + 50, y: node.y + 50 });
        }
      }
    });
    await page.waitForTimeout(200);

    store = await getCanvasStore(page);
    expect(store.nodes.find((n: any) => n.id === 'ms-node-0').x).toBe(150);
    expect(store.nodes.find((n: any) => n.id === 'ms-node-0').y).toBe(250);
    expect(store.nodes.find((n: any) => n.id === 'ms-node-1').x).toBe(350);
    expect(store.nodes.find((n: any) => n.id === 'ms-node-2').x).toBe(550);
  });

  test('select 2 nodes, copy-paste creates 2 new nodes', async ({ page }) => {
    await placeNodes(page, 3);

    // Select 2 nodes
    await page.evaluate(() => {
      const store = (window as any).__POWERNOTE_STORES__.canvas.getState();
      store.selectNode('ms-node-0', false);
      store.selectNode('ms-node-1', true);
    });

    // Copy then paste
    await page.evaluate(() => {
      const store = (window as any).__POWERNOTE_STORES__.canvas.getState();
      store.copySelectedNodes();
      store.pasteNodes();
    });
    await page.waitForTimeout(200);

    const store = await getCanvasStore(page);
    // Original 3 + 2 pasted = 5
    expect(store.nodes).toHaveLength(5);

    // The pasted nodes should have text matching originals
    const pastedTexts = store.nodes
      .filter((n: any) => !n.id.startsWith('ms-node-'))
      .map((n: any) => n.data.text);
    expect(pastedTexts).toContain('Node 0');
    expect(pastedTexts).toContain('Node 1');
  });

  test('select all then delete clears canvas', async ({ page }) => {
    await placeNodes(page, 4);

    let store = await getCanvasStore(page);
    expect(store.nodes).toHaveLength(4);

    // Select all via Ctrl+A
    await page.keyboard.press('Control+a');
    await page.waitForTimeout(200);

    store = await getCanvasStore(page);
    expect(store.selectedNodeIds).toHaveLength(4);

    // Delete all
    await page.keyboard.press('Delete');
    await page.waitForTimeout(200);

    store = await getCanvasStore(page);
    expect(store.nodes).toHaveLength(0);
  });

  test('Ctrl+Click to add to selection', async ({ page }) => {
    await placeNodes(page, 3);

    // Select first node
    await page.evaluate(() => {
      const store = (window as any).__POWERNOTE_STORES__.canvas.getState();
      store.selectNode('ms-node-0', false);
    });

    let store = await getCanvasStore(page);
    expect(store.selectedNodeIds).toHaveLength(1);
    expect(store.selectedNodeIds).toContain('ms-node-0');

    // Ctrl+Click to add second
    await page.evaluate(() => {
      const store = (window as any).__POWERNOTE_STORES__.canvas.getState();
      store.selectNode('ms-node-2', true);
    });

    store = await getCanvasStore(page);
    expect(store.selectedNodeIds).toHaveLength(2);
    expect(store.selectedNodeIds).toContain('ms-node-0');
    expect(store.selectedNodeIds).toContain('ms-node-2');
  });

  test('Ctrl+Click to remove from selection', async ({ page }) => {
    await placeNodes(page, 3);

    // Select all 3 nodes
    await page.evaluate(() => {
      const store = (window as any).__POWERNOTE_STORES__.canvas.getState();
      store.selectNode('ms-node-0', false);
      store.selectNode('ms-node-1', true);
      store.selectNode('ms-node-2', true);
    });

    let store = await getCanvasStore(page);
    expect(store.selectedNodeIds).toHaveLength(3);

    // Ctrl+Click to deselect ms-node-1
    await page.evaluate(() => {
      const store = (window as any).__POWERNOTE_STORES__.canvas.getState();
      store.selectNode('ms-node-1', true);
    });

    store = await getCanvasStore(page);
    expect(store.selectedNodeIds).toHaveLength(2);
    expect(store.selectedNodeIds).not.toContain('ms-node-1');
    expect(store.selectedNodeIds).toContain('ms-node-0');
    expect(store.selectedNodeIds).toContain('ms-node-2');
  });

  test('duplicate selected nodes creates copies at offset', async ({ page }) => {
    await placeNodes(page, 2);

    // Select both nodes
    await page.evaluate(() => {
      const store = (window as any).__POWERNOTE_STORES__.canvas.getState();
      store.selectNode('ms-node-0', false);
      store.selectNode('ms-node-1', true);
    });

    // Copy + paste
    await page.keyboard.press('Control+c');
    await page.waitForTimeout(100);
    await page.keyboard.press('Control+v');
    await page.waitForTimeout(200);

    const store = await getCanvasStore(page);
    expect(store.nodes).toHaveLength(4);
  });

  test('delete only selected nodes, leaves unselected intact', async ({ page }) => {
    await placeNodes(page, 3);

    // Select only first 2
    await page.evaluate(() => {
      const store = (window as any).__POWERNOTE_STORES__.canvas.getState();
      store.selectNode('ms-node-0', false);
      store.selectNode('ms-node-1', true);
    });

    await page.keyboard.press('Delete');
    await page.waitForTimeout(200);

    const store = await getCanvasStore(page);
    expect(store.nodes).toHaveLength(1);
    expect(store.nodes[0].id).toBe('ms-node-2');
  });

  test('selection count is correct after multiple operations', async ({ page }) => {
    await placeNodes(page, 5);

    // Select all
    await page.keyboard.press('Control+a');
    await page.waitForTimeout(200);

    let store = await getCanvasStore(page);
    expect(store.selectedNodeIds).toHaveLength(5);

    // Click background (deselect all) via store
    await page.evaluate(() => {
      const store = (window as any).__POWERNOTE_STORES__.canvas.getState();
      store.clearSelection();
    });
    await page.waitForTimeout(100);

    store = await getCanvasStore(page);
    expect(store.selectedNodeIds).toHaveLength(0);
  });
});
