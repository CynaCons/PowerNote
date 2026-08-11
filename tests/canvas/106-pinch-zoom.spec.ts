/**
 * Test 106: Pinch-to-zoom (touch)
 * Covers: REQ-CANVAS-025, REQ-CANVAS-026
 *
 * Pinch zoom shipped as live code with no coverage and no requirement — found
 * during the v0.11.x audit. Written retroactively.
 *
 * Real multi-touch is dispatched through CDP `Input.dispatchTouchEvent` rather
 * than synthesised TouchEvents: Konva reads pointer positions off the native
 * event, so a hand-built event can pass while the real input path is broken.
 *
 * Coverage boundary: TWO-FINGER PAN IS NOT TESTED BECAUSE IT DOES NOT EXIST.
 * `handleTouchMove` tracks `lastPinchCenter` but never translates by it, so
 * moving both fingers together leaves `dist` unchanged, `scaleFactor` at 1, and
 * the viewport where it was. It remains an open task on v0.11.4; a test here
 * would only pin the gap in place.
 */
import { test, expect } from '@playwright/test';
import { getCanvasStore, waitForCanvasReady } from '../helpers';

test.use({ hasTouch: true });

type PW = import('@playwright/test').Page;

async function touchSession(page: PW) {
  const client = await page.context().newCDPSession(page);
  return {
    start: (points: { x: number; y: number }[]) =>
      client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: points }),
    move: (points: { x: number; y: number }[]) =>
      client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: points }),
    end: () => client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }),
  };
}

const scaleOf = async (page: PW) => (await getCanvasStore(page)).viewport.scale;

test.describe('106 - Pinch-to-zoom (REQ-CANVAS-025, REQ-CANVAS-026)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForCanvasReady(page);
  });

  test('spreading two fingers zooms in', async ({ page }) => {
    const before = await scaleOf(page);
    const touch = await touchSession(page);

    await touch.start([
      { x: 500, y: 350 },
      { x: 600, y: 350 },
    ]);
    // Widen the gap in steps — the handler tracks distance frame to frame.
    for (const gap of [140, 200, 280, 360]) {
      await touch.move([
        { x: 550 - gap / 2, y: 350 },
        { x: 550 + gap / 2, y: 350 },
      ]);
    }
    await touch.end();

    await expect.poll(() => scaleOf(page)).toBeGreaterThan(before);
  });

  test('bringing two fingers together zooms out', async ({ page }) => {
    const touch = await touchSession(page);

    await touch.start([
      { x: 350, y: 350 },
      { x: 750, y: 350 },
    ]);
    await touch.move([
      { x: 380, y: 350 },
      { x: 720, y: 350 },
    ]);
    const mid = await scaleOf(page);

    for (const gap of [240, 160, 90]) {
      await touch.move([
        { x: 550 - gap / 2, y: 350 },
        { x: 550 + gap / 2, y: 350 },
      ]);
    }
    await touch.end();

    await expect.poll(() => scaleOf(page)).toBeLessThan(mid);
  });

  test('zoom stays inside the documented scale bounds', async ({ page }) => {
    const touch = await touchSession(page);

    await touch.start([
      { x: 540, y: 350 },
      { x: 560, y: 350 },
    ]);
    // Aggressive spread — far beyond what 5.0x allows.
    for (const gap of [100, 300, 600, 900, 1200]) {
      await touch.move([
        { x: Math.max(2, 550 - gap / 2), y: 350 },
        { x: 550 + gap / 2, y: 350 },
      ]);
    }
    await touch.end();

    const scale = await scaleOf(page);
    expect(scale).toBeLessThanOrEqual(5.0);
    expect(scale).toBeGreaterThanOrEqual(0.1);
  });
});
