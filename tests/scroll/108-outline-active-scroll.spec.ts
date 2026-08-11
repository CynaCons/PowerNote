/**
 * Test 108: Document outline + active scroll
 * Covers: REQ-OUTLINE-001..005, REQ-SCROLL-011, REQ-SCROLL-012
 *
 * The outline is DERIVED from markdown, never stored, and scoped to the one
 * active scroll. Two properties matter most here and neither is obvious from
 * the UI: that a heading buried inside a multi-heading block resolves to its
 * own position rather than the block's, and that navigation never changes zoom.
 */
import { test, expect } from '@playwright/test';
import {
  waitForCanvasReady,
  waitForBridgeReady,
  runBridge,
  stubBridgeUrl,
  getCanvasStore,
} from '../helpers';

type PW = import('@playwright/test').Page;

const outlineItems = (page: PW) => page.locator('[data-testid="outline-item"]');

async function openOutline(page: PW) {
  await page.locator('[data-testid="nav-hierarchy"]').click();
  await page.locator('[data-testid="sidebar-tab-outline"]').click();
}

async function seedTwoScrolls(page: PW) {
  return page.evaluate(async () => {
    const run = (cmd: string, params: any = {}) =>
      (window as any).__POWERNOTE_BRIDGE__.runBridgeCommand(cmd, params);

    const first = (await run('list_scrolls')).scrolls[0].scrollId;
    await run('rename_scroll', { scrollId: first, title: 'Research log' });
    const second = await run('create_scroll', { title: 'Open questions' });

    // One block holding three headings — the sub-block precision case.
    await run('append_block', {
      markdown: '# Alpha\n\nIntro prose.\n\n## Beta\n\nMore text.\n\n### Gamma\n\nTail.',
    });
    await run('append_block', { markdown: '# Delta', scrollId: second.scrollId });
    await run('append_block', { markdown: '## Epsilon', scrollId: second.scrollId });

    return { first, second: second.scrollId };
  });
}

test.describe('108 - Outline + active scroll (REQ-OUTLINE-001..005)', () => {
  test.beforeEach(async ({ page }) => {
    await stubBridgeUrl(page);
    await page.goto('/');
    await waitForCanvasReady(page);
    await waitForBridgeReady(page);
  });

  test('outline shows only the active scroll, defaulting to the leftmost', async ({ page }) => {
    await seedTwoScrolls(page);
    await openOutline(page);

    // Leftmost scroll's headings only — the second scroll's must not appear.
    await expect(outlineItems(page)).toHaveText(['Alpha', 'Beta', 'Gamma']);
    await expect(page.locator('[data-testid="outline-scope"]')).toHaveText('Research log');
  });

  test('clicking a scroll in the sidebar switches the outline to it', async ({ page }) => {
    const ids = await seedTwoScrolls(page);
    await page.locator('[data-testid="nav-hierarchy"]').click();
    await page.locator(`[data-testid="scroll-${ids.second}"]`).click();
    await page.locator('[data-testid="sidebar-tab-outline"]').click();

    await expect(outlineItems(page)).toHaveText(['Delta', 'Epsilon']);
    await expect(page.locator('[data-testid="outline-scope"]')).toHaveText('Open questions');
  });

  test('clicking a scroll moves the viewport to its start', async ({ page }) => {
    const ids = await seedTwoScrolls(page);
    await page.evaluate(() =>
      (window as any).__POWERNOTE_STORES__.canvas.getState().setViewport({ x: 0, y: -900, scale: 1 }),
    );

    await page.locator('[data-testid="nav-hierarchy"]').click();
    await page.locator(`[data-testid="scroll-${ids.second}"]`).click();
    await page.waitForTimeout(200);

    const { viewport } = await getCanvasStore(page);
    // Top of the scroll is y=0, placed at the documented inset.
    expect(viewport.y).toBeCloseTo(24, 0);
    // And it scrolled back up from -900 rather than staying put.
    expect(viewport.y).toBeGreaterThan(-900);
  });

  test('the active scroll is marked in the sidebar', async ({ page }) => {
    const ids = await seedTwoScrolls(page);
    await page.locator('[data-testid="nav-hierarchy"]').click();
    await page.locator(`[data-testid="scroll-${ids.second}"]`).click();

    await expect(page.locator(`[data-testid="scroll-${ids.second}"]`)).toHaveAttribute(
      'data-active',
      'true',
    );
    await expect(page.locator(`[data-testid="scroll-${ids.first}"]`)).toHaveAttribute(
      'data-active',
      'false',
    );
  });

  test('headings inside one block resolve to distinct positions', async ({ page }) => {
    await seedTwoScrolls(page);

    const positions = await page.evaluate(async () => {
      const mod = await import('/src/utils/outline.ts');
      const nodes = (window as any).__POWERNOTE_STORES__.canvas.getState().nodes;
      return mod
        .deriveOutline(nodes)
        .filter((e: any) => ['Alpha', 'Beta', 'Gamma'].includes(e.text))
        .map((e: any) => e.y);
    });

    // All three live in ONE block; anchoring to node.y would collapse them.
    expect(new Set(positions).size).toBe(3);
    expect(positions[0]).toBeLessThan(positions[1]);
    expect(positions[1]).toBeLessThan(positions[2]);
  });

  test('jumping to a heading preserves zoom', async ({ page }) => {
    await seedTwoScrolls(page);
    await page.evaluate(() =>
      (window as any).__POWERNOTE_STORES__.canvas.getState().setViewport({ scale: 0.4 }),
    );
    await openOutline(page);

    await outlineItems(page).filter({ hasText: 'Gamma' }).click();
    await page.waitForTimeout(200);

    const { viewport } = await getCanvasStore(page);
    expect(viewport.scale).toBeCloseTo(0.4, 5);
  });

  test('outline updates when a heading is edited', async ({ page }) => {
    await seedTwoScrolls(page);
    await openOutline(page);
    await expect(outlineItems(page)).toHaveText(['Alpha', 'Beta', 'Gamma']);

    const content = await runBridge(page, 'read_page');
    const block = content.blocks.find((b: any) => b.markdown.startsWith('# Alpha'));
    await runBridge(page, 'update_block', {
      blockId: block.blockId,
      markdown: '# Renamed\n\nIntro prose.\n\n## Beta\n\nMore text.',
    });

    // Derived, not stored — so it follows the edit with no extra bookkeeping.
    await expect(outlineItems(page)).toHaveText(['Renamed', 'Beta']);
  });

  test('a page with no headings explains itself', async ({ page }) => {
    await openOutline(page);
    await expect(page.locator('[data-testid="outline-empty"]')).toBeVisible();
  });
});
