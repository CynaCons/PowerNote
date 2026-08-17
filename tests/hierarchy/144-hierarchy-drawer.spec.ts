/**
 * Test 144: Hierarchy panel becomes an overlay drawer on narrow viewports
 * Covers: REQ-HIER-016
 *
 * T143's audit found the bug this fixes: the panel shared the flex row with
 * the canvas at every width, so its fixed 240px (min 180px) default left a
 * 390px phone only ~100px of usable canvas. Below the 768px breakpoint
 * (matching ZoomBar.css's narrow-viewport query) the panel now overlays the
 * canvas instead, backed by a dimmed backdrop; the flex/grid layout no
 * longer reserves space for it in that mode. Above the breakpoint nothing
 * changes — pinned by the 144b describe block below.
 */
import { test, expect } from '@playwright/test';
import { waitForCanvasReady, activateTool } from '../helpers';

test.describe('144a - Overlay drawer at 390x844 (REQ-HIER-016)', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForCanvasReady(page);
  });

  test('opening the panel overlays the canvas (no shrink) with a visible backdrop', async ({ page }) => {
    const canvas = page.locator('[data-testid="canvas-container"]');
    const before = (await canvas.boundingBox())!.width;

    await activateTool(page, 'hierarchy');
    await expect(page.locator('[data-testid="hierarchy-panel"]')).toBeVisible();
    await expect(page.locator('[data-testid="hierarchy-backdrop"]')).toBeVisible();

    const after = (await canvas.boundingBox())!.width;
    // The panel overlays; the canvas container itself does not shrink.
    expect(after).toBe(before);
    // 390 - 48px nav rail: the full canvas column, not a ~100px sliver.
    expect(after).toBeGreaterThanOrEqual(342);
  });

  test('clicking the backdrop closes the panel', async ({ page }) => {
    await activateTool(page, 'hierarchy');
    await expect(page.locator('[data-testid="hierarchy-panel"]')).toBeVisible();

    // The backdrop spans the canvas area's width (390 - 48px nav rail =
    // 342px) but the panel (z-index above it) covers its left 240px, so
    // click a point clearly to the right of the panel and still inside the
    // backdrop's own box — the dimmed area a real tap would land on.
    await page
      .locator('[data-testid="hierarchy-backdrop"]')
      .click({ position: { x: 300, y: 100 } });

    await expect(page.locator('[data-testid="hierarchy-panel"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="hierarchy-backdrop"]')).toHaveCount(0);
  });

  test('Escape closes the panel', async ({ page }) => {
    await activateTool(page, 'hierarchy');
    await expect(page.locator('[data-testid="hierarchy-panel"]')).toBeVisible();

    await page.keyboard.press('Escape');

    await expect(page.locator('[data-testid="hierarchy-panel"]')).toHaveCount(0);
  });

  test('picking a page from the panel closes it and switches the active page', async ({ page }) => {
    const secondPageId = await page.evaluate(() => {
      const ws = (window as any).__POWERNOTE_STORES__.workspace;
      const sectionId = ws.getState().activeSectionId;
      ws.getState().addPage(sectionId, 'Second Page');
      const section = ws
        .getState()
        .workspace.sections.find((s: any) => s.id === sectionId);
      return section.pages[section.pages.length - 1].id;
    });

    await activateTool(page, 'hierarchy');
    await expect(page.locator('[data-testid="hierarchy-panel"]')).toBeVisible();

    await page.locator(`[data-testid="page-${secondPageId}"]`).click();

    await expect(page.locator('[data-testid="hierarchy-panel"]')).toHaveCount(0);
    const activePageId = await page.evaluate(
      () => (window as any).__POWERNOTE_STORES__.workspace.getState().activePageId,
    );
    expect(activePageId).toBe(secondPageId);
  });
});

test.describe('144b - Desktop layout is unchanged (1280x720)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForCanvasReady(page);
  });

  test('the panel opens beside the canvas and the canvas shrinks, exactly as before', async ({ page }) => {
    const canvas = page.locator('[data-testid="canvas-container"]');
    const before = (await canvas.boundingBox())!.width;

    await activateTool(page, 'hierarchy');
    const panel = page.locator('[data-testid="hierarchy-panel"]');
    await expect(panel).toBeVisible();

    // The backdrop element exists (rendered whenever the panel is open) but
    // must have zero visual/interactive footprint above the breakpoint.
    await expect(page.locator('[data-testid="hierarchy-backdrop"]')).toBeHidden();

    const panelBox = (await panel.boundingBox())!;
    const after = (await canvas.boundingBox())!.width;
    expect(after).toBeLessThan(before);
    expect(before - after).toBeCloseTo(panelBox.width, 0);

    // In-flow, not an overlay.
    const position = await panel.evaluate((el) => getComputedStyle(el).position);
    expect(position).toBe('relative');
  });

  test('picking a page does not close the panel (unlike drawer mode)', async ({ page }) => {
    const secondPageId = await page.evaluate(() => {
      const ws = (window as any).__POWERNOTE_STORES__.workspace;
      const sectionId = ws.getState().activeSectionId;
      ws.getState().addPage(sectionId, 'Second Page');
      const section = ws
        .getState()
        .workspace.sections.find((s: any) => s.id === sectionId);
      return section.pages[section.pages.length - 1].id;
    });

    await activateTool(page, 'hierarchy');
    await page.locator(`[data-testid="page-${secondPageId}"]`).click();

    await expect(page.locator('[data-testid="hierarchy-panel"]')).toBeVisible();
    const activePageId = await page.evaluate(
      () => (window as any).__POWERNOTE_STORES__.workspace.getState().activePageId,
    );
    expect(activePageId).toBe(secondPageId);
  });
});
