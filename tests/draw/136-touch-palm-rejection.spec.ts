/**
 * Test 136: Touch drawing modes, palm rejection, pinch handover
 *
 * Covers: REQ-DRAW-012 (touch-draw mode auto/always/never decides whether a
 * finger draws or pans), REQ-DRAW-013 (touch is ignored while the pen
 * writes; a second finger cancels a touch stroke and hands over to pinch),
 * REQ-CANVAS-027 (two fingers moving together pan the canvas).
 */
import { test, expect } from '@playwright/test';
import { waitForCanvasReady, disableFSA } from '../helpers';

type Pt = { x: number; y: number };

/** Dispatch one pointer event on the canvas, coords relative to it. */
async function pointerEvent(
  page: import('@playwright/test').Page,
  type: string,
  pos: Pt,
  o: { pointerType?: string; pointerId?: number; pressure?: number; buttons?: number } = {},
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
          pointerId: o.pointerId ?? 200,
          pointerType: o.pointerType ?? 'touch',
          isPrimary: (o.pointerId ?? 200) === 200,
          clientX: rect.left + pos.x,
          clientY: rect.top + pos.y,
          pressure: o.pressure ?? 0.5,
          buttons: o.buttons ?? 1,
        }),
      );
    },
    { type, pos, o },
  );
}

/**
 * Dispatch a TouchEvent with the given touch points (for pinch/two-finger).
 * For touchend, `points` is the fingers still down (usually none) and
 * `lifted` the fingers that just left — real browsers put the lifted
 * fingers in changedTouches, and Konva reads exactly that.
 */
async function touchEvent(
  page: import('@playwright/test').Page,
  type: 'touchstart' | 'touchmove' | 'touchend',
  points: Pt[],
  lifted: Pt[] = [],
) {
  await page.evaluate(
    ({ type, points, lifted }) => {
      const canvas = document.querySelector(
        '[data-testid="canvas-container"] canvas',
      ) as HTMLCanvasElement;
      const rect = canvas.getBoundingClientRect();
      const mk = (p: { x: number; y: number }, i: number) =>
        new Touch({
          identifier: i + 1,
          target: canvas,
          clientX: rect.left + p.x,
          clientY: rect.top + p.y,
        });
      const touches = points.map(mk);
      const changed = (lifted.length > 0 ? lifted : points).map(mk);
      canvas.dispatchEvent(
        new TouchEvent(type, {
          bubbles: true,
          cancelable: true,
          composed: true,
          touches,
          targetTouches: touches,
          changedTouches: changed,
        }),
      );
    },
    { type, points, lifted },
  );
}

async function strokeCount(page: import('@playwright/test').Page) {
  return page.evaluate(
    () => (window as any).__POWERNOTE_STORES__.draw.getState().strokes.length,
  );
}

async function viewport(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const Konva = (window as any).Konva;
    const stage = Konva.stages[0];
    return { x: stage.x(), y: stage.y(), scale: stage.scaleX() };
  });
}

