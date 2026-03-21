/**
 * Test 26: Selection Actions
 * Covers: Selection actions panel visibility and trash button functionality
 *
 * Verifies that the selection actions panel appears when a node is selected,
 * shows the correct selection count, allows deletion via trash button,
 * and hides when no nodes are selected.
 */
import { test, expect } from '@playwright/test';
import { getCanvasStore, waitForCanvasReady } from '../helpers';

test.describe('26 - Selection Actions', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForCanvasReady(page);
  });

  test('selection actions panel visible when node is selected', async ({ page }) => {
    // Place a text node via store and select it
    await page.evaluate(() => {
      const store = (window as any).__POWERNOTE_STORES__.canvas.getState();
      store.addNode({
        id: 'test-node',
        type: 'text',
        x: 200,
        y: 200,
        width: 120,
        height: 30,
        data: { text: 'Selected text', fontSize: 16, fontFamily: 'Inter', fontStyle: 'normal', fill: '#1a1a1a' },
      });
      store.selectNode('test-node', false);
    });
    await page.waitForTimeout(200);

    await expect(page.locator('[data-testid="selection-actions"]')).toBeVisible();
  });

  test('shows "1 selected" text', async ({ page }) => {
    await page.evaluate(() => {
      const store = (window as any).__POWERNOTE_STORES__.canvas.getState();
      store.addNode({
        id: 'test-node',
        type: 'text',
        x: 200,
        y: 200,
        width: 120,
        height: 30,
        data: { text: 'Selected text', fontSize: 16, fontFamily: 'Inter', fontStyle: 'normal', fill: '#1a1a1a' },
      });
      store.selectNode('test-node', false);
    });
    await page.waitForTimeout(200);

    const panel = page.locator('[data-testid="selection-actions"]');
    await expect(panel).toContainText('1 selected');
  });

  test('trash button deletes the selected node', async ({ page }) => {
    await page.evaluate(() => {
      const store = (window as any).__POWERNOTE_STORES__.canvas.getState();
      store.addNode({
        id: 'test-node',
        type: 'text',
        x: 200,
        y: 200,
        width: 120,
        height: 30,
        data: { text: 'Delete me', fontSize: 16, fontFamily: 'Inter', fontStyle: 'normal', fill: '#1a1a1a' },
      });
      store.selectNode('test-node', false);
    });
    await page.waitForTimeout(200);

    // Click the trash button
    await page.locator('[data-testid="trash-button"]').click();
    await page.waitForTimeout(200);

    const store = await getCanvasStore(page);
    expect(store.nodes).toHaveLength(0);
  });

  test('panel hides when no nodes are selected', async ({ page }) => {
    // No nodes selected initially
    await expect(page.locator('[data-testid="selection-actions"]')).not.toBeVisible();

    // Select a node, then deselect
    await page.evaluate(() => {
      const store = (window as any).__POWERNOTE_STORES__.canvas.getState();
      store.addNode({
        id: 'test-node',
        type: 'text',
        x: 200,
        y: 200,
        width: 120,
        height: 30,
        data: { text: 'Temp', fontSize: 16, fontFamily: 'Inter', fontStyle: 'normal', fill: '#1a1a1a' },
      });
      store.selectNode('test-node', false);
    });
    await page.waitForTimeout(200);

    await expect(page.locator('[data-testid="selection-actions"]')).toBeVisible();

    // Clear selection
    await page.evaluate(() => {
      (window as any).__POWERNOTE_STORES__.canvas.getState().clearSelection();
    });
    await page.waitForTimeout(200);

    await expect(page.locator('[data-testid="selection-actions"]')).not.toBeVisible();
  });
});
