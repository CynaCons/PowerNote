/**
 * Test 99: Floating zoom bar
 * Covers: REQ-CANVAS-018..024 — zoom readout, step buttons, clamping,
 *         presets menu, zoom-to-fit / actual-size entries and shortcuts.
 */
import { test, expect } from '@playwright/test';
import { getCanvasStore, waitForCanvasReady } from '../helpers';

const setScale = (page: import('@playwright/test').Page, scale: number) =>
  page.evaluate((s) => {
    (window as any).__POWERNOTE_STORES__.canvas.getState().setZoom(s);
  }, scale);

test.describe('99 - Zoom bar (REQ-CANVAS-018..024)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForCanvasReady(page);
  });

  test('zoom bar is visible and reads 100% on a fresh canvas', async ({ page }) => {
    await expect(page.locator('[data-testid="zoom-bar"]')).toBeVisible();
    await expect(page.locator('[data-testid="zoom-percent"]')).toHaveText('100%');
  });

  test('readout tracks viewport scale set elsewhere', async ({ page }) => {
    await setScale(page, 2.5);
    await expect(page.locator('[data-testid="zoom-percent"]')).toHaveText('250%');

    await setScale(page, 0.4);
    await expect(page.locator('[data-testid="zoom-percent"]')).toHaveText('40%');
  });

  test('+ and - step the zoom by 1.25x', async ({ page }) => {
    await page.locator('[data-testid="zoom-in-btn"]').click();
    await expect(page.locator('[data-testid="zoom-percent"]')).toHaveText('125%');
    expect((await getCanvasStore(page)).viewport.scale).toBeCloseTo(1.25, 5);

    await page.locator('[data-testid="zoom-out-btn"]').click();
    await expect(page.locator('[data-testid="zoom-percent"]')).toHaveText('100%');
    expect((await getCanvasStore(page)).viewport.scale).toBeCloseTo(1, 5);
  });

  test('zoom stays centred on the canvas when stepping', async ({ page }) => {
    await page.evaluate(() => {
      (window as any).__POWERNOTE_STORES__.canvas.getState().setViewport({ x: 0, y: 0, scale: 1 });
    });

    const container = await page.evaluate(() => {
      const el = document.querySelector('.canvas-area__content') as HTMLElement;
      return { w: el.clientWidth, h: el.clientHeight };
    });

    await page.locator('[data-testid="zoom-in-btn"]').click();
    const { viewport } = await getCanvasStore(page);

    // Centre anchoring: x' = cx - (cx - x) * k, with x = 0 and k = 1.25
    expect(viewport.x).toBeCloseTo((container.w / 2) * (1 - 1.25), 1);
    expect(viewport.y).toBeCloseTo((container.h / 2) * (1 - 1.25), 1);
  });

  test('zoom clamps at 500% and the + button disables', async ({ page }) => {
    await setScale(page, 4.5);
    await page.locator('[data-testid="zoom-in-btn"]').click();

    await expect(page.locator('[data-testid="zoom-percent"]')).toHaveText('500%');
    await expect(page.locator('[data-testid="zoom-in-btn"]')).toBeDisabled();
    expect((await getCanvasStore(page)).viewport.scale).toBe(5);
  });

  test('zoom clamps at 10% and the - button disables', async ({ page }) => {
    await setScale(page, 0.11);
    await page.locator('[data-testid="zoom-out-btn"]').click();

    await expect(page.locator('[data-testid="zoom-percent"]')).toHaveText('10%');
    await expect(page.locator('[data-testid="zoom-out-btn"]')).toBeDisabled();
    expect((await getCanvasStore(page)).viewport.scale).toBeCloseTo(0.1, 5);
  });

  test('menu opens, applies a preset, and closes', async ({ page }) => {
    await expect(page.locator('[data-testid="zoom-menu"]')).toHaveCount(0);

    await page.locator('[data-testid="zoom-value-btn"]').click();
    await expect(page.locator('[data-testid="zoom-menu"]')).toBeVisible();

    await page.locator('[data-testid="zoom-preset-200"]').click();
    await expect(page.locator('[data-testid="zoom-menu"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="zoom-percent"]')).toHaveText('200%');
    expect((await getCanvasStore(page)).viewport.scale).toBe(2);
  });

  test('menu closes on outside click without changing zoom', async ({ page }) => {
    await setScale(page, 1.5);
    await page.locator('[data-testid="zoom-value-btn"]').click();
    await expect(page.locator('[data-testid="zoom-menu"]')).toBeVisible();

    await page.locator('[data-testid="topbar-page"]').click();
    await expect(page.locator('[data-testid="zoom-menu"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="zoom-percent"]')).toHaveText('150%');
  });

  test('actual size resets to 100% from the menu', async ({ page }) => {
    await setScale(page, 3);
    await page.locator('[data-testid="zoom-value-btn"]').click();
    await page.locator('[data-testid="zoom-menu-actual"]').click();

    await expect(page.locator('[data-testid="zoom-percent"]')).toHaveText('100%');
    expect((await getCanvasStore(page)).viewport.scale).toBe(1);
  });

  test('zoom to fit from the menu reframes the content', async ({ page }) => {
    await page.evaluate(() => {
      const store = (window as any).__POWERNOTE_STORES__.canvas.getState();
      store.addNode({
        id: 'zb-node-1', type: 'text', x: 0, y: 0, width: 100, height: 30,
        data: { text: 'A', fontSize: 16, fontFamily: 'Inter', fontStyle: 'normal', fill: '#1a1a1a' },
      });
      store.addNode({
        id: 'zb-node-2', type: 'text', x: 4000, y: 3000, width: 100, height: 30,
        data: { text: 'B', fontSize: 16, fontFamily: 'Inter', fontStyle: 'normal', fill: '#1a1a1a' },
      });
    });
    await page.waitForTimeout(200);

    await page.locator('[data-testid="zoom-value-btn"]').click();
    await page.locator('[data-testid="zoom-menu-fit"]').click();
    await page.waitForTimeout(200);

    // Both nodes are far apart, so fitting must zoom well out
    const { viewport } = await getCanvasStore(page);
    expect(viewport.scale).toBeLessThan(1);
    await expect(page.locator('[data-testid="zoom-percent"]')).toHaveText(
      `${Math.round(viewport.scale * 100)}%`,
    );
  });

  test('Shift+0 resets to 100% and Shift+1 fits', async ({ page }) => {
    await page.evaluate(() => {
      (window as any).__POWERNOTE_STORES__.canvas.getState().addNode({
        id: 'zb-kbd', type: 'text', x: 200, y: 200, width: 300, height: 60,
        data: { text: 'fit me', fontSize: 16, fontFamily: 'Inter', fontStyle: 'normal', fill: '#1a1a1a' },
      });
    });
    await setScale(page, 3);

    await page.keyboard.press('Shift+Digit0');
    await expect(page.locator('[data-testid="zoom-percent"]')).toHaveText('100%');

    await page.keyboard.press('Shift+Digit1');
    await page.waitForTimeout(200);
    await expect(page.locator('[data-testid="zoom-percent"]')).not.toHaveText('100%');
  });

  test('zoom shortcuts do not fire while editing text', async ({ page }) => {
    await page.evaluate(() => {
      (window as any).__POWERNOTE_STORES__.canvas.getState().addNode({
        id: 'zb-edit', type: 'text', x: 200, y: 200, width: 300, height: 60,
        data: { text: 'hello', fontSize: 16, fontFamily: 'Inter', fontStyle: 'normal', fill: '#1a1a1a' },
      });
    });
    await setScale(page, 2);
    await page.waitForTimeout(200);

    // Type into a focused textarea — the shortcut must be ignored
    await page.evaluate(() => {
      const ta = document.createElement('textarea');
      ta.id = 'zb-probe';
      document.body.appendChild(ta);
      ta.focus();
    });
    await page.keyboard.press('Shift+Digit0');
    await page.waitForTimeout(100);

    await expect(page.locator('[data-testid="zoom-percent"]')).toHaveText('200%');
    expect((await getCanvasStore(page)).viewport.scale).toBe(2);
  });
});
