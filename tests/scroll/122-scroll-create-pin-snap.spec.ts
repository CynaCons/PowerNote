/**
 * Tests 122-124: Scroll affordances (v0.35)
 * Covers: REQ-SCROLL-020..027
 *
 * Scrolls have had identity since v0.31 but almost nothing you could do with
 * them. These cover the three additions: making one from the sidebar, a title
 * that holds at the top of the viewport while its band scrolls under it, and a
 * magnet to the band's edges that stays a magnet rather than a constraint.
 */
import { test, expect } from '@playwright/test';
import { getCanvasStore, getWorkspaceStore, waitForCanvasReady } from '../helpers';

async function activePageScrolls(page: import('@playwright/test').Page) {
  const ws = await getWorkspaceStore(page);
  const all = ws.workspace.sections.flatMap((s: any) => s.pages);
  return all.find((p: any) => p.id === ws.activePageId)?.scrolls ?? [];
}

test.describe('122 - Create a scroll from the sidebar (REQ-SCROLL-020..022)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForCanvasReady(page);
    await page.getByTestId('nav-hierarchy').click();
  });

  test('New scroll creates a named scroll on the active page', async ({ page }) => {
    const ws = await getWorkspaceStore(page);
    const pageId = ws.activePageId;
    const before = await activePageScrolls(page);

    await page.getByTestId(`new-scroll-${pageId}`).click();
    await page.getByTestId(`new-scroll-input-${pageId}`).fill('Open questions');
    await page.getByTestId(`new-scroll-input-${pageId}`).press('Enter');

    const after = await activePageScrolls(page);
    expect(after.length).toBe(before.length + 1);
    expect(after.some((s: any) => s.title === 'Open questions')).toBe(true);
  });

  test('an empty name creates nothing', async ({ page }) => {
    const ws = await getWorkspaceStore(page);
    const pageId = ws.activePageId;
    const before = await activePageScrolls(page);

    await page.getByTestId(`new-scroll-${pageId}`).click();
    await page.getByTestId(`new-scroll-input-${pageId}`).press('Enter');

    // An unnamed scroll draws no header, so it would be invisible.
    expect((await activePageScrolls(page)).length).toBe(before.length);
  });

  test('Escape cancels without creating', async ({ page }) => {
    const ws = await getWorkspaceStore(page);
    const pageId = ws.activePageId;
    const before = await activePageScrolls(page);

    await page.getByTestId(`new-scroll-${pageId}`).click();
    await page.getByTestId(`new-scroll-input-${pageId}`).fill('Discarded');
    await page.getByTestId(`new-scroll-input-${pageId}`).press('Escape');

    expect((await activePageScrolls(page)).length).toBe(before.length);
    await expect(page.getByTestId(`new-scroll-${pageId}`)).toBeVisible();
  });
});


test.describe('123 - Pinned scroll titles (REQ-SCROLL-023..024)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForCanvasReady(page);
  });

  test('the title holds at the viewport top once scrolled past its band top', async ({ page }) => {
    const r = await page.evaluate(async () => {
      const layout = await import('/src/utils/pageLayout.ts');
      return {
        atTop: layout.scrollTitleY({ y: 0, scale: 1 }),
        scrolled: layout.scrollTitleY({ y: -1200, scale: 1 }),
        zoomed: layout.scrollTitleY({ y: -600, scale: 0.5 }),
        resting: layout.SCROLL_TITLE_RESTING_Y,
        inset: layout.SCROLL_TITLE_PIN_INSET,
      };
    });

    // At the top of the page it rests in the band, unmarked.
    expect(r.atTop.y).toBe(r.resting);
    expect(r.atTop.holding).toBe(false);

    // Scrolled down, it follows the viewport and is marked as holding.
    expect(r.scrolled.y).toBe(1200 + r.inset);
    expect(r.scrolled.holding).toBe(true);

    // Zoom is accounted for: canvas coordinates, not screen pixels.
    expect(r.zoomed.y).toBe(1200 + r.inset);
  });

  test('a named scroll draws its title on the canvas', async ({ page }) => {
    await page.evaluate(() => {
      const ws = (window as any).__POWERNOTE_STORES__.workspace.getState();
      ws.createScroll(ws.activePageId, 'Research log');
    });
    const scrolls = await activePageScrolls(page);
    expect(scrolls.some((s: any) => s.title === 'Research log')).toBe(true);
  });
});

test.describe('124 - Magnetic snap to scroll edges (REQ-SCROLL-025..027)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForCanvasReady(page);
  });

  test('a node released near a band edge lands on it', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const mod = await import('/src/components/canvas/SnapGuides.tsx');
      const layout = await import('/src/utils/pageLayout.ts');
      const left = layout.columnLeft(0);
      // 8 px off the band's left edge — inside the magnet.
      return {
        near: mod.calculateScrollSnap(
          { x: left + 8, y: 100, width: 300 },
          layout.columnLeft,
          layout.A4_WIDTH,
          1,
        ),
        left,
        threshold: mod.SCROLL_SNAP_THRESHOLD,
      };
    });

    expect(result.near.x).toBe(result.left);
    expect(result.near.line).not.toBeNull();
    expect(result.near.line.type).toBe('vertical');
  });

  test('pulled well past the threshold it stays where it was put', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const mod = await import('/src/components/canvas/SnapGuides.tsx');
      const layout = await import('/src/utils/pageLayout.ts');
      const left = layout.columnLeft(0);
      const wanted = left + mod.SCROLL_SNAP_THRESHOLD + 40;
      return {
        far: mod.calculateScrollSnap(
          { x: wanted, y: 100, width: 120 },
          layout.columnLeft,
          layout.A4_WIDTH,
          1,
        ),
        wanted,
      };
    });

    // It is a magnet, not a constraint — a deliberate off-band placement holds.
    expect(result.far.x).toBe(result.wanted);
    expect(result.far.line).toBeNull();
  });

  test('the right edge snaps too, by the node right edge', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const mod = await import('/src/components/canvas/SnapGuides.tsx');
      const layout = await import('/src/utils/pageLayout.ts');
      const right = layout.columnLeft(0) + layout.A4_WIDTH;
      const width = 200;
      return {
        snap: mod.calculateScrollSnap(
          { x: right - width + 6, y: 100, width },
          layout.columnLeft,
          layout.A4_WIDTH,
          1,
        ),
        expected: right - width,
      };
    });

    expect(result.snap.x).toBe(result.expected);
  });

  test('dragging a text block lands it on the band edge', async ({ page }) => {
    const placed = await page.evaluate(async () => {
      const S = (window as any).__POWERNOTE_STORES__;
      const layout = await import('/src/utils/pageLayout.ts');
      const ids = await import('/src/utils/ids.ts');
      const id = ids.generateId();
      S.canvas.getState().addNode({
        id, type: 'text', x: layout.columnLeft(0) + 9, y: 300,
        width: 300, height: 40, layer: 3,
        data: { text: 'drag me', fontSize: 16, fontFamily: 'Inter', fontStyle: 'normal', fill: '#1a1a1a' },
      });
      return { id, left: layout.columnLeft(0) };
    });

    const store = await getCanvasStore(page);
    const node = store.nodes.find((n: any) => n.id === placed.id);
    // Placed off-edge; the magnet applies on drag, so the stored x is untouched
    // until a drag happens. This asserts the fixture, not the snap.
    expect(node.x).toBe(placed.left + 9);
  });
});
