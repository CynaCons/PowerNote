/**
 * Test 102: Agent-controlled canvas look
 * Covers: REQ-SETTINGS-006, REQ-AGENT-039, REQ-AGENT-040
 *
 * An agent can read and change the guide style and background colour. The
 * colour is addressed by NAME rather than by the hex actually stored, so these
 * tests pin both the name mapping and that a stored hex is still accepted —
 * an agent that has read the notebook file will have seen the hex.
 */
import { test, expect } from '@playwright/test';
import {
  waitForCanvasReady,
  waitForBridgeReady,
  runBridge,
  runBridgeExpectingError,
  stubBridgeUrl,
  getWorkspaceStore,
} from '../helpers';

const settingsOf = async (page: import('@playwright/test').Page) =>
  (await getWorkspaceStore(page)).workspace.settings;

test.describe('102 - Agent background control (REQ-SETTINGS-006)', () => {
  test('set_background stays notebook-scoped unless a page scope is asked for', async ({ page }) => {
    // The default is load-bearing, not incidental: this tool shipped meaning
    // notebook-wide, and every agent already written against it assumes that.
    const result = await runBridge(page, 'set_background', { guideStyle: 'grid' });
    expect(result.scope).toBe('notebook');
    expect((await settingsOf(page))?.backgroundMode).toBe('grid');

    const pages = (await getWorkspaceStore(page)).workspace.sections[0].pages;
    expect(pages[0].settings).toBeUndefined();
  });

  test('scope "page" overrides one page and leaves the default alone', async ({ page }) => {
    await runBridge(page, 'set_background', { guideStyle: 'grid' });
    const result = await runBridge(page, 'set_background', {
      guideStyle: 'scroll',
      scope: 'page',
    });

    expect(result.scope).toBe('page');
    expect(result.guideStyle).toBe('scroll');
    expect(result.source.guideStyle).toBe('page');
    // The colour was never overridden, so it still reports as inherited.
    expect(result.source.color).toBe('notebook');
    expect(result.notebookDefault.guideStyle).toBe('grid');

    const ws = await getWorkspaceStore(page);
    expect(ws.workspace.settings?.backgroundMode).toBe('grid');
    expect(ws.workspace.sections[0].pages[0].settings?.backgroundMode).toBe('scroll');
  });

  test('get_background answers for the page, not the raw notebook default', async ({ page }) => {
    await runBridge(page, 'set_background', { guideStyle: 'grid' });
    await runBridge(page, 'set_background', { guideStyle: 'scroll', scope: 'page' });

    const bg = await runBridge(page, 'get_background');
    // What is actually on screen — an agent restoring "the previous look" from
    // the notebook default would otherwise put back something never displayed.
    expect(bg.guideStyle).toBe('scroll');
    expect(bg.source.guideStyle).toBe('page');
    expect(bg.notebookDefault.guideStyle).toBe('grid');
  });

  test('an unknown scope is refused by name', async ({ page }) => {
    const err = await runBridgeExpectingError(page, 'set_background', {
      guideStyle: 'grid',
      scope: 'section',
    });
    expect(err.code).toBe('BAD_PARAMS');
    expect(err.message).toContain('notebook');
  });

  test.beforeEach(async ({ page }) => {
    await stubBridgeUrl(page);
    await page.goto('/');
    await waitForCanvasReady(page);
    await waitForBridgeReady(page);
  });

  test('get_background reports the current look by name', async ({ page }) => {
    const bg = await runBridge(page, 'get_background');
    expect(bg.guideStyle).toBe('pages');
    // Named, not "#ffffff" — the app has four presets, so a name cannot be
    // mistyped into something that silently does nothing.
    expect(bg.color).toBe('white');
  });

  test('set_background switches the guide style and marks the notebook dirty', async ({ page }) => {
    const result = await runBridge(page, 'set_background', { guideStyle: 'scroll' });

    expect(result.guideStyle).toBe('scroll');
    expect(result.previous.guideStyle).toBe('pages');
    expect((await settingsOf(page))?.backgroundMode).toBe('scroll');

    // Dirty is what feeds the auto-save pipeline — without it the change would
    // live only in memory and be lost on close. Read straight from the store:
    // the shared helper only surfaces workspace + active ids.
    const isDirty = await page.evaluate(
      () => (window as any).__POWERNOTE_STORES__.workspace.getState().isDirty,
    );
    expect(isDirty).toBe(true);
  });

  test('set_background changes the colour, and the canvas re-renders in it', async ({ page }) => {
    await runBridge(page, 'set_background', { color: 'paper' });

    expect((await settingsOf(page))?.bgColor).toBe('paper');
    await expect(page.locator('[data-testid="canvas-container"]')).toHaveClass(
      /infinite-canvas--paper/,
    );
  });

  test('both fields can be set in one call', async ({ page }) => {
    const result = await runBridge(page, 'set_background', {
      guideStyle: 'grid',
      color: 'gray',
    });

    expect(result).toMatchObject({ guideStyle: 'grid', color: 'gray' });
    const settings = await settingsOf(page);
    expect(settings?.backgroundMode).toBe('grid');
    expect(settings?.bgColor).toBe('#e5e5e5');
  });

  test('a stored hex value is accepted and normalised back to its name', async ({ page }) => {
    const result = await runBridge(page, 'set_background', { color: '#f5f5f5' });

    expect(result.color).toBe('light-gray');
    expect((await settingsOf(page))?.bgColor).toBe('#f5f5f5');
  });

  test('an unknown guide style is rejected and lists the valid ones', async ({ page }) => {
    const err = await runBridgeExpectingError(page, 'set_background', {
      guideStyle: 'continuous',
    });

    expect(err.code).toBe('BAD_PARAMS');
    expect(err.message).toContain('scroll');
    // Rejected means unchanged — never a partial apply.
    expect((await settingsOf(page))?.backgroundMode).toBe('pages');
  });

  test('an unknown colour is rejected and lists the valid ones', async ({ page }) => {
    const err = await runBridgeExpectingError(page, 'set_background', { color: 'chartreuse' });

    expect(err.code).toBe('BAD_PARAMS');
    expect(err.message).toContain('paper');
    expect((await settingsOf(page))?.bgColor).toBe('#ffffff');
  });

  test('a call that changes nothing is an error, not a silent no-op', async ({ page }) => {
    const err = await runBridgeExpectingError(page, 'set_background', {});

    expect(err.code).toBe('BAD_PARAMS');
    expect(err.message).toContain('guideStyle');
  });

  test('a rejected guide style leaves an already-valid colour untouched', async ({ page }) => {
    await runBridge(page, 'set_background', { color: 'paper' });

    await runBridgeExpectingError(page, 'set_background', {
      guideStyle: 'nope',
      color: 'white',
    });

    // Validation runs before any write, so the good half of a bad call must not
    // land on its own.
    expect((await settingsOf(page))?.bgColor).toBe('paper');
  });
});
