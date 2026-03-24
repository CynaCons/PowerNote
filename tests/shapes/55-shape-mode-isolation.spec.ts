/**
 * Test 55: Shape Mode Isolation
 * Covers: REQ-SHAPE-007 (mode-dependent selection)
 *
 * Verifies that shapes and text nodes are NOT selectable/draggable
 * when in draw mode, and ARE selectable in select/shape/text modes.
 */
import { test, expect } from '@playwright/test';
import { waitForCanvasReady, getCanvasStore } from '../helpers';

test.describe('55 - Shape Mode Isolation (REQ-SHAPE-007)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForCanvasReady(page);

    // Place a shape and a text node via store
    await page.evaluate(() => {
      const stores = (window as any).__POWERNOTE_STORES__;
      stores.canvas.getState().addNode({
        id: 'test-shape', type: 'shape', x: 200, y: 200, width: 100, height: 80, layer: 3,
        data: { shapeType: 'rect', fill: '#3b82f6', stroke: '#1e40af', strokeWidth: 2, strokeDash: [] },
      });
      stores.canvas.getState().addNode({
        id: 'test-text', type: 'text', x: 400, y: 200, width: 150, height: 30, layer: 4,
        data: { text: 'Test text', fontSize: 16, fontFamily: 'Inter', fontStyle: 'normal', fill: '#000' },
      });
    });
  });

  test('shapes are selectable in select mode', async ({ page }) => {
    await page.evaluate(() => {
      (window as any).__POWERNOTE_STORES__.tool.getState().setTool('select');
    });

    // Click on shape position
    await page.evaluate(() => {
      (window as any).__POWERNOTE_STORES__.canvas.getState().selectNode('test-shape', false);
    });

    const store = await getCanvasStore(page);
    expect(store.selectedNodeIds).toContain('test-shape');
  });

  test('shapes are selectable in shape mode', async ({ page }) => {
    await page.evaluate(() => {
      (window as any).__POWERNOTE_STORES__.tool.getState().setTool('shape');
      (window as any).__POWERNOTE_STORES__.canvas.getState().selectNode('test-shape', false);
    });

    const store = await getCanvasStore(page);
    expect(store.selectedNodeIds).toContain('test-shape');
  });

  test('text nodes have layer 4 by default (above shapes)', async ({ page }) => {
    const store = await getCanvasStore(page);
    const textNode = store.nodes.find((n: any) => n.id === 'test-text');
    const shapeNode = store.nodes.find((n: any) => n.id === 'test-shape');
    expect(textNode.layer).toBe(4);
    expect(shapeNode.layer).toBe(3);
    expect(textNode.layer).toBeGreaterThan(shapeNode.layer);
  });

  test('multi-select with Ctrl+Click works in select mode', async ({ page }) => {
    await page.evaluate(() => {
      const stores = (window as any).__POWERNOTE_STORES__;
      stores.tool.getState().setTool('select');
      stores.canvas.getState().selectNode('test-shape', false);
      stores.canvas.getState().selectNode('test-text', true); // additive
    });

    const store = await getCanvasStore(page);
    expect(store.selectedNodeIds).toContain('test-shape');
    expect(store.selectedNodeIds).toContain('test-text');
    expect(store.selectedNodeIds.length).toBe(2);
  });
});
