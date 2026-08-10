/**
 * Test 100: Agent notebook management + update control
 * Covers: REQ-AGENT-026..036 — rename_page, move_page, rename_notebook,
 *         save_notebook, check_update, run_update.
 *
 * Coverage boundary: the successful run_update swap is not exercised here. It
 * needs a real FSA file handle and a 2.4MB asset download, both out of reach in
 * a page context — performUpdate itself is covered by T88/T89 via injected
 * deps. What is covered here is every guard that decides whether the swap is
 * allowed to start, since those are what an agent will actually hit.
 */
import { test, expect } from '@playwright/test';
import {
  waitForCanvasReady,
  waitForBridgeReady,
  runBridge,
  runBridgeExpectingError,
  getWorkspaceStore,
} from '../helpers';

/** Replace fetch so the GitHub releases API is deterministic. */
async function stubReleases(
  page: import('@playwright/test').Page,
  response: { status?: number; tag?: string; withAsset?: boolean },
) {
  await page.evaluate(({ status, tag, withAsset }) => {
    (window as any).fetch = async (url: string) => {
      if (!String(url).includes('api.github.com')) {
        throw new Error(`unexpected fetch: ${url}`);
      }
      if (status && status !== 200) {
        return { ok: false, status, json: async () => ({}) };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          tag_name: tag,
          html_url: `https://github.com/CynaCons/PowerNote/releases/tag/${tag}`,
          assets: withAsset
            ? [{ name: 'PowerNote.html', id: 1, browser_download_url: 'https://example.invalid/PowerNote.html' }]
            : [],
        }),
      };
    };
  }, { status: response.status, tag: response.tag, withAsset: response.withAsset !== false });
}

