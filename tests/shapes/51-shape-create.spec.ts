/**
 * Test 51: Shape Create
 * Covers: REQ-SHAPE-001, REQ-SHAPE-002, REQ-SHAPE-003, REQ-SHAPE-008,
 *         REQ-SHAPE-009, REQ-SHAPE-010, REQ-SHAPE-011, REQ-SHAPE-013,
 *         REQ-SHAPE-015
 *
 * Verifies that each shape type can be created via the store, that shape nodes
 * appear in the canvas, are selectable, deletable, copyable, and persist
 * through save/load.
 */
import { test, expect } from '@playwright/test';
import { waitForCanvasReady, getCanvasStore } from '../helpers';

const SHAPE_TYPES = ['rect', 'circle', 'triangle', 'arrow', 'line'] as const;

/** Helper: add a shape node via the store */
async function addShapeViaStore(
  page: import('@playwright/test').Page,
  opts: {
    id: string;
    shapeType: string;
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    fill?: string;
    stroke?: string;
    strokeWidth?: number;
    strokeDash?: number[];
  },
) {
  await page.evaluate((o) => {
    const stores = (window as any).__POWERNOTE_STORES__;
    stores.canvas.getState().addNode({
      id: o.id,
      type: 'shape',
      x: o.x ?? 200,
      y: o.y ?? 200,
      width: o.width ?? 120,
      height: o.height ?? 80,
      layer: 3,
      data: {
        shapeType: o.shapeType,
        fill: o.fill ?? 'transparent',
        stroke: o.stroke ?? '#1a1a1a',
        strokeWidth: o.strokeWidth ?? 2,
        strokeDash: o.strokeDash ?? [],
      },
    });
  }, opts);
}

