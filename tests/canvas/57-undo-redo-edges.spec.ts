/**
 * Test 57: Undo/Redo Edge Cases
 * Covers: REQ-CANVAS-007, REQ-CANVAS-008, REQ-CANVAS-009
 *
 * Verifies edge cases for the undo/redo system: empty history,
 * empty redo stack, page-switch history reset, rapid undos.
 */
import { test, expect } from '@playwright/test';
import { getCanvasStore, waitForCanvasReady, activateTool, clickCanvas } from '../helpers';

test.describe('57 - Undo/Redo Edge Cases (REQ-CANVAS-007..009)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForCanvasReady(page);
  });

  test('undo with empty history does nothing', async ({ page }) => {
    // Canvas starts empty, no actions performed
    const storeBefore = await getCanvasStore(page);
    expect(storeBefore.nodes).toHaveLength(0);

    // Press undo — should not crash or change state
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(200);

    const storeAfter = await getCanvasStore(page);
    expect(storeAfter.nodes).toHaveLength(0);
  });

  test('redo with empty redo stack does nothing', async ({ page }) => {
    // Canvas starts empty, no undo performed
    const storeBefore = await getCanvasStore(page);
    expect(storeBefore.nodes).toHaveLength(0);

    // Press redo — should not crash or change state
    await page.keyboard.press('Control+Shift+z');
    await page.waitForTimeout(200);

    const storeAfter = await getCanvasStore(page);
    expect(storeAfter.nodes).toHaveLength(0);
  });

  test('undo after page switch starts fresh (no effect)', async ({ page }) => {
    // Place a node on page 1
    await page.evaluate(() => {
      const store = (window as any).__POWERNOTE_STORES__.canvas.getState();
      store.addNode({
        id: 'page1-node',
        type: 'text',
        x: 200, y: 200, width: 120, height: 30,
        data: { text: 'Page 1', fontSize: 16, fontFamily: 'Inter', fontStyle: 'normal', fill: '#1a1a1a' },
      });
    });
    await page.waitForTimeout(200);

    // Open hierarchy panel and add a second section
    await activateTool(page, 'hierarchy');
    await expect(page.locator('[data-testid="hierarchy-panel"]')).toBeVisible();
    await page.locator('[data-testid="add-section-btn"]').click();
    await page.waitForTimeout(200);

    // Navigate to page 2
    const pageButtons = page.locator('.hierarchy-page');
    await pageButtons.nth(1).click();
    await page.waitForTimeout(300);

    // Place a node on page 2
    await page.evaluate(() => {
      const store = (window as any).__POWERNOTE_STORES__.canvas.getState();
      store.addNode({
        id: 'page2-node',
        type: 'text',
        x: 300, y: 300, width: 120, height: 30,
        data: { text: 'Page 2', fontSize: 16, fontFamily: 'Inter', fontStyle: 'normal', fill: '#1a1a1a' },
      });
    });
    await page.waitForTimeout(200);

    // Navigate back to page 1
    await pageButtons.nth(0).click();
    await page.waitForTimeout(300);

    // Undo should have no effect (history cleared on page switch)
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(200);

    const store = await getCanvasStore(page);
    expect(store.nodes).toHaveLength(1);
    expect(store.nodes[0].id).toBe('page1-node');
  });

  test('multiple rapid undos do not crash', async ({ page }) => {
    // Place 5 text blocks via store rapidly
    await page.evaluate(() => {
      const store = (window as any).__POWERNOTE_STORES__.canvas.getState();
      for (let i = 0; i < 5; i++) {
        store.addNode({
          id: `rapid-node-${i}`,
          type: 'text',
          x: 100 + i * 100, y: 200, width: 80, height: 30,
          data: { text: `N${i}`, fontSize: 16, fontFamily: 'Inter', fontStyle: 'normal', fill: '#1a1a1a' },
        });
      }
    });
    await page.waitForTimeout(200);

    let store = await getCanvasStore(page);
    expect(store.nodes).toHaveLength(5);

    // Fire 10 rapid undos (more than history length)
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press('Control+z');
    }
    await page.waitForTimeout(300);

    // Should not crash, nodes should be 0
    store = await getCanvasStore(page);
    expect(store.nodes).toHaveLength(0);
  });

  test('undo then redo then undo produces consistent state', async ({ page }) => {
    // Place a node
    await page.evaluate(() => {
      const store = (window as any).__POWERNOTE_STORES__.canvas.getState();
      store.addNode({
        id: 'bounce-node',
        type: 'text',
        x: 200, y: 200, width: 100, height: 30,
        data: { text: 'Bounce', fontSize: 16, fontFamily: 'Inter', fontStyle: 'normal', fill: '#1a1a1a' },
      });
    });
    await page.waitForTimeout(200);

    let store = await getCanvasStore(page);
    expect(store.nodes).toHaveLength(1);

    // Undo → 0 nodes
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(200);
    store = await getCanvasStore(page);
    expect(store.nodes).toHaveLength(0);

    // Redo → 1 node
    await page.keyboard.press('Control+Shift+z');
    await page.waitForTimeout(200);
    store = await getCanvasStore(page);
    expect(store.nodes).toHaveLength(1);

    // Undo again → 0 nodes
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(200);
    store = await getCanvasStore(page);
    expect(store.nodes).toHaveLength(0);
  });

  test('redo stack clears after a new action', async ({ page }) => {
    // Place 2 nodes
    await page.evaluate(() => {
      const store = (window as any).__POWERNOTE_STORES__.canvas.getState();
      store.addNode({
        id: 'redo-test-1',
        type: 'text',
        x: 200, y: 200, width: 100, height: 30,
        data: { text: 'First', fontSize: 16, fontFamily: 'Inter', fontStyle: 'normal', fill: '#1a1a1a' },
      });
    });
    await page.waitForTimeout(100);

    await page.evaluate(() => {
      const store = (window as any).__POWERNOTE_STORES__.canvas.getState();
      store.addNode({
        id: 'redo-test-2',
        type: 'text',
        x: 400, y: 200, width: 100, height: 30,
        data: { text: 'Second', fontSize: 16, fontFamily: 'Inter', fontStyle: 'normal', fill: '#1a1a1a' },
      });
    });
    await page.waitForTimeout(200);

    let store = await getCanvasStore(page);
    expect(store.nodes).toHaveLength(2);

    // Undo last → 1 node
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(200);
    store = await getCanvasStore(page);
    expect(store.nodes).toHaveLength(1);

    // Now add a new node (should clear redo stack)
    await page.evaluate(() => {
      const store = (window as any).__POWERNOTE_STORES__.canvas.getState();
      store.addNode({
        id: 'redo-test-3',
        type: 'text',
        x: 300, y: 300, width: 100, height: 30,
        data: { text: 'Third', fontSize: 16, fontFamily: 'Inter', fontStyle: 'normal', fill: '#1a1a1a' },
      });
    });
    await page.waitForTimeout(200);

    store = await getCanvasStore(page);
    expect(store.nodes).toHaveLength(2);

    // Redo should have no effect (redo stack was cleared by new action)
    await page.keyboard.press('Control+Shift+z');
    await page.waitForTimeout(200);
    store = await getCanvasStore(page);
    expect(store.nodes).toHaveLength(2);
  });
});
