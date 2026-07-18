/**
 * Test 88: Live-swap path (REQ-UPDATE-002)
 *
 * When a writable FSA handle is available, performUpdate writes the updated
 * HTML to that handle and reloads — no updated-notebook download.
 */
import { test, expect } from '@playwright/test';
import { waitForCanvasReady } from '../helpers';

test.describe('88 - Live-swap write + reload (REQ-UPDATE-002)', () => {
  test('writes to handle and reloads; does not download updated notebook', async ({ page }) => {
    await page.goto('/');
    await waitForCanvasReady(page);

    const result = await page.evaluate(async () => {
      const { performUpdate, buildUpdatedHtml } = await import('/src/utils/updateChecker.ts');

      const workspace = {
        version: '0.2.0',
        filename: 'LiveSwap Notebook',
        editorVersion: '0.24.1',
        saveRevision: 1,
        sections: [{
          id: 's1',
          title: 'S',
          pages: [{
            id: 'p1',
            title: 'P',
            nodes: [{
              id: 'n1', type: 'text', x: 10, y: 10, width: 100, height: 20, layer: 3,
              data: { text: 'payload-marker-xyz', fontSize: 14, fontFamily: 'Inter', fontStyle: 'normal', fill: '#000' },
            }],
            strokes: [],
          }],
        }],
      };

      const fakeTemplate = `<!DOCTYPE html><html><head></head><body><div id="root"></div><script id="powernote-data" type="application/json">{}</script></body></html>`;
      const writes: string[] = [];
      const downloads: string[] = [];
      let reloadCount = 0;

      const fakeHandle = { name: 'live-swap.html' } as FileSystemFileHandle;

      const outcome = await performUpdate(
        'https://example.com/PowerNote.html',
        workspace as any,
        '0.24.1',
        '0.25.0',
        {
          fetchTemplate: async () => fakeTemplate,
          getHandle: async () => fakeHandle,
          verifyWritePermission: async () => true,
          writeHandle: async (_h, html) => {
            writes.push(html);
            return true;
          },
          reload: () => { reloadCount += 1; },
          download: (_content, filename) => { downloads.push(filename); },
          buildBackupHtml: async () => '<html>backup</html>',
          isLiveUpdateEnabled: () => true,
          downloadBackupBeforeLiveSwap: true,
        },
      );

      return {
        outcome,
        writes,
        downloads,
        reloadCount,
        writeHasPayload: writes[0]?.includes('payload-marker-xyz') ?? false,
        writeLooksUpdated: writes[0] ? buildUpdatedHtml(fakeTemplate, workspace as any) === writes[0] : false,
      };
    });

    expect(result.outcome).toEqual({ ok: true, mode: 'live-swap' });
    expect(result.reloadCount).toBe(1);
    expect(result.writes).toHaveLength(1);
    expect(result.writeHasPayload).toBe(true);
    expect(result.writeLooksUpdated).toBe(true);
    // Safety backup only — not the updated notebook download
    expect(result.downloads).toHaveLength(1);
    expect(result.downloads[0]).toContain('update-backup');
    expect(result.downloads.some((d) => d.includes('v0.25.0') && !d.includes('backup'))).toBe(false);
  });

  test('skips live-swap when __POWERNOTE_LIVE_UPDATE__ is false', async ({ page }) => {
    await page.addInitScript(() => {
      (window as any).__POWERNOTE_LIVE_UPDATE__ = false;
    });
    await page.goto('/');
    await waitForCanvasReady(page);

    const result = await page.evaluate(async () => {
      const { performUpdate } = await import('/src/utils/updateChecker.ts');
      const workspace = {
        version: '0.2.0',
        filename: 'Forced Fallback',
        sections: [{ id: 's1', title: 'S', pages: [{ id: 'p1', title: 'P', nodes: [], strokes: [] }] }],
      };
      const downloads: string[] = [];
      let reloadCount = 0;
      const outcome = await performUpdate(
        'https://example.com/PowerNote.html',
        workspace as any,
        '0.24.1',
        '0.25.0',
        {
          fetchTemplate: async () => '<html><head></head><body><div id="root"></div></body></html>',
          getHandle: async () => ({ name: 'x.html' } as FileSystemFileHandle),
          verifyWritePermission: async () => true,
          writeHandle: async () => true,
          reload: () => { reloadCount += 1; },
          download: (_c, name) => { downloads.push(name); },
          buildBackupHtml: async () => '<html>backup</html>',
          // Explicitly respect window flag via default isLiveUpdateEnabled
        },
      );
      return { outcome, downloads, reloadCount };
    });

    expect(result.outcome).toEqual({ ok: true, mode: 'download' });
    expect(result.reloadCount).toBe(0);
    expect(result.downloads.length).toBe(2);
  });
});
