/**
 * Test 141: Toolbar popovers escape clipping; toolbar survives narrow screens
 * Covers: REQ-TOOL-008, REQ-TOOL-009
 *
 * ColorPopover/SizePopover/EraserPopover now portal their panel to
 * document.body, positioned via the trigger button's getBoundingClientRect()
 * (see src/components/toolbar/PopoverPortal.tsx). That's what makes it safe
 * for .bottom-toolbar to carry `overflow-x: auto` again — the popovers are
 * no longer clipped-descendants of the toolbar's box.
 */
import { test, expect } from '@playwright/test';
import { getCanvasStore, waitForCanvasReady, clickCanvas, activateTool } from '../helpers';

async function addAndSelectTextNode(page: import('@playwright/test').Page) {
  await page.evaluate(() => {
    const store = (window as any).__POWERNOTE_STORES__.canvas.getState();
    store.addNode({
      id: 'narrow-toolbar-text',
      type: 'text',
      x: 200,
      y: 200,
      width: 120,
      height: 30,
      data: { text: 'Hello', fontSize: 16, fontFamily: 'Inter', fontStyle: 'normal', fill: '#1a1a1a' },
    });
    store.selectNode('narrow-toolbar-text', false);
  });
}

test.describe('141a - Popover escapes toolbar clipping on desktop (REQ-TOOL-008)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForCanvasReady(page);
  });

  test('color popover opens fully visible and a swatch click updates the node (same interaction as T11)', async ({ page }) => {
    await addAndSelectTextNode(page);
    await expect(page.locator('[data-testid="bottom-toolbar"]')).toBeVisible();

    let store = await getCanvasStore(page);
    const initialFill = store.nodes[0].data.fill;

    await page.click('[data-testid="color-trigger"]');
    const popover = page.locator('[data-testid="color-popover"]');
    await expect(popover).toBeVisible();

    // Not clipped: the panel's box is fully inside the viewport.
    const box = await popover.boundingBox();
    const viewport = page.viewportSize()!;
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width + 1);
    expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height + 1);

    // Click the red swatch (row 2, col 1 = #dc2626) — identical to T11.
    await page.locator('.color-popover__swatch').nth(4).click();
    await page.waitForTimeout(200);

    store = await getCanvasStore(page);
    expect(store.nodes[0].data.fill).not.toBe(initialFill);
    expect(store.nodes[0].data.fill).toBe('#dc2626');
  });
});

test.describe('141b - Toolbar survives a narrow/mobile viewport (REQ-TOOL-009)', () => {
  // Phone emulation, own describe like tests/canvas/137-mobile-shell.spec.ts
  // and tests/canvas/140-touch-transformer-anchors.spec.ts — a full
  // devices[] profile can't be used inside a describe (carries
  // defaultBrowserType), so the relevant fields are set directly.
  test.use({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });

  test('the toolbar is bounded by its own container and scrolls instead of overflowing', async ({ page }) => {
    await page.goto('/');
    await waitForCanvasReady(page);
    await addAndSelectTextNode(page);

    const toolbar = page.locator('[data-testid="bottom-toolbar"]');
    await expect(toolbar).toBeVisible();

    // Bounded relative to .canvas-area__content (the toolbar's positioned
    // ancestor — see AppShell.css) AND relative to the actual window
    // viewport. Both used to diverge: .canvas-area__content itself rendered
    // wider than the window (a bare `1fr` grid track refuses to shrink
    // below its content's min-content width, reproducible with zero canvas
    // nodes present) — a pre-existing layout bug upstream of the toolbar.
    // That's fixed now (AppShell.css: `minmax(0, 1fr)` on the grid column
    // plus `min-width: 0` on .canvas-area__content), so this test asserts
    // both: the contract BottomToolbar.css owns (never exceeds its own
    // container by more than the 16px margin, scrolling internally instead
    // of growing further) AND the contract AppShell.css now owns (the
    // container itself never exceeds the viewport, so nothing upstream of
    // the toolbar can push it off-screen either).
    const { toolbarBox, containerBox, overflowX, viewportWidth, docScrollWidth, windowInnerWidth } = await page.evaluate(() => {
      const toolbarEl = document.querySelector('[data-testid="bottom-toolbar"]') as HTMLElement;
      const containerEl = document.querySelector('.canvas-area__content') as HTMLElement;
      return {
        toolbarBox: toolbarEl.getBoundingClientRect().toJSON(),
        containerBox: containerEl.getBoundingClientRect().toJSON(),
        overflowX: getComputedStyle(toolbarEl).overflowX,
        viewportWidth: containerEl.getBoundingClientRect().width,
        docScrollWidth: document.documentElement.scrollWidth,
        windowInnerWidth: window.innerWidth,
      };
    });

    expect(toolbarBox.width).toBeLessThanOrEqual(containerBox.width - 16 + 1);
    expect(toolbarBox.left).toBeGreaterThanOrEqual(containerBox.left - 1);
    expect(toolbarBox.right).toBeLessThanOrEqual(containerBox.right + 1);

    // Viewport containment: .canvas-area__content must not itself overflow
    // the 390px-wide window, and the document must carry no horizontal
    // scrollbar. This is the assertion that would have caught the AppShell
    // grid-track bug directly instead of only through the toolbar's symptom.
    expect(viewportWidth).toBeLessThanOrEqual(390);
    expect(docScrollWidth).toBeLessThanOrEqual(windowInnerWidth);

    // Overflow handling is in place even if this particular toolbar
    // (a handful of text-formatting controls) isn't currently wide enough
    // to need it — the CSS property being 'auto' is what protects a wider
    // toolbar (e.g. the shape toolbar with more controls) from spilling
    // off-screen.
    expect(overflowX).toBe('auto');
  });

  test('opening a popover on a narrow screen keeps it fully within the actual viewport', async ({ page }) => {
    await page.goto('/');
    await waitForCanvasReady(page);
    await addAndSelectTextNode(page);

    // PopoverPortal's clamping logic (it reads window.innerWidth directly,
    // independent of where its anchor sits) is what this test verifies.
    await page.click('[data-testid="color-trigger"]');
    const popover = page.locator('[data-testid="color-popover"]');
    await expect(popover).toBeVisible();

    const box = await popover.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(390 + 1);
    expect(box!.y + box!.height).toBeLessThanOrEqual(844 + 1);
  });
});
