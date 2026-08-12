/**
 * Test 104: Scroll identity, headers and band bookkeeping
 * Covers: REQ-SCROLL-001, REQ-SCROLL-002, REQ-SCROLL-003, REQ-SCROLL-004,
 *         REQ-SCROLL-005, REQ-SCROLL-008
 *
 * A scroll is a NAMED BAND, not a container: the record owns the id and title,
 * membership is derived from where a block physically sits. These tests pin
 * both halves — that ids survive a save/open round trip, and that moving or
 * deleting a scroll carries its blocks with it so the two never disagree.
 */
import { test, expect } from '@playwright/test';
import {
  getWorkspaceStore,
  waitForCanvasReady,
  disableFSA,
} from '../helpers';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const A4_WIDTH = 794;
const PAGE_GAP = 40;
const PAGE_MARGIN = 60;
const columnX = (col: number) => PAGE_MARGIN + col * (A4_WIDTH + PAGE_GAP);

type PW = import('@playwright/test').Page;

/** Put a text block at a given column, straight into the canvas store. */
async function seedBlock(page: PW, id: string, column: number, y: number) {
  await page.evaluate(
    ([id, x, y]) => {
      const canvas = (window as any).__POWERNOTE_STORES__.canvas.getState();
      canvas.addNode({
        id,
        type: 'text',
        x,
        y,
        width: 794,
        height: 40,
        layer: 4,
        data: {
          text: 'block ' + id,
          fontSize: 16,
          fontFamily: 'Inter, system-ui, sans-serif',
          fontStyle: 'normal',
          fill: '#1a1a1a',
        },
      });
    },
    [id, columnX(column), y] as [string, number, number],
  );
}

async function activePage(page: PW) {
  const ws = await getWorkspaceStore(page);
  const section = ws.workspace.sections.find((s: any) => s.id === ws.activeSectionId);
  return section.pages.find((p: any) => p.id === ws.activePageId);
}

async function createScroll(page: PW, title: string): Promise<string> {
  return page.evaluate((title) => {
    const ws = (window as any).__POWERNOTE_STORES__.workspace.getState();
    return (window as any).__POWERNOTE_SCROLL_OPS__.createScroll(ws.activePageId, title).id;
  }, title);
}

