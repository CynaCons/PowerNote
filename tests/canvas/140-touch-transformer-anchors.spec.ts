/**
 * Test 140: Finger-sized transform handles on coarse pointers
 * Covers: REQ-TOOL-010
 *
 * SelectionTransformer.tsx checks `window.matchMedia('(pointer: coarse)')`
 * once (module load) and grows the Konva Transformer's anchorSize when the
 * device has a coarse pointer, so resize handles are hittable with a
 * finger. Desktop (fine pointer) rendering must stay exactly as it was —
 * anchorSize 8 for a single resizable selection — since other specs
 * (tests/shapes/63-shape-resize.spec.ts) depend on the transformer's
 * current desktop look.
 */
import { test, expect } from '@playwright/test';
import { waitForCanvasReady } from '../helpers';

async function addAndSelectShape(page: import('@playwright/test').Page) {
  await page.evaluate(() => {
    const stores = (window as any).__POWERNOTE_STORES__;
    stores.canvas.getState().addNode({
      id: 'transformer-anchor-shape',
      type: 'shape',
      x: 200,
      y: 200,
      width: 150,
      height: 100,
      layer: 3,
      data: {
        shapeType: 'rect',
        fill: '#dbeafe',
        stroke: '#2563eb',
        strokeWidth: 2,
        strokeDash: [],
      },
    });
    stores.canvas.getState().selectNode('transformer-anchor-shape', false);
  });
}

async function readTransformerAnchorSize(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const Konva = (window as any).Konva;
    const stage = Konva?.stages?.[0];
    if (!stage) return null;
    const transformer = stage.findOne('Transformer');
    if (!transformer) return null;
    return transformer.anchorSize();
  });
}

test.describe('140 - Touch transformer anchors (REQ-TOOL-010)', () => {
  // Tablet/phone emulation: coarse pointer + touch, matching the
  // `(pointer: coarse)` media query SelectionTransformer checks. A full
  // devices[] profile can't be used inside a describe (carries
  // defaultBrowserType), so the relevant fields are set directly — same
  // pattern as tests/canvas/137-mobile-shell.spec.ts.
  test.use({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });

  test('resize handles grow to a finger-sized target on a coarse pointer', async ({ page }) => {
    await page.goto('/');
    await waitForCanvasReady(page);
    await addAndSelectShape(page);
    await page.waitForTimeout(200);

    const anchorSize = await readTransformerAnchorSize(page);
    expect(anchorSize).not.toBeNull();
    expect(anchorSize).toBeGreaterThanOrEqual(24);
  });
});

test.describe('140 - Desktop transformer anchors unchanged', () => {
  test('resize handles stay at the mouse-sized default on a fine pointer', async ({ page }) => {
    await page.goto('/');
    await waitForCanvasReady(page);
    await addAndSelectShape(page);
    await page.waitForTimeout(200);

    const anchorSize = await readTransformerAnchorSize(page);
    expect(anchorSize).toBe(8);
  });
});
