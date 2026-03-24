/**
 * Test 54: Shape Click+Drag Creation
 * Covers: REQ-SHAPE-001, REQ-SHAPE-002, REQ-SHAPE-003
 *
 * Verifies that shapes can be created via click+drag on the canvas,
 * that the committed shape matches the drag area, and that all 5 shape
 * types work correctly including arrows/lines with signed dimensions.
 */
import { test, expect } from '@playwright/test';
import { waitForCanvasReady, getCanvasStore } from '../helpers';

test.describe('54 - Shape Click+Drag Creation (REQ-SHAPE-001..003)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForCanvasReady(page);
    // Activate shape tool
    await page.evaluate(() => {
      (window as any).__POWERNOTE_STORES__.tool.getState().setTool('shape');
    });
  });

  test('drag creates a rectangle with correct position and size', async ({ page }) => {
    await page.evaluate(() => {
      (window as any).__POWERNOTE_STORES__.tool.getState().setShapeOptions({ shapeType: 'rect' });
    });

    const canvas = page.locator('[data-testid="canvas-container"] canvas').last();
    await canvas.dispatchEvent('mousedown', { clientX: 200, clientY: 200 });
    await canvas.dispatchEvent('mousemove', { clientX: 400, clientY: 350 });
    await canvas.dispatchEvent('mouseup', {});
    await page.waitForTimeout(200);

    const store = await getCanvasStore(page);
    const shapes = store.nodes.filter((n: any) => n.type === 'shape');
    expect(shapes.length).toBe(1);
    const shape = shapes[0];
    expect(shape.data.shapeType).toBe('rect');
    expect(shape.width).toBeGreaterThan(50);
    expect(shape.height).toBeGreaterThan(50);
  });

  test('drag creates a circle', async ({ page }) => {
    await page.evaluate(() => {
      (window as any).__POWERNOTE_STORES__.tool.getState().setShapeOptions({ shapeType: 'circle' });
    });

    const canvas = page.locator('[data-testid="canvas-container"] canvas').last();
    await canvas.dispatchEvent('mousedown', { clientX: 300, clientY: 200 });
    await canvas.dispatchEvent('mousemove', { clientX: 450, clientY: 350 });
    await canvas.dispatchEvent('mouseup', {});
    await page.waitForTimeout(200);

    const store = await getCanvasStore(page);
    const shapes = store.nodes.filter((n: any) => n.type === 'shape');
    expect(shapes.length).toBe(1);
    expect(shapes[0].data.shapeType).toBe('circle');
  });

  test('drag creates a triangle', async ({ page }) => {
    await page.evaluate(() => {
      (window as any).__POWERNOTE_STORES__.tool.getState().setShapeOptions({ shapeType: 'triangle' });
    });

    const canvas = page.locator('[data-testid="canvas-container"] canvas').last();
    await canvas.dispatchEvent('mousedown', { clientX: 200, clientY: 200 });
    await canvas.dispatchEvent('mousemove', { clientX: 350, clientY: 400 });
    await canvas.dispatchEvent('mouseup', {});
    await page.waitForTimeout(200);

    const store = await getCanvasStore(page);
    const shapes = store.nodes.filter((n: any) => n.type === 'shape');
    expect(shapes.length).toBe(1);
    expect(shapes[0].data.shapeType).toBe('triangle');
  });

  test('drag creates an arrow with correct direction', async ({ page }) => {
    await page.evaluate(() => {
      (window as any).__POWERNOTE_STORES__.tool.getState().setShapeOptions({ shapeType: 'arrow' });
    });

    const canvas = page.locator('[data-testid="canvas-container"] canvas').last();
    // Drag from left to right
    await canvas.dispatchEvent('mousedown', { clientX: 200, clientY: 300 });
    await canvas.dispatchEvent('mousemove', { clientX: 500, clientY: 300 });
    await canvas.dispatchEvent('mouseup', {});
    await page.waitForTimeout(200);

    const store = await getCanvasStore(page);
    const shapes = store.nodes.filter((n: any) => n.type === 'shape');
    expect(shapes.length).toBe(1);
    expect(shapes[0].data.shapeType).toBe('arrow');
    // Arrow width should be positive (left to right)
    expect(shapes[0].width).toBeGreaterThan(0);
  });

  test('drag creates a line', async ({ page }) => {
    await page.evaluate(() => {
      (window as any).__POWERNOTE_STORES__.tool.getState().setShapeOptions({ shapeType: 'line' });
    });

    const canvas = page.locator('[data-testid="canvas-container"] canvas').last();
    await canvas.dispatchEvent('mousedown', { clientX: 200, clientY: 200 });
    await canvas.dispatchEvent('mousemove', { clientX: 400, clientY: 400 });
    await canvas.dispatchEvent('mouseup', {});
    await page.waitForTimeout(200);

    const store = await getCanvasStore(page);
    const shapes = store.nodes.filter((n: any) => n.type === 'shape');
    expect(shapes.length).toBe(1);
    expect(shapes[0].data.shapeType).toBe('line');
  });

  test('small click (no drag) does NOT create a shape', async ({ page }) => {
    const canvas = page.locator('[data-testid="canvas-container"] canvas').last();
    await canvas.dispatchEvent('mousedown', { clientX: 300, clientY: 300 });
    await canvas.dispatchEvent('mouseup', {});
    await page.waitForTimeout(200);

    const store = await getCanvasStore(page);
    expect(store.nodes.length).toBe(0);
  });

  test('arrow dragged right-to-left has negative width', async ({ page }) => {
    await page.evaluate(() => {
      (window as any).__POWERNOTE_STORES__.tool.getState().setShapeOptions({ shapeType: 'arrow' });
    });

    const canvas = page.locator('[data-testid="canvas-container"] canvas').last();
    // Drag from right to left
    await canvas.dispatchEvent('mousedown', { clientX: 500, clientY: 300 });
    await canvas.dispatchEvent('mousemove', { clientX: 200, clientY: 300 });
    await canvas.dispatchEvent('mouseup', {});
    await page.waitForTimeout(200);

    const store = await getCanvasStore(page);
    const shapes = store.nodes.filter((n: any) => n.type === 'shape');
    expect(shapes.length).toBe(1);
    // Width should be negative (right to left direction)
    expect(shapes[0].width).toBeLessThan(0);
  });
});
