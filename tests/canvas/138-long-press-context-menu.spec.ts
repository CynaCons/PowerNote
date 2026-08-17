/**
 * Test 138: Long-press selects + opens context menu (touch)
 *
 * Covers: REQ-CANVAS-028 — with the select tool active on a touch device, a
 * ~500ms still press on a node selects it and opens the existing
 * ContextMenu at the press position. Moving past a small threshold or
 * lifting early cancels it, and it never fires while draw/shape/lasso own
 * touch for drawing/panning.
 *
 * Chromium does not synthesize a native 'contextmenu' from a touch hold
 * here (verified via a throwaway CDP touch probe before implementing —
 * touch-action: none on the canvas container suppresses it), so the app
 * drives its own timer in useContextMenu.ts. That timer keys off
 * PointerEvents (pointerType 'touch'), so this dispatches those rather than
 * raw TouchEvents — each in its own page.evaluate call so React re-renders
 * between them, per tests/draw/135-pen-pressure-drawing.spec.ts.
 */
import { test, expect } from '@playwright/test';
import { waitForCanvasReady, disableFSA } from '../helpers';

type Pt = { x: number; y: number };

async function pointerEvent(
  page: import('@playwright/test').Page,
  type: string,
  pos: Pt,
  o: { pointerId?: number; buttons?: number } = {},
) {
  await page.evaluate(
    ({ type, pos, o }) => {
      const canvas = document.querySelector(
        '[data-testid="canvas-container"] canvas',
      ) as HTMLCanvasElement;
      const rect = canvas.getBoundingClientRect();
      canvas.dispatchEvent(
        new PointerEvent(type, {
          bubbles: true,
          cancelable: true,
          composed: true,
          pointerId: o.pointerId ?? 500,
          pointerType: 'touch',
          isPrimary: true,
          clientX: rect.left + pos.x,
          clientY: rect.top + pos.y,
          buttons: o.buttons ?? 1,
        }),
      );
    },
    { type, pos, o },
  );
}

const NODE_ID = 'longpress-node';
const NODE_CENTER: Pt = { x: 260, y: 215 };

test.describe('138 - Long-press context menu (REQ-CANVAS-028)', () => {
  test.use({ viewport: { width: 900, height: 700 }, hasTouch: true, isMobile: true });

  test.beforeEach(async ({ page }) => {
    await disableFSA(page);
    await page.goto('/');
    await waitForCanvasReady(page);
    // Default viewport is x:0, y:0, scale:1 (useCanvasStore), so screen
    // coords line up 1:1 with canvas coords.
    await page.evaluate((id) => {
      const stores = (window as any).__POWERNOTE_STORES__;
      stores.canvas.getState().addNode({
        id,
        type: 'text',
        x: 200,
        y: 200,
        width: 120,
        height: 30,
        layer: 3,
        data: { text: 'Press me', fontSize: 16, fontFamily: 'Inter', fontStyle: 'normal', fill: '#1a1a1a' },
      });
      stores.tool.getState().setTool('select');
    }, NODE_ID);
    await page.waitForTimeout(100);
  });

  test('a still ~500ms press selects the node and opens the context menu at the press point', async ({ page }) => {
    await expect(page.locator('[data-testid="context-menu"]')).not.toBeVisible();

    await pointerEvent(page, 'pointerdown', NODE_CENTER);
    await page.waitForTimeout(600);

    const menu = page.locator('[data-testid="context-menu"]');
    await expect(menu).toBeVisible();

    const selected = await page.evaluate(
      () => (window as any).__POWERNOTE_STORES__.canvas.getState().selectedNodeIds,
    );
    expect(selected).toEqual([NODE_ID]);

    // Positioned at the press point (relative to the canvas container), not
    // some default corner.
    const box = await menu.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThan(NODE_CENTER.x - 60);
    expect(box!.x).toBeLessThan(NODE_CENTER.x + 60);
    expect(box!.y).toBeGreaterThan(NODE_CENTER.y - 60);
    expect(box!.y).toBeLessThan(NODE_CENTER.y + 60);

    await pointerEvent(page, 'pointerup', NODE_CENTER);
  });

  test('lifting before ~500ms cancels the press — no menu, no selection', async ({ page }) => {
    await pointerEvent(page, 'pointerdown', NODE_CENTER);
    await page.waitForTimeout(200);
    await pointerEvent(page, 'pointerup', NODE_CENTER);
    await page.waitForTimeout(500);

    await expect(page.locator('[data-testid="context-menu"]')).not.toBeVisible();
    const selected = await page.evaluate(
      () => (window as any).__POWERNOTE_STORES__.canvas.getState().selectedNodeIds,
    );
    expect(selected).toEqual([]);
  });

  test('moving past the threshold cancels the press — no menu opens', async ({ page }) => {
    await pointerEvent(page, 'pointerdown', NODE_CENTER);
    await page.waitForTimeout(100);
    // 30px is well past the ~10px cancel threshold
    await pointerEvent(page, 'pointermove', { x: NODE_CENTER.x + 30, y: NODE_CENTER.y });
    await page.waitForTimeout(500);
    await pointerEvent(page, 'pointerup', { x: NODE_CENTER.x + 30, y: NODE_CENTER.y });

    await expect(page.locator('[data-testid="context-menu"]')).not.toBeVisible();
  });

  test('does not fire while the draw tool is active', async ({ page }) => {
    await page.evaluate(() => {
      (window as any).__POWERNOTE_STORES__.tool.getState().setTool('draw');
    });

    await pointerEvent(page, 'pointerdown', NODE_CENTER);
    await page.waitForTimeout(600);
    await pointerEvent(page, 'pointerup', NODE_CENTER);

    await expect(page.locator('[data-testid="context-menu"]')).not.toBeVisible();
  });

  test('a long press on empty canvas does nothing (documented no-op, mirrors right-click background)', async ({ page }) => {
    await pointerEvent(page, 'pointerdown', { x: 600, y: 500 });
    await page.waitForTimeout(600);
    await pointerEvent(page, 'pointerup', { x: 600, y: 500 });

    await expect(page.locator('[data-testid="context-menu"]')).not.toBeVisible();
    const selected = await page.evaluate(
      () => (window as any).__POWERNOTE_STORES__.canvas.getState().selectedNodeIds,
    );
    expect(selected).toEqual([]);
  });
});
