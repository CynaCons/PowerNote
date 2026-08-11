/**
 * Test 109: Agent delete verbs
 * Covers: REQ-AGENT-042..046
 *
 * The bridge could create pages, sections, scrolls and blocks but remove none
 * of them — an agent asked to tidy up had no way to. These verbs close that,
 * with two rules: every one demands `confirm: true`, and every store-level
 * guard surfaces as PRECONDITION rather than a silent no-op, so an agent is
 * never told a deletion succeeded when nothing happened.
 */
import { test, expect } from '@playwright/test';
import {
  waitForCanvasReady,
  waitForBridgeReady,
  runBridge,
  runBridgeExpectingError,
  stubBridgeUrl,
} from '../helpers';

test.describe('109 - Agent deletes (REQ-AGENT-042..046)', () => {
  test.beforeEach(async ({ page }) => {
    await stubBridgeUrl(page);
    await page.goto('/');
    await waitForCanvasReady(page);
    await waitForBridgeReady(page);
  });

  // ── confirm gate ──────────────────────────────────────────

  test('every delete refuses without confirm', async ({ page }) => {
    const created = await runBridge(page, 'create_page', { title: 'Scratch' });
    const scroll = await runBridge(page, 'create_scroll', { title: 'Temp' });
    const block = await runBridge(page, 'append_block', { markdown: 'keep me' });

    for (const [cmd, params] of [
      ['delete_page', { pageId: created.pageId }],
      ['delete_section', { sectionId: created.sectionId }],
      ['delete_scroll', { scrollId: scroll.scrollId }],
      ['delete_block', { blockId: block.blockId }],
    ] as const) {
      const err = await runBridgeExpectingError(page, cmd, params);
      expect(err.code).toBe('BAD_PARAMS');
      expect(err.message).toContain('confirm:true');
    }

    // Nothing was removed by the rejected calls.
    const pages = await runBridge(page, 'list_pages');
    expect(pages.pages.some((p: any) => p.pageId === created.pageId)).toBe(true);
  });

  // ── delete_page ───────────────────────────────────────────

  test('delete_page removes the page', async ({ page }) => {
    const created = await runBridge(page, 'create_page', { title: 'Disposable' });

    const result = await runBridge(page, 'delete_page', {
      pageId: created.pageId,
      confirm: true,
    });
    expect(result).toMatchObject({ deleted: 'page', title: 'Disposable' });

    const pages = await runBridge(page, 'list_pages');
    expect(pages.pages.some((p: any) => p.pageId === created.pageId)).toBe(false);
  });

  test('delete_page refuses to empty a section', async ({ page }) => {
    // A fresh notebook is one section holding exactly one page.
    const err = await runBridgeExpectingError(page, 'delete_page', { confirm: true });

    expect(err.code).toBe('PRECONDITION');
    expect(err.message).toContain('only page');
  });

  test('deleting the open page leaves the canvas showing the new active page', async ({ page }) => {
    await runBridge(page, 'append_block', { markdown: 'first page content' });
    const created = await runBridge(page, 'create_page', { title: 'Second' });
    await runBridge(page, 'append_block', { markdown: 'second page content' });

    await runBridge(page, 'delete_page', { pageId: created.pageId, confirm: true });

    // The deleted page's blocks must not linger on the canvas — they would be
    // flushed onto whichever page became active.
    const nodes = await page.evaluate(
      () => (window as any).__POWERNOTE_STORES__.canvas.getState().nodes,
    );
    const texts = nodes.map((n: any) => n.data.text);
    expect(texts).not.toContain('second page content');
  });

  // ── delete_section ────────────────────────────────────────

  test('delete_section removes the section and its pages', async ({ page }) => {
    const section = await runBridge(page, 'create_section', { title: 'Temporary' });
    await runBridge(page, 'create_page', { title: 'Inside', sectionId: section.sectionId });

    const result = await runBridge(page, 'delete_section', {
      sectionId: section.sectionId,
      confirm: true,
    });
    expect(result).toMatchObject({ deleted: 'section', title: 'Temporary' });

    const pages = await runBridge(page, 'list_pages');
    expect(pages.pages.some((p: any) => p.sectionId === section.sectionId)).toBe(false);
  });

  test('delete_section refuses on the last section', async ({ page }) => {
    const pages = await runBridge(page, 'list_pages');
    const err = await runBridgeExpectingError(page, 'delete_section', {
      sectionId: pages.pages[0].sectionId,
      confirm: true,
    });

    expect(err.code).toBe('PRECONDITION');
    expect(err.message).toContain('only section');
  });

  // ── delete_scroll ─────────────────────────────────────────

  test('delete_scroll keeps blocks by default', async ({ page }) => {
    const scroll = await runBridge(page, 'create_scroll', { title: 'Sidebar notes' });
    await runBridge(page, 'append_block', { markdown: 'survives', scrollId: scroll.scrollId });

    const result = await runBridge(page, 'delete_scroll', {
      scrollId: scroll.scrollId,
      confirm: true,
    });
    expect(result).toMatchObject({ deleted: 'scroll', blocksRemoved: 0 });

    const content = await runBridge(page, 'read_page');
    expect(content.blocks.map((b: any) => b.markdown)).toContain('survives');
  });

  test('delete_scroll with withBlocks removes its content and reports how much', async ({
    page,
  }) => {
    const scroll = await runBridge(page, 'create_scroll', { title: 'Throwaway' });
    await runBridge(page, 'append_block', { markdown: 'gone one', scrollId: scroll.scrollId });
    await runBridge(page, 'append_block', { markdown: 'gone two', scrollId: scroll.scrollId });
    await runBridge(page, 'append_block', { markdown: 'stays' });

    const result = await runBridge(page, 'delete_scroll', {
      scrollId: scroll.scrollId,
      withBlocks: true,
      confirm: true,
    });
    expect(result.blocksRemoved).toBe(2);

    const content = await runBridge(page, 'read_page');
    const texts = content.blocks.map((b: any) => b.markdown);
    expect(texts).toContain('stays');
    expect(texts).not.toContain('gone one');
  });

  test('delete_scroll refuses on the page\'s only scroll', async ({ page }) => {
    const listed = await runBridge(page, 'list_scrolls');
    const err = await runBridgeExpectingError(page, 'delete_scroll', {
      scrollId: listed.scrolls[0].scrollId,
      confirm: true,
    });

    expect(err.code).toBe('PRECONDITION');
    expect(err.message).toContain('only scroll');
  });

  // ── delete_block ──────────────────────────────────────────

  test('delete_block removes one block and leaves the rest', async ({ page }) => {
    await runBridge(page, 'append_block', { markdown: 'alpha' });
    const target = await runBridge(page, 'append_block', { markdown: 'beta' });
    await runBridge(page, 'append_block', { markdown: 'gamma' });

    await runBridge(page, 'delete_block', { blockId: target.blockId, confirm: true });

    const content = await runBridge(page, 'read_page');
    const texts = content.blocks.map((b: any) => b.markdown);
    expect(texts).toEqual(['alpha', 'gamma']);
  });

  test('an unknown id is NOT_FOUND, not a silent success', async ({ page }) => {
    const err = await runBridgeExpectingError(page, 'delete_block', {
      blockId: 'no-such-block',
      confirm: true,
    });
    expect(err.code).toBe('NOT_FOUND');
  });
});
