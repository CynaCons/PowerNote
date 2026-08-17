/**
 * Test 142: ZoomBar and the bottom toolbar never overlap
 * Covers: REQ-TOOL-011
 *
 * Both .zoom-bar (ZoomBar.css) and .bottom-toolbar (BottomToolbar.css) are
 * position:absolute, bottom:16px, same z-index, inside .canvas-area__content.
 * On a phone-width viewport the toolbar's centered box grew wide enough for
 * its right edge to slide under the ZoomBar's bottom-right corner — and
 * being later in DOM order, the ZoomBar won every tap that landed there
 * (see tests/toolbar/141-toolbar-narrow-screen.spec.ts, which used to work
 * around exactly this with a DOM-level .click() and the size-trigger).
 *
 * The fix (ZoomBar.css, narrow-viewport media query) stacks the ZoomBar
 * above the toolbar instead of reserving horizontal space for it — reserving
 * space would have cost the toolbar as much room on the left as it saved on
 * the right (its box is centered), and a 390px phone doesn't have room to
 * spare. Stacking costs nothing from the toolbar's width and leaves its
 * layout exactly as it was.
 */
import { test, expect } from '@playwright/test';
import { waitForCanvasReady } from '../helpers';

async function addAndSelectTextNode(page: import('@playwright/test').Page) {
  await page.evaluate(() => {
    const store = (window as any).__POWERNOTE_STORES__.canvas.getState();
    store.addNode({
      id: 'no-overlap-text',
      type: 'text',
      x: 200,
      y: 200,
      width: 120,
      height: 30,
      data: { text: 'Hello', fontSize: 16, fontFamily: 'Inter', fontStyle: 'normal', fill: '#1a1a1a' },
    });
    store.selectNode('no-overlap-text', false);
  });
}

test.describe('142a - No overlap on a phone-width viewport (REQ-TOOL-011)', () => {
  // Touch emulation set directly, not via devices[] (carries defaultBrowserType,
  // which can't be combined with test.use() inside a describe) — same pattern
  // as 141b, tests/canvas/137-mobile-shell.spec.ts and 140.
  test.use({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });

  test('the ZoomBar and toolbar bounding boxes never intersect', async ({ page }) => {
    await page.goto('/');
    await waitForCanvasReady(page);
    await addAndSelectTextNode(page);

    const zoomBar = page.locator('[data-testid="zoom-bar"]');
    const toolbar = page.locator('[data-testid="bottom-toolbar"]');
    await expect(zoomBar).toBeVisible();
    await expect(toolbar).toBeVisible();

    const zb = (await zoomBar.boundingBox())!;
    const tb = (await toolbar.boundingBox())!;
    expect(zb).not.toBeNull();
    expect(tb).not.toBeNull();

    const intersects = !(
      tb.x + tb.width <= zb.x ||
      tb.x >= zb.x + zb.width ||
      tb.y + tb.height <= zb.y ||
      tb.y >= zb.y + zb.height
    );
    expect(intersects).toBe(false);
  });

  test('a real coordinate click on the toolbar\'s last visible button reaches it, not the ZoomBar', async ({ page }) => {
    await page.goto('/');
    await waitForCanvasReady(page);
    await addAndSelectTextNode(page);

    // The trailing control of the text toolbar (TextToolbar.tsx) — the same
    // button 141a exercises on desktop and 141b used to have to avoid here.
    // A real Playwright click (auto-scrolling + hit-testing, unlike a DOM
    // .click()) proves the coordinates resolve to this button and not the
    // ZoomBar sitting at the same former screen position.
    const colorTrigger = page.locator('[data-testid="color-trigger"]');
    await colorTrigger.click();

    await expect(page.locator('[data-testid="color-popover"]')).toBeVisible();
  });
});

test.describe('142b - ZoomBar position is unchanged on a desktop viewport', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForCanvasReady(page);
  });

  test('bottom/right stay at 16px and the box sits exactly where it does today', async ({ page }) => {
    const zoomBar = page.locator('[data-testid="zoom-bar"]');
    await expect(zoomBar).toBeVisible();

    const style = await zoomBar.evaluate((el) => {
      const cs = getComputedStyle(el);
      return { bottom: cs.bottom, right: cs.right };
    });
    expect(style.bottom).toBe('16px');
    expect(style.right).toBe('16px');

    // Pin the CONTRACT, not this machine's pixels: right/bottom-anchored 16px
    // off the viewport edge at 1280x720 (the suite's default). Absolute x/y
    // were pinned here originally and broke on CI — Linux font metrics shift
    // the bar's intrinsic width by a few px, which is not what this test
    // guards. Height and anchoring are layout; width may breathe ±8px.
    const box = (await zoomBar.boundingBox())!;
    const viewport = page.viewportSize()!;
    expect(box.height).toBe(36);
    expect(Math.abs(box.width - 124)).toBeLessThanOrEqual(8);
    expect(box.x + box.width).toBeCloseTo(viewport.width - 16, 0);
    expect(box.y + box.height).toBeCloseTo(viewport.height - 16, 0);
  });
});
