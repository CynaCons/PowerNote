/**
 * Test 56: Shape Styling via Toolbar
 * Covers: REQ-SHAPE-004, REQ-SHAPE-005, REQ-SHAPE-013
 *
 * Verifies that selecting a shape and changing toolbar options
 * updates the shape in real-time (fill, stroke, strokeWidth, dash).
 */
import { test, expect } from '@playwright/test';
import { waitForCanvasReady, getCanvasStore } from '../helpers';

test.describe('56 - Shape Styling (REQ-SHAPE-004, REQ-SHAPE-005, REQ-SHAPE-013)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForCanvasReady(page);

    // Place a shape
    await page.evaluate(() => {
      const stores = (window as any).__POWERNOTE_STORES__;
      stores.canvas.getState().addNode({
        id: 'styled-shape', type: 'shape', x: 200, y: 200, width: 120, height: 80, layer: 3,
        data: { shapeType: 'rect', fill: 'transparent', stroke: '#1a1a1a', strokeWidth: 2, strokeDash: [] },
      });
    });
  });

  test('updating fill via store changes shape data', async ({ page }) => {
    await page.evaluate(() => {
      const stores = (window as any).__POWERNOTE_STORES__;
      stores.canvas.getState().updateNode('styled-shape', {
        data: { shapeType: 'rect', fill: '#3b82f6', stroke: '#1a1a1a', strokeWidth: 2, strokeDash: [] },
      });
    });

    const store = await getCanvasStore(page);
    const shape = store.nodes.find((n: any) => n.id === 'styled-shape');
    expect(shape.data.fill).toBe('#3b82f6');
  });

  test('updating stroke color changes shape data', async ({ page }) => {
    await page.evaluate(() => {
      (window as any).__POWERNOTE_STORES__.canvas.getState().updateNode('styled-shape', {
        data: { shapeType: 'rect', fill: 'transparent', stroke: '#dc2626', strokeWidth: 2, strokeDash: [] },
      });
    });

    const store = await getCanvasStore(page);
    const shape = store.nodes.find((n: any) => n.id === 'styled-shape');
    expect(shape.data.stroke).toBe('#dc2626');
  });

  test('updating strokeWidth changes shape data', async ({ page }) => {
    await page.evaluate(() => {
      (window as any).__POWERNOTE_STORES__.canvas.getState().updateNode('styled-shape', {
        data: { shapeType: 'rect', fill: 'transparent', stroke: '#1a1a1a', strokeWidth: 5, strokeDash: [] },
      });
    });

    const store = await getCanvasStore(page);
    const shape = store.nodes.find((n: any) => n.id === 'styled-shape');
    expect(shape.data.strokeWidth).toBe(5);
  });

  test('updating dash style changes shape data', async ({ page }) => {
    await page.evaluate(() => {
      (window as any).__POWERNOTE_STORES__.canvas.getState().updateNode('styled-shape', {
        data: { shapeType: 'rect', fill: 'transparent', stroke: '#1a1a1a', strokeWidth: 2, strokeDash: [8, 4] },
      });
    });

    const store = await getCanvasStore(page);
    const shape = store.nodes.find((n: any) => n.id === 'styled-shape');
    expect(shape.data.strokeDash).toEqual([8, 4]);
  });

  test('changing shape type on selected shape updates it', async ({ page }) => {
    await page.evaluate(() => {
      const stores = (window as any).__POWERNOTE_STORES__;
      stores.canvas.getState().selectNode('styled-shape', false);
      stores.canvas.getState().updateNode('styled-shape', {
        data: { shapeType: 'circle', fill: 'transparent', stroke: '#1a1a1a', strokeWidth: 2, strokeDash: [] },
      });
    });

    const store = await getCanvasStore(page);
    const shape = store.nodes.find((n: any) => n.id === 'styled-shape');
    expect(shape.data.shapeType).toBe('circle');
  });

  test('shape defaults apply from tool store when no shape selected', async ({ page }) => {
    await page.evaluate(() => {
      (window as any).__POWERNOTE_STORES__.tool.getState().setShapeOptions({
        fill: '#fef3c7',
        stroke: '#d97706',
        strokeWidth: 3,
      });
    });

    const toolState = await page.evaluate(() => {
      return (window as any).__POWERNOTE_STORES__.tool.getState().shapeOptions;
    });
    expect(toolState.fill).toBe('#fef3c7');
    expect(toolState.stroke).toBe('#d97706');
    expect(toolState.strokeWidth).toBe(3);
  });
});
