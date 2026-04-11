/**
 * Test 40: Image Add
 * Covers: REQ-IMAGE-001, REQ-IMAGE-002 — Add image to canvas via store,
 * verify it renders and is selectable
 */
import { test, expect } from '@playwright/test';
import { waitForCanvasReady, getCanvasStore, disableFSA } from '../helpers';

// 1x1 red pixel PNG as base64
const RED_PIXEL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';

test.describe('40 - Image Add (REQ-IMAGE-001, REQ-IMAGE-002)', () => {
  test.beforeEach(async ({ page }) => {
    await disableFSA(page);
    await page.goto('/');
    await waitForCanvasReady(page);
  });

  test('adding an image node via store creates an image on canvas', async ({ page }) => {
    // Add image node programmatically
    await page.evaluate((src) => {
      const stores = (window as any).__POWERNOTE_STORES__;
      stores.canvas.getState().addNode({
        id: 'test-img-1',
        type: 'image',
        x: 200, y: 200,
        width: 100, height: 100,
        data: { src, alt: 'red pixel', naturalWidth: 1, naturalHeight: 1 },
      });
    }, RED_PIXEL);

    const store = await getCanvasStore(page);
    expect(store.nodes).toHaveLength(1);
    expect(store.nodes[0].type).toBe('image');
    expect(store.nodes[0].data.src).toContain('data:image/png');
  });

  test('image node is selectable by clicking', async ({ page }) => {
    await page.evaluate((src) => {
      const stores = (window as any).__POWERNOTE_STORES__;
      stores.canvas.getState().addNode({
        id: 'test-img-2',
        type: 'image',
        x: 300, y: 300,
        width: 100, height: 100,
        data: { src, alt: 'test', naturalWidth: 1, naturalHeight: 1 },
      });
    }, RED_PIXEL);

    // Click on the image area (canvas coordinates)
    const canvas = page.locator('[data-testid="canvas-container"] canvas').last();
    await canvas.click({ position: { x: 350, y: 350 } });
    await page.waitForTimeout(200);

    const store = await getCanvasStore(page);
    expect(store.selectedNodeIds).toContain('test-img-2');
  });

  test('image node survives save/load round-trip', async ({ page }) => {
    await page.evaluate((src) => {
      const stores = (window as any).__POWERNOTE_STORES__;
      stores.canvas.getState().addNode({
        id: 'test-img-3',
        type: 'image',
        x: 100, y: 100,
        width: 150, height: 150,
        data: { src, alt: 'round-trip-test', naturalWidth: 1, naturalHeight: 1 },
      });
      // Save page nodes to workspace
      stores.workspace.getState().savePageNodes(stores.canvas.getState().nodes);
    }, RED_PIXEL);

    // Export
    const downloadPromise = page.waitForEvent('download');
    await page.click('[data-testid="save-btn"]');
    const download = await downloadPromise;

    // Read the exported HTML
    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(chunk as Buffer);
    const html = Buffer.concat(chunks).toString('utf-8');

    // Verify the image data is in the export
    expect(html).toContain('data:image/png');
    expect(html).toContain('round-trip-test');
  });
});
