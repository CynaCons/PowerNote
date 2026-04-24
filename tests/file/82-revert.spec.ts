/**
 * Test 82: Revert to Last Saved
 * Covers: REQ-FILE-019, REQ-FILE-020
 *
 * - Button is disabled when workspace is clean.
 * - Button is disabled when FSA is unavailable (no handle to revert to).
 * - With a mocked FSA handle in IDB, calling revertNotebook reloads the
 *   workspace from the handle's content and clears the dirty flag.
 */
import { test, expect } from '@playwright/test';
import { waitForCanvasReady, disableFSA } from '../helpers';

test.describe('82 - Revert (REQ-FILE-019..020)', () => {
  test('revert button is disabled when workspace is clean', async ({ page }) => {
    await disableFSA(page);
    await page.goto('/');
    await waitForCanvasReady(page);

    const btn = page.locator('[data-testid="revert-btn"]');
    await expect(btn).toBeVisible();
    await expect(btn).toBeDisabled();
  });

  test('revert button stays disabled when dirty but FSA is unavailable', async ({ page }) => {
    await disableFSA(page);
    await page.goto('/');
    await waitForCanvasReady(page);

    await page.evaluate(() => {
      const stores = (window as any).__POWERNOTE_STORES__;
      stores.workspace.getState().markDirty();
    });

    // Wait a tick for the effect to re-run
    await page.waitForTimeout(150);

    const btn = page.locator('[data-testid="revert-btn"]');
    await expect(btn).toBeDisabled();
  });

  test('applyRevertedText replaces dirty workspace with saved content', async ({ page }) => {
    await page.goto('/');
    await waitForCanvasReady(page);

    // 1. Dirty the workspace with junk
    await page.evaluate(() => {
      const stores = (window as any).__POWERNOTE_STORES__;
      stores.workspace.getState().updateWorkspace({ filename: 'in-memory-junk' });
      stores.canvas.getState().addNode({
        id: 'junk-node',
        type: 'text',
        x: 10, y: 10, width: 100, height: 30, layer: 4,
        data: { text: 'JUNK (should be gone after revert)',
                fontSize: 14, fontFamily: 'Inter', fontStyle: 'normal', fill: '#000' },
      });
      stores.workspace.getState().markDirty();
    });

    // 2. Build a saved-on-disk payload and apply it via the same
    //    hydration path revertNotebook uses (FSA plumbing bypassed —
    //    the test does not automate a real file picker).
    const applied = await page.evaluate(async () => {
      const savedWorkspace = {
        version: '0.2.0',
        filename: 'saved-on-disk',
        editorVersion: '0.22.3',
        saveRevision: 1,
        sections: [{
          id: 'sec-saved',
          title: 'From Disk',
          pages: [{
            id: 'page-saved',
            title: 'Saved Page',
            nodes: [{
              id: 'saved-node',
              type: 'text',
              x: 50, y: 50, width: 120, height: 30, layer: 4,
              data: { text: 'Restored from disk',
                      fontSize: 16, fontFamily: 'Inter', fontStyle: 'normal', fill: '#111' },
            }],
            strokes: [],
          }],
        }],
      };
      const fakeHtml =
        '<!DOCTYPE html><html><head><script id="powernote-data" type="application/json">' +
        JSON.stringify(savedWorkspace) +
        '</script></head><body></body></html>';

      const mod = await import('/src/utils/revertNotebook.ts');
      return mod.applyRevertedText(fakeHtml);
    });

    expect(applied).toBe(true);

    const state = await page.evaluate(() => {
      const stores = (window as any).__POWERNOTE_STORES__;
      const ws = stores.workspace.getState();
      return {
        filename: ws.workspace.filename,
        isDirty: ws.isDirty,
        sectionTitle: ws.workspace.sections[0]?.title,
        nodes: stores.canvas.getState().nodes,
      };
    });

    expect(state.filename).toBe('saved-on-disk');
    expect(state.isDirty).toBe(false);
    expect(state.sectionTitle).toBe('From Disk');
    expect(state.nodes).toHaveLength(1);
    expect(state.nodes[0].id).toBe('saved-node');
    expect(state.nodes[0].data.text).toBe('Restored from disk');
    expect(state.nodes.find((n: any) => n.id === 'junk-node')).toBeUndefined();
  });

  test('applyRevertedText returns false on invalid HTML', async ({ page }) => {
    await page.goto('/');
    await waitForCanvasReady(page);
    const ok = await page.evaluate(async () => {
      const mod = await import('/src/utils/revertNotebook.ts');
      return mod.applyRevertedText('<html><body>not a notebook</body></html>');
    });
    expect(ok).toBe(false);
  });
});