test.describe('104 - Scroll identity (REQ-SCROLL-001..008)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForCanvasReady(page);
  });

  test('every page starts with one untitled scroll, and untitled draws no header', async ({
    page,
  }) => {
    const p = await activePage(page);
    expect(p.scrolls).toHaveLength(1);
    expect(p.scrolls[0].column).toBe(0);
    expect(p.scrolls[0].title).toBe('');
    expect(p.scrolls[0].id).toBeTruthy();

    // An unnamed scroll is invisible chrome — a backfilled notebook must look
    // exactly as it did before scrolls existed.
    await expect(page.locator('[data-testid="topbar-scroll"]')).toHaveCount(0);
  });

  test('created scrolls take successive bands and are listed in the sidebar', async ({ page }) => {
    const first = await createScroll(page, 'Research log');
    const second = await createScroll(page, 'Open questions');

    const p = await activePage(page);
    const byId = Object.fromEntries(p.scrolls.map((s: any) => [s.id, s]));
    // Column 0 is already claimed by the page's own untitled scroll.
    expect(byId[first].column).toBe(1);
    expect(byId[second].column).toBe(2);

    // Unguarded on purpose: swallowing a failed click here would let the
    // assertions below be skipped silently, and a caught action timeout is the
    // one thing in this suite that a raised timeout ceiling would slow down.
    await page.locator('[data-testid="nav-hierarchy"]').click();
    const list = page.locator(`[data-testid="page-scrolls-${p.id}"]`);
    await expect(list.locator('.hierarchy-scroll')).toHaveCount(2);
    await expect(list).toContainText('Research log');
    await expect(list).toContainText('Open questions');
  });

  test('membership is positional — a block reports the scroll it sits in', async ({ page }) => {
    const scrollId = await createScroll(page, 'Decisions');
    await seedBlock(page, 'blk-1', 1, 120);

    const inScroll = await page.evaluate((scrollId) => {
      const stores = (window as any).__POWERNOTE_STORES__;
      const ws = stores.workspace.getState();
      ws.savePageNodes(stores.canvas.getState().nodes);
      const fresh = (window as any).__POWERNOTE_STORES__.workspace.getState();
      const section = fresh.workspace.sections.find((s: any) => s.id === fresh.activeSectionId);
      const p = section.pages.find((x: any) => x.id === fresh.activePageId);
      const scroll = p.scrolls.find((s: any) => s.id === scrollId);
      const A4 = 794, GAP = 40, MARGIN = 60;
      const columnAt = (x: number) => Math.floor((x - MARGIN) / (A4 + GAP));
      return p.nodes
        .filter((n: any) => columnAt(n.x) === scroll.column)
        .map((n: any) => n.id);
    }, scrollId);

    expect(inScroll).toEqual(['blk-1']);
  });

  test('reordering a scroll carries its blocks into the new band', async ({ page }) => {
    const right = await createScroll(page, 'Decisions');
    await seedBlock(page, 'blk-left', 0, 120);
    await seedBlock(page, 'blk-right', 1, 120);

    await page.evaluate((scrollId) => {
      const ws = (window as any).__POWERNOTE_STORES__.workspace.getState();
      (window as any).__POWERNOTE_SCROLL_OPS__.reorderScroll(ws.activePageId, scrollId, 0);
    }, right);

    const p = await activePage(page);
    const moved = p.scrolls.find((s: any) => s.id === right);
    expect(moved.column).toBe(0);

    // The block must have travelled with its scroll, not stayed behind in band 1.
    const blocks = Object.fromEntries(p.nodes.map((n: any) => [n.id, n.x]));
    expect(blocks['blk-right']).toBe(columnX(0));
    expect(blocks['blk-left']).toBe(columnX(1));
  });

  test('deleting a scroll keeps its blocks by default and closes the gap', async ({ page }) => {
    const middle = await createScroll(page, 'Middle');
    await createScroll(page, 'Right');
    await seedBlock(page, 'blk-mid', 1, 120);
    await seedBlock(page, 'blk-right', 2, 120);

    await page.evaluate((scrollId) => {
      const ws = (window as any).__POWERNOTE_STORES__.workspace.getState();
      (window as any).__POWERNOTE_SCROLL_OPS__.deleteScroll(ws.activePageId, scrollId, false);
    }, middle);

    const p = await activePage(page);
    expect(p.scrolls.map((s: any) => s.title).sort()).toEqual(['', 'Right']);
    expect(p.scrolls.find((s: any) => s.title === 'Right').column).toBe(1);

    // Blocks in the removed band are not destroyed — they stay where they were.
    const blocks = Object.fromEntries(p.nodes.map((n: any) => [n.id, n.x]));
    expect(blocks['blk-mid']).toBe(columnX(1));
    expect(blocks['blk-right']).toBe(columnX(1));
  });

  test('deleting a scroll with withBlocks removes its blocks too', async ({ page }) => {
    const middle = await createScroll(page, 'Middle');
    await seedBlock(page, 'blk-mid', 1, 120);
    await seedBlock(page, 'blk-left', 0, 120);

    await page.evaluate((scrollId) => {
      const ws = (window as any).__POWERNOTE_STORES__.workspace.getState();
      (window as any).__POWERNOTE_SCROLL_OPS__.deleteScroll(ws.activePageId, scrollId, true);
    }, middle);

    const p = await activePage(page);
    expect(p.nodes.map((n: any) => n.id)).toEqual(['blk-left']);
  });

  test('the last scroll on a page cannot be deleted', async ({ page }) => {
    const before = await activePage(page);
    await page.evaluate((scrollId) => {
      const ws = (window as any).__POWERNOTE_STORES__.workspace.getState();
      (window as any).__POWERNOTE_SCROLL_OPS__.deleteScroll(ws.activePageId, scrollId, false);
    }, before.scrolls[0].id);

    const after = await activePage(page);
    expect(after.scrolls).toHaveLength(1);
  });

  test('scroll ids and titles round-trip through save → open', async ({ page }) => {
    await disableFSA(page);
    await page.goto('/');
    await waitForCanvasReady(page);

    const scrollId = await createScroll(page, 'Research log');
    await seedBlock(page, 'blk-1', 1, 120);

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.locator('[data-testid="save-btn"]').click(),
    ]);
    const tmpPath = path.join(__dirname, '..', '..', 'test-results', 'scroll-identity.html');
    fs.mkdirSync(path.dirname(tmpPath), { recursive: true });
    await download.saveAs(tmpPath);

    expect(fs.readFileSync(tmpPath, 'utf-8')).toContain('"title": "Research log"');

    await page.goto('/');
    await waitForCanvasReady(page);
    await page.locator('[data-testid="file-input"]').setInputFiles(tmpPath);
    await expect
      .poll(async () => (await activePage(page)).scrolls.length, { timeout: 5000 })
      .toBeGreaterThan(1);

    const reopened = await activePage(page);
    const restored = reopened.scrolls.find((s: any) => s.id === scrollId);
    expect(restored).toBeTruthy();
    expect(restored.title).toBe('Research log');
    expect(restored.column).toBe(1);
  });
});
