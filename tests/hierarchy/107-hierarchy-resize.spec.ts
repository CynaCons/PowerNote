/**
 * Test 107: Resizable hierarchy panel
 * Covers: REQ-HIER-012, REQ-HIER-013, REQ-HIER-014, REQ-HIER-015
 *
 * The panel was fixed at 240px, which ellipsised any page or section name
 * longer than the column. Dragging the right edge widens it.
 *
 * The last case is the one that matters to the user: it asserts that a long
 * title actually reveals more text once widened, rather than just that a number
 * changed — a panel that grows while its content stays clipped would pass every
 * other assertion here and still not fix the problem.
 */
import { test, expect } from '@playwright/test';
import { waitForCanvasReady } from '../helpers';

const DEFAULT_WIDTH = 240;
const MIN_WIDTH = 180;
const MAX_WIDTH = 560;

type PW = import('@playwright/test').Page;

const panel = (page: PW) => page.locator('[data-testid="hierarchy-panel"]');
const handle = (page: PW) => page.locator('[data-testid="hierarchy-resize-handle"]');

async function panelWidth(page: PW) {
  return (await panel(page).boundingBox())!.width;
}

/** Drag the handle by `dx` px using real mouse events. */
async function dragHandle(page: PW, dx: number) {
  const box = (await handle(page).boundingBox())!;
  const y = box.y + box.height / 2;
  const startX = box.x + box.width / 2;

  await page.mouse.move(startX, y);
  await page.mouse.down();
  // Intermediate moves: pointermove only fires while the pointer actually
  // travels, so a single jump can be swallowed.
  await page.mouse.move(startX + dx / 2, y);
  await page.mouse.move(startX + dx, y);
  await page.mouse.up();
}

async function openHierarchy(page: PW) {
  await page.locator('[data-testid="nav-hierarchy"]').click();
  await expect(panel(page)).toBeVisible();
}

test.describe('107 - Resizable hierarchy panel (REQ-HIER-012..015)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForCanvasReady(page);
    await openHierarchy(page);
  });

  test('opens at the default width with a visible handle', async ({ page }) => {
    expect(await panelWidth(page)).toBeCloseTo(DEFAULT_WIDTH, 0);
    await expect(handle(page)).toBeVisible();
  });

  test('dragging the handle right widens the panel', async ({ page }) => {
    await dragHandle(page, 120);
    expect(await panelWidth(page)).toBeCloseTo(DEFAULT_WIDTH + 120, 0);
  });

  test('dragging left narrows the panel', async ({ page }) => {
    await dragHandle(page, -40);
    expect(await panelWidth(page)).toBeCloseTo(DEFAULT_WIDTH - 40, 0);
  });

  test('width is clamped at both bounds', async ({ page }) => {
    await dragHandle(page, 900);
    expect(await panelWidth(page)).toBeCloseTo(MAX_WIDTH, 0);

    await dragHandle(page, -900);
    expect(await panelWidth(page)).toBeCloseTo(MIN_WIDTH, 0);
  });

  test('double-clicking the handle resets to the default', async ({ page }) => {
    await dragHandle(page, 150);
    expect(await panelWidth(page)).toBeGreaterThan(DEFAULT_WIDTH);

    await handle(page).dblclick();
    expect(await panelWidth(page)).toBeCloseTo(DEFAULT_WIDTH, 0);
  });

  test('arrow keys resize and Home resets (REQ-HIER-014)', async ({ page }) => {
    await handle(page).focus();

    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    expect(await panelWidth(page)).toBeCloseTo(DEFAULT_WIDTH + 32, 0);

    await page.keyboard.press('ArrowLeft');
    expect(await panelWidth(page)).toBeCloseTo(DEFAULT_WIDTH + 16, 0);

    await page.keyboard.press('Home');
    expect(await panelWidth(page)).toBeCloseTo(DEFAULT_WIDTH, 0);
  });

  test('width does not survive a reload (REQ-HIER-015)', async ({ page }) => {
    await dragHandle(page, 150);
    expect(await panelWidth(page)).toBeGreaterThan(DEFAULT_WIDTH);

    await page.reload();
    await waitForCanvasReady(page);
    await openHierarchy(page);

    expect(await panelWidth(page)).toBeCloseTo(DEFAULT_WIDTH, 0);
  });

  test('a long page name reveals more text once the panel is widened', async ({ page }) => {
    const longTitle = 'Quarterly planning and architecture review notes 2026';
    await page.evaluate((title) => {
      const ws = (window as any).__POWERNOTE_STORES__.workspace.getState();
      ws.renamePage(ws.activeSectionId, ws.activePageId, title);
    }, longTitle);

    const title = page.locator('[data-testid="page-title"]').first();
    await expect(title).toHaveText(longTitle);

    // Rendered width is what the user can actually read — the text node is
    // clipped by overflow:hidden + ellipsis, so scrollWidth stays constant while
    // clientWidth grows with the panel.
    const visibleBefore = await title.evaluate((el) => el.clientWidth);
    await dragHandle(page, 200);
    const visibleAfter = await title.evaluate((el) => el.clientWidth);

    expect(visibleAfter).toBeGreaterThan(visibleBefore);
  });
});
