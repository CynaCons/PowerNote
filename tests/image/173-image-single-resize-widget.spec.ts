// Covers: REQ-IMAGE-024
/**
 * Test 173: One resize widget per image
 * A single selected image draws only its own aspect-locked corner handles;
 * the generic SelectionTransformer does not attach to it. Shapes and
 * multi-selections keep the transformer. The inner handles keep aspect.
 */
import { test, expect } from '@playwright/test';
import { waitForCanvasReady } from '../helpers';

const PIXEL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';

async function addImage(page: import('@playwright/test').Page, id: string) {
  await page.evaluate(
    ({ src, id }) => {
      const stores = (window as any).__POWERNOTE_STORES__;
      stores.canvas.getState().addNode({
        id,
        type: 'image',
        x: 200,
        y: 200,
        width: 400,
        height: 300,
        data: { src, alt: 'widget-test', naturalWidth: 400, naturalHeight: 300 },
      });
    },
    { src: PIXEL, id },
  );
}

async function transformerState(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const stage = (window as any).Konva.stages[0];
    const t = stage.findOne('Transformer');
    return { attached: t ? t.nodes().length : -1 };
  });
}

test.describe('173 - One resize widget per image (REQ-IMAGE-024)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForCanvasReady(page);
  });

  test('single image: transformer detached, own handles present', async ({ page }) => {
    await addImage(page, 'img-a');
    await page.evaluate(() => {
      (window as any).__POWERNOTE_STORES__.canvas.getState().selectNode('img-a', false);
    });
    await page.waitForTimeout(150);

    expect((await transformerState(page)).attached).toBe(0);

    // The image's own selection chrome: dashed border + 4 corner handles.
    const ownHandles = await page.evaluate(() => {
      const stage = (window as any).Konva.stages[0];
      const el = stage.findOne('#img-a');
      const group = el.parent;
      return group.getChildren((ch: any) =>
        ch.getClassName() === 'Rect' && ch.width() === 10 && ch.height() === 10,
      ).length;
    });
    expect(ownHandles).toBe(4);
  });

  test('single shape still attaches the transformer', async ({ page }) => {
    await page.evaluate(() => {
      const stores = (window as any).__POWERNOTE_STORES__;
      stores.canvas.getState().addNode({
        id: 'shape-a',
        type: 'shape',
        x: 300,
        y: 300,
        width: 120,
        height: 80,
        data: { shapeType: 'rectangle', fill: '#EEF1F0', stroke: '#14181A', strokeWidth: 2, strokeDash: [] },
      });
      stores.canvas.getState().selectNode('shape-a', false);
    });
    await page.waitForTimeout(150);
    expect((await transformerState(page)).attached).toBe(1);
  });

  test('two images: transformer attaches as the multi-select border', async ({ page }) => {
    await addImage(page, 'img-a');
    await addImage(page, 'img-b');
    await page.evaluate(() => {
      const stores = (window as any).__POWERNOTE_STORES__;
      stores.canvas.getState().selectNode('img-a', false);
      stores.canvas.getState().selectNode('img-b', true);
    });
    await page.waitForTimeout(150);
    expect((await transformerState(page)).attached).toBe(2);
  });

  test('inner corner handle resizes with locked aspect via a real mouse drag', async ({ page }) => {
    await addImage(page, 'img-a');
    await page.evaluate(() => {
      (window as any).__POWERNOTE_STORES__.canvas.getState().selectNode('img-a', false);
    });
    await page.waitForTimeout(150);

    // Bottom-right handle sits at node (x+width, y+height) in canvas coords.
    const pt = await page.evaluate(() => {
      const el = document.querySelector('.infinite-canvas')!;
      const r = el.getBoundingClientRect();
      const s = (window as any).__POWERNOTE_STORES__.canvas.getState();
      const vp = s.viewport;
      const n = s.nodes.find((n: any) => n.id === 'img-a');
      return {
        x: r.left + (n.x + n.width) * vp.scale + vp.x,
        y: r.top + (n.y + n.height) * vp.scale + vp.y,
        scale: vp.scale,
      };
    });

    await page.mouse.move(pt.x, pt.y);
    await page.mouse.down();
    await page.mouse.move(pt.x - 100 * pt.scale, pt.y - 20 * pt.scale, { steps: 8 });
    await page.mouse.up();

    const dims = await page.evaluate(() => {
      const n = (window as any).__POWERNOTE_STORES__.canvas
        .getState()
        .nodes.find((n: any) => n.id === 'img-a');
      return { w: n.width, h: n.height };
    });
    expect(dims.w).toBeLessThan(400); // it resized
    expect(dims.w / dims.h).toBeCloseTo(400 / 300, 2); // and kept aspect
  });
});