test.describe('136 - Touch modes & palm rejection (REQ-DRAW-012/013, REQ-CANVAS-027)', () => {
  test.beforeEach(async ({ page }) => {
    await disableFSA(page);
    await page.goto('/');
    await waitForCanvasReady(page);
    await page.evaluate(() => {
      (window as any).__POWERNOTE_STORES__.tool.getState().setTool('draw');
    });
  });

  test('auto mode: a finger draws while no pen has been seen', async ({ page }) => {
    await pointerEvent(page, 'pointerdown', { x: 300, y: 300 });
    for (let i = 1; i <= 8; i++) {
      await pointerEvent(page, 'pointermove', { x: 300 + i * 12, y: 300 });
    }
    await pointerEvent(page, 'pointerup', { x: 396, y: 300 }, { buttons: 0 });

    expect(await strokeCount(page)).toBe(1);
  });

  test('auto mode: after the pen is seen, a finger pans instead of drawing', async ({ page }) => {
    // The pen announces itself…
    await page.evaluate(() => {
      (window as any).__POWERNOTE_STORES__.tool.getState().setPenDetected(true);
    });

    const before = await viewport(page);
    await pointerEvent(page, 'pointerdown', { x: 400, y: 300 });
    for (let i = 1; i <= 6; i++) {
      await pointerEvent(page, 'pointermove', { x: 400 - i * 15, y: 300 - i * 5 });
    }
    await pointerEvent(page, 'pointerup', { x: 310, y: 270 }, { buttons: 0 });

    const after = await viewport(page);
    expect(await strokeCount(page)).toBe(0);
    expect(after.x - before.x).toBeLessThan(-60);
    expect(after.y - before.y).toBeLessThan(-20);
    expect(after.scale).toBeCloseTo(before.scale, 5);
  });

  test('never mode: a finger pans even before any pen contact', async ({ page }) => {
    await page.evaluate(() => {
      (window as any).__POWERNOTE_STORES__.tool
        .getState()
        .setDrawOptions({ touchDraw: 'never' });
    });

    const before = await viewport(page);
    await pointerEvent(page, 'pointerdown', { x: 400, y: 300 });
    for (let i = 1; i <= 5; i++) {
      await pointerEvent(page, 'pointermove', { x: 400 + i * 20, y: 300 });
    }
    await pointerEvent(page, 'pointerup', { x: 500, y: 300 }, { buttons: 0 });

    expect(await strokeCount(page)).toBe(0);
    expect((await viewport(page)).x - before.x).toBeGreaterThan(60);
  });

  test('always mode: a finger draws even after the pen was seen', async ({ page }) => {
    await page.evaluate(() => {
      const tool = (window as any).__POWERNOTE_STORES__.tool.getState();
      tool.setDrawOptions({ touchDraw: 'always' });
      tool.setPenDetected(true);
    });

    await pointerEvent(page, 'pointerdown', { x: 300, y: 350 });
    for (let i = 1; i <= 6; i++) {
      await pointerEvent(page, 'pointermove', { x: 300 + i * 15, y: 350 });
    }
    await pointerEvent(page, 'pointerup', { x: 390, y: 350 }, { buttons: 0 });

    expect(await strokeCount(page)).toBe(1);
  });

  test('palm rejection: touch is ignored while the pen is down (REQ-DRAW-013)', async ({ page }) => {
    const before = await viewport(page);

    // Pen starts writing…
    await pointerEvent(page, 'pointerdown', { x: 300, y: 300 }, { pointerType: 'pen', pointerId: 300 });
    await pointerEvent(page, 'pointermove', { x: 330, y: 300 }, { pointerType: 'pen', pointerId: 300 });

    // …the palm lands and slides mid-stroke…
    await pointerEvent(page, 'pointerdown', { x: 500, y: 450 }, { pointerId: 400 });
    await pointerEvent(page, 'pointermove', { x: 460, y: 420 }, { pointerId: 400 });
    await pointerEvent(page, 'pointermove', { x: 420, y: 400 }, { pointerId: 400 });

    // …the pen finishes its line.
    await pointerEvent(page, 'pointermove', { x: 380, y: 300 }, { pointerType: 'pen', pointerId: 300 });
    await pointerEvent(page, 'pointerup', { x: 380, y: 300 }, { pointerType: 'pen', pointerId: 300, buttons: 0 });
    await pointerEvent(page, 'pointerup', { x: 420, y: 400 }, { pointerId: 400, buttons: 0 });

    // One stroke committed, and the palm neither drew nor panned.
    expect(await strokeCount(page)).toBe(1);
    const after = await viewport(page);
    expect(after.x).toBeCloseTo(before.x, 5);
    expect(after.y).toBeCloseTo(before.y, 5);
  });

  test('a second finger cancels the touch stroke (REQ-DRAW-013)', async ({ page }) => {
    // Finger 1 starts drawing (auto mode, no pen seen)
    await pointerEvent(page, 'pointerdown', { x: 300, y: 300 }, { pointerId: 201 });
    for (let i = 1; i <= 4; i++) {
      await pointerEvent(page, 'pointermove', { x: 300 + i * 10, y: 300 }, { pointerId: 201 });
    }
    // Finger 2 lands — the half-stroke belongs to a pinch, not the page
    await pointerEvent(page, 'pointerdown', { x: 500, y: 300 }, { pointerId: 202 });
    await pointerEvent(page, 'pointerup', { x: 340, y: 300 }, { pointerId: 201, buttons: 0 });
    await pointerEvent(page, 'pointerup', { x: 500, y: 300 }, { pointerId: 202, buttons: 0 });

    expect(await strokeCount(page)).toBe(0);
  });

  test('pinch zooms and two fingers moving together pan (REQ-CANVAS-027)', async ({ page }) => {
    const before = await viewport(page);

    // Spread: 200px -> 300px around a fixed centre = zoom in
    await touchEvent(page, 'touchstart', [{ x: 300, y: 300 }, { x: 500, y: 300 }]);
    await touchEvent(page, 'touchmove', [{ x: 300, y: 300 }, { x: 500, y: 300 }]);
    await touchEvent(page, 'touchmove', [{ x: 275, y: 300 }, { x: 525, y: 300 }]);
    await touchEvent(page, 'touchmove', [{ x: 250, y: 300 }, { x: 550, y: 300 }]);
    await touchEvent(page, 'touchend', [], [{ x: 250, y: 300 }, { x: 550, y: 300 }]);

    const zoomed = await viewport(page);
    expect(zoomed.scale).toBeGreaterThan(before.scale * 1.2);

    // Two fingers translating in lockstep: pan, no zoom
    await touchEvent(page, 'touchstart', [{ x: 300, y: 300 }, { x: 500, y: 300 }]);
    await touchEvent(page, 'touchmove', [{ x: 300, y: 300 }, { x: 500, y: 300 }]);
    await touchEvent(page, 'touchmove', [{ x: 340, y: 330 }, { x: 540, y: 330 }]);
    await touchEvent(page, 'touchmove', [{ x: 380, y: 360 }, { x: 580, y: 360 }]);
    await touchEvent(page, 'touchend', [], [{ x: 380, y: 360 }, { x: 580, y: 360 }]);

    const panned = await viewport(page);
    expect(panned.scale).toBeCloseTo(zoomed.scale, 2);
    expect(panned.x - zoomed.x).toBeGreaterThan(50);
    expect(panned.y - zoomed.y).toBeGreaterThan(30);
  });
});