test.describe('51 - Shape Create (REQ-SHAPE-001..003, 008..011, 013, 015)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForCanvasReady(page);
  });

  for (const shapeType of SHAPE_TYPES) {
    test(`adding a ${shapeType} shape via store creates a node`, async ({ page }) => {
      const id = `test-shape-${shapeType}`;
      await addShapeViaStore(page, { id, shapeType });

      const store = await getCanvasStore(page);
      expect(store.nodes).toHaveLength(1);
      expect(store.nodes[0].type).toBe('shape');
      expect((store.nodes[0].data as any).shapeType).toBe(shapeType);
    });
  }

  test('shape node has correct initial properties (REQ-SHAPE-003)', async ({ page }) => {
    await addShapeViaStore(page, {
      id: 'test-shape-props',
      shapeType: 'rect',
      x: 150,
      y: 250,
      width: 200,
      height: 100,
      fill: '#dbeafe',
      stroke: '#2563eb',
      strokeWidth: 3,
      strokeDash: [8, 4],
    });

    const store = await getCanvasStore(page);
    const node = store.nodes[0];
    expect(node.type).toBe('shape');
    expect(node.x).toBe(150);
    expect(node.y).toBe(250);
    expect(node.width).toBe(200);
    expect(node.height).toBe(100);

    const data = node.data as any;
    expect(data.shapeType).toBe('rect');
    expect(data.fill).toBe('#dbeafe');
    expect(data.stroke).toBe('#2563eb');
    expect(data.strokeWidth).toBe(3);
    expect(data.strokeDash).toEqual([8, 4]);
  });

  test('shape node is selectable by clicking (REQ-SHAPE-008)', async ({ page }) => {
    await addShapeViaStore(page, {
      id: 'test-shape-select',
      shapeType: 'rect',
      x: 300,
      y: 300,
      width: 120,
      height: 80,
    });

    // Click on the shape area
    const canvas = page.locator('[data-testid="canvas-container"] canvas').last();
    await canvas.click({ position: { x: 360, y: 340 } });
    await page.waitForTimeout(200);

    const store = await getCanvasStore(page);
    expect(store.selectedNodeIds).toContain('test-shape-select');
  });

  test('shape node is deleted with Delete key (REQ-SHAPE-011)', async ({ page }) => {
    await addShapeViaStore(page, {
      id: 'test-shape-del',
      shapeType: 'circle',
      x: 300,
      y: 300,
      width: 100,
      height: 100,
    });

    // Select it
    await page.evaluate(() => {
      const stores = (window as any).__POWERNOTE_STORES__;
      stores.canvas.getState().selectNode('test-shape-del', false);
    });

    let store = await getCanvasStore(page);
    expect(store.nodes).toHaveLength(1);

    // Press Delete
    await page.keyboard.press('Delete');
    await page.waitForTimeout(200);

    store = await getCanvasStore(page);
    expect(store.nodes).toHaveLength(0);
  });

  test('copy-paste duplicates shape with offset (REQ-SHAPE-013)', async ({ page }) => {
    await addShapeViaStore(page, {
      id: 'test-shape-copy',
      shapeType: 'triangle',
      x: 200,
      y: 200,
      width: 100,
      height: 80,
      fill: '#fecaca',
      stroke: '#dc2626',
    });

    // Select the shape
    await page.evaluate(() => {
      const stores = (window as any).__POWERNOTE_STORES__;
      stores.canvas.getState().selectNode('test-shape-copy', false);
    });

    // Copy + Paste via store
    await page.evaluate(() => {
      const stores = (window as any).__POWERNOTE_STORES__;
      stores.canvas.getState().copySelectedNodes();
      stores.canvas.getState().pasteNodes();
    });

    await page.waitForTimeout(200);

    const store = await getCanvasStore(page);
    expect(store.nodes).toHaveLength(2);

    const original = store.nodes.find((n: any) => n.id === 'test-shape-copy');
    const pasted = store.nodes.find((n: any) => n.id !== 'test-shape-copy');
    expect(pasted).toBeDefined();
    expect((pasted!.data as any).shapeType).toBe('triangle');
    expect((pasted!.data as any).fill).toBe('#fecaca');
    expect((pasted!.data as any).stroke).toBe('#dc2626');
    // Pasted node should be offset from original
    expect(pasted!.x).toBeGreaterThan(original!.x);
    expect(pasted!.y).toBeGreaterThan(original!.y);
  });

  test('shape default layer is 3 (z-index system)', async ({ page }) => {
    await addShapeViaStore(page, {
      id: 'test-shape-layer',
      shapeType: 'rect',
    });

    const store = await getCanvasStore(page);
    expect(store.nodes[0].layer).toBe(3);
  });

  test('shape survives page save/reload (REQ-SHAPE-015)', async ({ page }) => {
    await addShapeViaStore(page, {
      id: 'test-shape-persist',
      shapeType: 'arrow',
      x: 100,
      y: 100,
      width: 200,
      height: 50,
      fill: 'transparent',
      stroke: '#16a34a',
      strokeWidth: 4,
      strokeDash: [2, 2],
    });

    // Save page nodes to workspace then reload them
    await page.evaluate(() => {
      const stores = (window as any).__POWERNOTE_STORES__;
      const nodes = stores.canvas.getState().nodes;
      stores.workspace.getState().savePageNodes(nodes);
      // Clear canvas
      stores.canvas.getState().loadPageNodes([]);
    });

    // Verify canvas is empty
    let store = await getCanvasStore(page);
    expect(store.nodes).toHaveLength(0);

    // Reload from workspace
    await page.evaluate(() => {
      const stores = (window as any).__POWERNOTE_STORES__;
      const ws = stores.workspace.getState();
      const activePage = ws.getActivePage();
      stores.canvas.getState().loadPageNodes(activePage.nodes);
    });

    store = await getCanvasStore(page);
    expect(store.nodes).toHaveLength(1);

    const shapeNode = store.nodes[0];
    expect(shapeNode.type).toBe('shape');
    expect((shapeNode.data as any).shapeType).toBe('arrow');
    expect((shapeNode.data as any).stroke).toBe('#16a34a');
    expect((shapeNode.data as any).strokeWidth).toBe(4);
    expect((shapeNode.data as any).strokeDash).toEqual([2, 2]);
    expect(shapeNode.x).toBe(100);
    expect(shapeNode.y).toBe(100);
    expect(shapeNode.width).toBe(200);
    expect(shapeNode.height).toBe(50);
  });

  test('multiple shapes can coexist on canvas', async ({ page }) => {
    for (const [i, shapeType] of SHAPE_TYPES.entries()) {
      await addShapeViaStore(page, {
        id: `multi-shape-${shapeType}`,
        shapeType,
        x: 100 + i * 150,
        y: 200,
      });
    }

    const store = await getCanvasStore(page);
    expect(store.nodes).toHaveLength(5);

    const types = store.nodes.map((n: any) => n.data.shapeType);
    expect(types).toEqual(['rect', 'circle', 'triangle', 'arrow', 'line']);
  });
});
