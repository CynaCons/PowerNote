/**
 * Test 89: Update download fallback (REQ-UPDATE-003)
 *
 * When no FSA handle is available, performUpdate downloads ONLY the updated
 * notebook. Nothing is overwritten on this path, so the file on disk is already
 * the backup -- and emitting a second download got it blocked by the browser,
 * which is what made updating look like it did nothing.
 * Previously it also downloaded a backup and
 * an updated notebook (no reload).
 */
import { test, expect } from '@playwright/test';
import { waitForCanvasReady, disableFSA } from '../helpers';

test.describe('89 - Update download fallback (REQ-UPDATE-003)', () => {
  test('downloads only the updated file when no handle', async ({ page }) => {
    await disableFSA(page);
    await page.goto('/');
    await waitForCanvasReady(page);

    const result = await page.evaluate(async () => {
      const { performUpdate } = await import('/src/utils/updateChecker.ts');
      const workspace = {
        version: '0.2.0',
        filename: 'Fallback Notebook',
        editorVersion: '0.24.1',
        sections: [{
          id: 's1',
          title: 'S',
          pages: [{
            id: 'p1',
            title: 'P',
            nodes: [{
              id: 'n1', type: 'text', x: 0, y: 0, width: 80, height: 20, layer: 3,
              data: { text: 'fallback-data', fontSize: 14, fontFamily: 'Inter', fontStyle: 'normal', fill: '#111' },
            }],
            strokes: [],
          }],
        }],
      };

      const downloads: { name: string; hasData: boolean }[] = [];
      let reloadCount = 0;
      let writeCalls = 0;

      const outcome = await performUpdate(
        'https://example.com/PowerNote.html',
        workspace as any,
        '0.24.1',
        '0.25.0',
        {
          fetchTemplate: async () =>
            '<html><head></head><body><div id="root"></div></body></html>',
          getHandle: async () => null,
          writeHandle: async () => {
            writeCalls += 1;
            return true;
          },
          reload: () => { reloadCount += 1; },
          download: (content, name) => {
            downloads.push({ name, hasData: content.includes('fallback-data') || content.includes('backup') || content.length > 0 });
          },
          buildBackupHtml: async () => '<html>backup-content</html>',
          isLiveUpdateEnabled: () => true,
        },
      );

      return { outcome, downloads, reloadCount, writeCalls };
    });

    expect(result.outcome).toEqual({ ok: true, mode: 'download' });
    expect(result.reloadCount).toBe(0);
    expect(result.writeCalls).toBe(0);
    // One file only: browsers block a second programmatic download from the
    // same gesture, and the untouched file on disk is the backup.
    expect(result.downloads).toHaveLength(1);
    expect(result.downloads[0].name).toContain('v0.25.0');
    expect(result.downloads[0].name).not.toContain('backup');
  });

  test('falls back when write permission denied', async ({ page }) => {
    await page.goto('/');
    await waitForCanvasReady(page);

    const result = await page.evaluate(async () => {
      const { performUpdate } = await import('/src/utils/updateChecker.ts');
      const workspace = {
        version: '0.2.0',
        filename: 'No Perms',
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
          fetchTemplate: async () =>
            '<html><head></head><body><div id="root"></div></body></html>',
          getHandle: async () => ({ name: 'denied.html' } as FileSystemFileHandle),
          verifyWritePermission: async () => false,
          writeHandle: async () => true,
          reload: () => { reloadCount += 1; },
          download: (_c, name) => { downloads.push(name); },
          buildBackupHtml: async () => '<html>b</html>',
          isLiveUpdateEnabled: () => true,
        },
      );

      return { outcome, downloads, reloadCount };
    });

    expect(result.outcome).toEqual({ ok: true, mode: 'download' });
    expect(result.reloadCount).toBe(0);
    expect(result.downloads).toHaveLength(1);
  });
});
