/**
 * Test 143: Top bar breadcrumb survives a phone-width viewport
 * Covers: REQ-CANVAS-029
 *
 * Audit of TopBar/HierarchyPanel at 390x844 and 712x1138 (v0.44 narrow-
 * viewport pass alongside the ZoomBar/toolbar overlap fix, see
 * tests/toolbar/142-zoombar-toolbar-no-overlap.spec.ts). Everything else
 * checked held up without changes: no page-level horizontal overflow at
 * either width, TopBar's action buttons never lost their fixed size, and
 * a 712px-wide viewport has enough room for the default-width HierarchyPanel
 * to coexist with the canvas. The one bug that reproduced is fixed here.
 *
 * .top-bar__breadcrumb (TopBar.css) has `overflow: hidden` but, before this
 * fix, none of its children had `min-width: 0` / `text-overflow: ellipsis`
 * — a flex row's items refuse to shrink below their own content width by
 * default, so on a narrow viewport with a long filename/section/page title
 * the breadcrumb didn't shrink each segment, it just hard-clipped whatever
 * didn't fit, silently, with no ellipsis. Worst case: the active page's own
 * name (the most important segment, and the last one in DOM order) could be
 * clipped away entirely.
 *
 * Left unaudited/unfixed and reported instead (structural, not mechanical):
 * the HierarchyPanel's fixed 240px default width (MIN_WIDTH 180) leaves the
 * canvas only ~100px at 390px wide with the panel open — usable in that it
 * doesn't leak a page-level scrollbar, but not a real working canvas. A
 * resizable sidebar sharing a fixed-width grid column isn't a good fit for
 * a phone; the fix would be an overlay drawer on narrow viewports, which is
 * a real UI change, not a mechanical CSS one.
 */
import { test, expect } from '@playwright/test';
import { waitForCanvasReady } from '../helpers';

test.describe('143 - Top bar breadcrumb on a phone-width viewport (REQ-CANVAS-029)', () => {
  test.use({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });

  test('a long filename/section/page title ellipsizes per-segment instead of being hard-clipped', async ({ page }) => {
    await page.goto('/');
    await waitForCanvasReady(page);

    await page.evaluate(() => {
      const ws = (window as any).__POWERNOTE_STORES__.workspace;
      const workspace = ws.getState().workspace;
      ws.setState({
        workspace: {
          ...workspace,
          filename: 'A Really Long Notebook Filename That Keeps Going And Going',
          sections: workspace.sections.map((s: any, i: number) =>
            i === 0
              ? {
                  ...s,
                  title: 'A Very Long Section Title Indeed',
                  pages: s.pages.map((p: any, j: number) =>
                    j === 0 ? { ...p, title: 'An Extremely Long Page Title For Testing Overflow Behavior' } : p,
                  ),
                }
              : s,
          ),
        },
      });
    });

    const breadcrumb = page.locator('.top-bar__breadcrumb');
    await expect(breadcrumb).toBeVisible();

    // The old bug: scrollWidth > clientWidth meant content was hard-clipped
    // by the ancestor's overflow:hidden with no visual indication at all.
    // Each segment now shrinks (min-width:0) and ellipsizes to fit instead.
    const { scrollWidth, clientWidth } = await breadcrumb.evaluate((el) => ({
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
    }));
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth);

    // The active page crumb (last segment, most important) is still present
    // in the DOM and rendered with a real box — not collapsed to nothing.
    const pageCrumb = page.locator('[data-testid="topbar-page"]');
    await expect(pageCrumb).toBeVisible();
    const box = await pageCrumb.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThan(0);

    // No page-level horizontal scrollbar leaked from the breadcrumb overflow.
    const docScrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(docScrollWidth).toBeLessThanOrEqual(390);
  });
});