test.describe('100 - Agent notebook management (REQ-AGENT-026..036)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForCanvasReady(page);
    await waitForBridgeReady(page);
  });

  // ── rename_page ───────────────────────────────────────────

  test('rename_page retitles the page and its matching H1 block', async ({ page }) => {
    const created = await runBridge(page, 'create_page', { title: 'Draft notes' });

    const result = await runBridge(page, 'rename_page', {
      pageId: created.pageId,
      title: 'Q3 planning',
    });

    expect(result.title).toBe('Q3 planning');
    expect(result.previousTitle).toBe('Draft notes');
    expect(result.headingBlockId).toBe(created.headingBlockId);

    const read = await runBridge(page, 'read_page', { pageId: created.pageId });
    expect(read.title).toBe('Q3 planning');
    expect(read.blocks[0].markdown).toBe('# Q3 planning');

    const ws = await getWorkspaceStore(page);
    const titles = ws.workspace.sections.flatMap((s: any) => s.pages.map((p: any) => p.title));
    expect(titles).toContain('Q3 planning');
    expect(titles).not.toContain('Draft notes');
  });

  test('rename_page leaves a hand-edited heading alone', async ({ page }) => {
    const created = await runBridge(page, 'create_page', { title: 'Draft notes' });
    await runBridge(page, 'update_block', {
      blockId: created.headingBlockId,
      markdown: '# Something the user wrote',
    });

    const result = await runBridge(page, 'rename_page', {
      pageId: created.pageId,
      title: 'Renamed',
    });

    expect(result.headingBlockId).toBeUndefined();
    const read = await runBridge(page, 'read_page', { pageId: created.pageId });
    expect(read.title).toBe('Renamed');
    expect(read.blocks[0].markdown).toBe('# Something the user wrote');
  });

  test('rename_page with updateHeading false touches only the sidebar', async ({ page }) => {
    const created = await runBridge(page, 'create_page', { title: 'Keep heading' });

    await runBridge(page, 'rename_page', {
      pageId: created.pageId,
      title: 'New title',
      updateHeading: false,
    });

    const read = await runBridge(page, 'read_page', { pageId: created.pageId });
    expect(read.title).toBe('New title');
    expect(read.blocks[0].markdown).toBe('# Keep heading');
  });

  // ── move_page ─────────────────────────────────────────────

  test('move_page relocates a page into another section', async ({ page }) => {
    const target = await runBridge(page, 'create_section', { title: 'Archive' });
    const source = await runBridge(page, 'create_section', { title: 'Working' });
    // Working now has its auto-created page; add a second so it can give one up.
    const movable = await runBridge(page, 'create_page', {
      title: 'Movable',
      sectionId: source.sectionId,
    });

    const result = await runBridge(page, 'move_page', {
      pageId: movable.pageId,
      toSectionId: target.sectionId,
    });

    expect(result.fromSectionId).toBe(source.sectionId);
    expect(result.toSectionId).toBe(target.sectionId);

    const listed = await runBridge(page, 'list_pages');
    const moved = listed.pages.filter((p: any) => p.pageId === movable.pageId);
    // Exactly one home — the old guard used to leave a copy behind.
    expect(moved).toHaveLength(1);
    expect(moved[0].sectionId).toBe(target.sectionId);
  });

  test('moving the open page keeps later writes landing on it', async ({ page }) => {
    const target = await runBridge(page, 'create_section', { title: 'Destination' });
    const source = await runBridge(page, 'create_section', { title: 'Origin' });
    const movable = await runBridge(page, 'create_page', {
      title: 'Active mover',
      sectionId: source.sectionId,
    });

    // create_page navigates to it, so this is the open page.
    await runBridge(page, 'move_page', {
      pageId: movable.pageId,
      toSectionId: target.sectionId,
    });
    await runBridge(page, 'append_block', {
      pageId: movable.pageId,
      markdown: 'written after the move',
    });

    const read = await runBridge(page, 'read_page', { pageId: movable.pageId });
    expect(read.sectionId).toBe(target.sectionId);
    expect(read.blocks.map((b: any) => b.markdown)).toContain('written after the move');
  });

  test('move_page refuses to empty the source section', async ({ page }) => {
    const target = await runBridge(page, 'create_section', { title: 'Somewhere' });
    const source = await runBridge(page, 'create_section', { title: 'Only child' });

    const err = await runBridgeExpectingError(page, 'move_page', {
      pageId: source.pageId,
      toSectionId: target.sectionId,
    });

    expect(err.code).toBe('PRECONDITION');
    expect(err.message).toContain('at least one');

    // And nothing moved.
    const listed = await runBridge(page, 'list_pages');
    const still = listed.pages.find((p: any) => p.pageId === source.pageId);
    expect(still.sectionId).toBe(source.sectionId);
  });

  test('move_page rejects an unknown section and a no-op move', async ({ page }) => {
    const section = await runBridge(page, 'create_section', { title: 'Home' });
    const extra = await runBridge(page, 'create_page', {
      title: 'Second',
      sectionId: section.sectionId,
    });

    const missing = await runBridgeExpectingError(page, 'move_page', {
      pageId: extra.pageId,
      toSectionId: 'does-not-exist',
    });
    expect(missing.code).toBe('NOT_FOUND');

    const same = await runBridgeExpectingError(page, 'move_page', {
      pageId: extra.pageId,
      toSectionId: section.sectionId,
    });
    expect(same.code).toBe('BAD_PARAMS');
  });

  // ── rename_notebook ───────────────────────────────────────

  test('rename_notebook renames in-app and reports the previous name', async ({ page }) => {
    const before = (await getWorkspaceStore(page)).workspace.filename;

    const result = await runBridge(page, 'rename_notebook', { filename: 'Team handbook' });

    expect(result.filename).toBe('Team handbook');
    expect(result.previousFilename).toBe(before);

    const after = await getWorkspaceStore(page);
    expect(after.workspace.filename).toBe('Team handbook');

    // getWorkspaceStore does not surface isDirty — read it directly.
    const isDirty = await page.evaluate(
      () => (window as any).__POWERNOTE_STORES__.workspace.getState().isDirty,
    );
    expect(isDirty).toBe(true);

    const listed = await runBridge(page, 'list_pages');
    expect(listed.notebook).toBe('Team handbook');
  });

  test('rename_notebook rejects an empty name', async ({ page }) => {
    const err = await runBridgeExpectingError(page, 'rename_notebook', { filename: '' });
    expect(err.code).toBe('BAD_PARAMS');
  });

  // ── save_notebook ─────────────────────────────────────────

  test('save_notebook explains itself when no file is bound', async ({ page }) => {
    // A freshly loaded page has no FSA handle, which is the state an agent
    // hits most often — it must not silently no-op.
    const err = await runBridgeExpectingError(page, 'save_notebook');

    expect(err.code).toBe('PRECONDITION');
    expect(err.message).toContain('not bound to a file');
  });

  // ── check_update ──────────────────────────────────────────

  test('check_update reports an available release', async ({ page }) => {
    await stubReleases(page, { tag: 'v99.0.0' });

    const result = await runBridge(page, 'check_update');

    expect(result.checked).toBe(true);
    expect(result.available).toBe(true);
    expect(result.latestVersion).toBe('99.0.0');
    expect(result.currentVersion).toBeTruthy();
    expect(result.releaseUrl).toContain('v99.0.0');
  });

  test('check_update separates "up to date" from "could not check"', async ({ page }) => {
    const current = (await runBridge(page, 'check_update').catch(() => null)) as any;
    // Establish the running version through the app itself.
    await stubReleases(page, { tag: `v${current?.currentVersion ?? '0.0.0'}` });
    const upToDate = await runBridge(page, 'check_update');
    expect(upToDate.checked).toBe(true);
    expect(upToDate.available).toBe(false);

    await stubReleases(page, { status: 403 });
    const rateLimited = await runBridge(page, 'check_update');
    expect(rateLimited.checked).toBe(false);
    expect(rateLimited.available).toBe(false);
    expect(rateLimited.message).toContain('unknown');
  });

  // ── run_update ────────────────────────────────────────────

  test('check_update never offers an older release as an update', async ({ page }) => {
    // A local build ahead of the published tag is the normal state during
    // development. Plain inequality used to report this as "available", and
    // run_update would then install the older build over the newer one.
    await stubReleases(page, { tag: 'v0.0.1' });

    const result = await runBridge(page, 'check_update');
    expect(result.checked).toBe(true);
    expect(result.available).toBe(false);
    expect(result.latestVersion).toBe('0.0.1');
    expect(result.message).toContain('ahead of the latest release');

    const err = await runBridgeExpectingError(page, 'run_update', { confirm: true });
    expect(err.code).toBe('PRECONDITION');
  });

  test('run_update requires explicit confirmation', async ({ page }) => {
    await stubReleases(page, { tag: 'v99.0.0' });

    const err = await runBridgeExpectingError(page, 'run_update', {});
    expect(err.code).toBe('BAD_PARAMS');
    expect(err.message).toContain('confirm:true');

    const alsoErr = await runBridgeExpectingError(page, 'run_update', { confirm: false });
    expect(alsoErr.code).toBe('BAD_PARAMS');
  });

  test('run_update refuses when already current or unreachable', async ({ page }) => {
    const status = await runBridge(page, 'check_update');
    await stubReleases(page, { tag: `v${status.currentVersion}` });

    const current = await runBridgeExpectingError(page, 'run_update', { confirm: true });
    expect(current.code).toBe('PRECONDITION');
    expect(current.message).toContain('latest release');

    await stubReleases(page, { status: 403 });
    const offline = await runBridgeExpectingError(page, 'run_update', { confirm: true });
    expect(offline.code).toBe('PRECONDITION');
  });

  test('run_update refuses a release with no installable asset', async ({ page }) => {
    await stubReleases(page, { tag: 'v99.0.0', withAsset: false });

    const err = await runBridgeExpectingError(page, 'run_update', { confirm: true });
    expect(err.code).toBe('PRECONDITION');
    expect(err.message).toContain('no PowerNote.html asset');
  });
});
