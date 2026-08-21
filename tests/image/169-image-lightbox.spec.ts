// Covers: REQ-IMAGE-019, REQ-IMAGE-020
/**
 * Test 169: Image lightbox overlay
 * Mini click / full-size dblclick open a dimmed overlay; Escape, backdrop,
 * and X close it without touching selection or viewport. Crop is honoured.
 */
import { test, expect } from '@playwright/test';
import { waitForCanvasReady, getCanvasStore } from '../helpers';

const RED_PIXEL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';

const MINI_ID = 'test-img-lightbox-mini';
const CROP_ID = 'test-img-lightbox-crop';
const CROP_NAT_W = 100;
const CROP_NAT_H = 80;

async function addMiniImage(page: import('@playwright/test').Page, id = MINI_ID) {
  await page.evaluate(
    ({ src, id }) => {
      const stores = (window as any).__POWERNOTE_STORES__;
      stores.canvas.getState().addNode({
        id,
        type: 'image',
        x: 200,
        y: 200,
        width: 80,
        height: 80,
        data: {
          src,
          alt: 'lightbox-mini',
          naturalWidth: 1,
          naturalHeight: 1,
          mini: true,
        },
      });
    },
    { src: RED_PIXEL, id },
  );
}

async function openLightbox(page: import('@playwright/test').Page, id: string) {
  await page.evaluate((id) => {
    const stores = (window as any).__POWERNOTE_STORES__;
    stores.canvas.getState().openLightbox(id);
  }, id);
}

async function waitForLightboxImg(page: import('@playwright/test').Page) {
  const img = page.locator('[data-testid="image-lightbox-img"]');
  await expect(img).toBeVisible();
  await expect(img).not.toHaveAttribute('src', '');
  await img.evaluate((el: HTMLImageElement) => {
    if (el.complete && el.naturalWidth > 0) return;
    return new Promise<void>((resolve, reject) => {
      el.onload = () => resolve();
      el.onerror = () => reject(new Error('lightbox img failed to load'));
    });
  });
  return img;
}

test.describe('169 - Image lightbox (REQ-IMAGE-019, REQ-IMAGE-020)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForCanvasReady(page);
  });

  test('openLightbox on a mini image shows the overlay with a loaded img', async ({ page }) => {
    await addMiniImage(page);

    const hasAction = await page.evaluate(() => {
      const stores = (window as any).__POWERNOTE_STORES__;
      return typeof stores.canvas.getState().openLightbox === 'function';
    });
    expect(hasAction).toBe(true);

    await openLightbox(page, MINI_ID);

    const overlay = page.locator('[data-testid="image-lightbox"]');
    await expect(overlay).toBeVisible();
    const img = await waitForLightboxImg(page);
    const src = await img.getAttribute('src');
    expect(src).toBeTruthy();
  });

  test('Escape closes; selection and viewport are unchanged', async ({ page }) => {
    await addMiniImage(page);
    await page.evaluate((id) => {
      const canvas = (window as any).__POWERNOTE_STORES__.canvas.getState();
      canvas.selectNode(id, false);
      canvas.setViewport({ x: 40, y: 60, scale: 1.25 });
    }, MINI_ID);

    const before = await getCanvasStore(page);
    expect(before.selectedNodeIds).toEqual([MINI_ID]);

    await openLightbox(page, MINI_ID);
    await expect(page.locator('[data-testid="image-lightbox"]')).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page.locator('[data-testid="image-lightbox"]')).toHaveCount(0);

    const after = await getCanvasStore(page);
    expect(after.selectedNodeIds).toEqual(before.selectedNodeIds);
    expect(after.viewport).toEqual(before.viewport);
  });

  test('backdrop click and X click both close the lightbox', async ({ page }) => {
    await addMiniImage(page);
    await openLightbox(page, MINI_ID);
    await expect(page.locator('[data-testid="image-lightbox"]')).toBeVisible();

    await page.locator('[data-testid="image-lightbox"]').click({ position: { x: 4, y: 4 } });
    await expect(page.locator('[data-testid="image-lightbox"]')).toHaveCount(0);

    await openLightbox(page, MINI_ID);
    await expect(page.locator('[data-testid="image-lightbox"]')).toBeVisible();
    await page.locator('[data-testid="image-lightbox-close"]').click();
    await expect(page.locator('[data-testid="image-lightbox"]')).toHaveCount(0);
  });

  test('cropped image: lightbox img natural dims are the cropped canvas size', async ({ page }) => {
    const src = await page.evaluate(
      ({ w, h }) => {
        const c = document.createElement('canvas');
        c.width = w;
        c.height = h;
        const ctx = c.getContext('2d')!;
        ctx.fillStyle = '#ff0000';
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#00ff00';
        ctx.fillRect(w / 4, h / 4, w / 2, h / 2);
        return c.toDataURL('image/png');
      },
      { w: CROP_NAT_W, h: CROP_NAT_H },
    );

    await page.evaluate(
      ({ src, id, w, h }) => {
        const stores = (window as any).__POWERNOTE_STORES__;
        stores.canvas.getState().addNode({
          id,
          type: 'image',
          x: 180,
          y: 180,
          width: w,
          height: h,
          data: {
            src,
            alt: 'cropped',
            naturalWidth: w,
            naturalHeight: h,
            crop: { x: 0.25, y: 0.25, width: 0.5, height: 0.5 },
          },
        });
      },
      { src, id: CROP_ID, w: CROP_NAT_W, h: CROP_NAT_H },
    );

    await openLightbox(page, CROP_ID);
    const img = await waitForLightboxImg(page);
    const dims = await img.evaluate((el: HTMLImageElement) => ({
      w: el.naturalWidth,
      h: el.naturalHeight,
    }));
    expect(dims.w).toBe(CROP_NAT_W * 0.5);
    expect(dims.h).toBe(CROP_NAT_H * 0.5);
  });

  test('Escape while lightbox is open does not clear canvas selection', async ({ page }) => {
    await addMiniImage(page);
    await page.evaluate((id) => {
      (window as any).__POWERNOTE_STORES__.canvas.getState().selectNode(id, false);
    }, MINI_ID);

    const before = await getCanvasStore(page);
    expect(before.selectedNodeIds).toContain(MINI_ID);

    await openLightbox(page, MINI_ID);
    await expect(page.locator('[data-testid="image-lightbox"]')).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page.locator('[data-testid="image-lightbox"]')).toHaveCount(0);

    const after = await getCanvasStore(page);
    expect(after.selectedNodeIds).toEqual(before.selectedNodeIds);
    expect(after.selectedNodeIds).toContain(MINI_ID);
  });
});
