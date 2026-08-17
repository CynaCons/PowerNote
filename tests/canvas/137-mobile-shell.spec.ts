/**
 * Test 137: Mobile shell — the browser never fights the canvas
 *
 * Covers: REQ-DRAW-010 (touch-action: none keeps every gesture on the
 * canvas), REQ-DRAW-012 (the touch-draw mode is offered in Settings and
 * survives a reload as a device setting), plus the viewport pinning and
 * finger-sized targets the SRS_DRAW v0.42 requirements assume.
 */
import { test, expect } from '@playwright/test';
import { waitForCanvasReady, disableFSA } from '../helpers';

test.describe('137 - Mobile shell', () => {
  test.beforeEach(async ({ page }) => {
    await disableFSA(page);
    await page.goto('/');
    await waitForCanvasReady(page);
  });

  test('viewport meta pins browser zoom so a pinch reaches the canvas', async ({ page }) => {
    const content = await page
      .locator('meta[name="viewport"]')
      .getAttribute('content');
    expect(content).toContain('maximum-scale=1.0');
    expect(content).toContain('user-scalable=no');
  });

  test('the canvas claims every touch gesture (touch-action: none)', async ({ page }) => {
    const styles = await page.evaluate(() => {
      const canvas = document.querySelector(
        '[data-testid="canvas-container"]',
      ) as HTMLElement;
      return {
        touchAction: getComputedStyle(canvas).touchAction,
        overscroll: getComputedStyle(document.body).overscrollBehaviorY,
      };
    });
    expect(styles.touchAction).toBe('none');
    expect(styles.overscroll).toBe('none');
  });

  test('the touch-draw mode is offered in Settings and persists on this device', async ({ page }) => {
    await page.locator('[data-testid="nav-settings"]').click();
    await expect(page.locator('[data-testid="settings-touchdraw-auto"]')).toBeChecked();

    await page.locator('[data-testid="settings-touchdraw-never"]').check();
    const mode = await page.evaluate(
      () => (window as any).__POWERNOTE_STORES__.tool.getState().drawOptions.touchDraw,
    );
    expect(mode).toBe('never');

    // Device setting: it comes back after a reload, without a notebook save.
    await page.reload();
    await waitForCanvasReady(page);
    const reloaded = await page.evaluate(
      () => (window as any).__POWERNOTE_STORES__.tool.getState().drawOptions.touchDraw,
    );
    expect(reloaded).toBe('never');
  });
});

test.describe('137 - Mobile shell on a touch device', () => {
  // Tablet emulation: coarse pointer, touch enabled — the media query that
  // grows the tool targets keys off (pointer: coarse). (A full devices[]
  // profile can't be used inside a describe — it carries
  // defaultBrowserType — so the relevant fields are set directly.)
  test.use({
    viewport: { width: 712, height: 1138 },
    hasTouch: true,
    isMobile: true,
  });

  test('tool targets grow to finger size on coarse pointers', async ({ page }) => {
    await disableFSA(page);
    await page.goto('/');
    await waitForCanvasReady(page);

    const box = await page.locator('[data-testid="nav-draw-tool"]').boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThanOrEqual(44);
    expect(box!.height).toBeGreaterThanOrEqual(44);
  });
});
