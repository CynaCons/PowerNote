/**
 * Test 183: app updates carry extension blocks into the fresh template
 * Covers: REQ-UPDATE-031
 *
 * Pure deps-injection unit in the page (the T88/T131 harness): performUpdate
 * gets a stub template, a fake writable handle, and a collectExtensions dep.
 * The written HTML must contain the block; with no extensions the output must
 * be byte-identical to the two-argument buildUpdatedHtml — the pre-v0.65
 * contract T88 pins.
 */
import { test, expect } from '@playwright/test';
import { waitForCanvasReady } from '../helpers';

const TEMPLATE = [
  '<!DOCTYPE html>',
  '<html><head><script id="powernote-data" type="application/json">{}</script></head>',
  '<body><div id="root"></div></body></html>',
].join('\n');

test.describe('183 - update carries extensions (REQ-UPDATE-031)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForCanvasReady(page);
  });

  test('the written notebook contains the block; none installed → byte-identical legacy output', async ({
    page,
  }) => {
    const result = await page.evaluate(async (template) => {
      const mod = await import('/src/utils/updateChecker.ts');
      const ws = (window as any).__POWERNOTE_STORES__.workspace.getState().workspace;
      const ext = { scriptId: 'powernote-ext-drawio', base64: 'QUJDREVG', version: '9.9.9-test' };

      const runOnce = async (collect: () => Promise<unknown[]>) => {
        const writes: string[] = [];
        const out = await mod.performUpdate('https://example.com/asset', ws, '0.0.1', '9.9.9', {
          fetchTemplate: async () => template,
          getHandle: async () => ({ name: 'x.html' }) as any,
          verifyWritePermission: async () => true,
          writeHandle: async (_h: unknown, html: string) => {
            writes.push(html);
            return true;
          },
          reload: () => {},
          download: () => {},
          isLiveUpdateEnabled: () => true,
          downloadBackupBeforeLiveSwap: false,
          collectExtensions: collect as any,
        });
        return { out, written: writes[0] ?? '' };
      };

      const withExt = await runOnce(async () => [ext]);
      const withoutExt = await runOnce(async () => []);
      const legacy = mod.buildUpdatedHtml(template, ws);

      return {
        okWith: withExt.out.ok,
        blockCount: withExt.written.split('id="powernote-ext-drawio"').length - 1,
        hasVersion: withExt.written.includes('data-version="9.9.9-test"'),
        hasPayload: withExt.written.includes('QUJDREVG'),
        matchesInjected: withExt.written === mod.buildUpdatedHtml(template, ws, [ext]),
        okWithout: withoutExt.out.ok,
        withoutIsLegacy: withoutExt.written === legacy,
        withoutHasBlock: withoutExt.written.includes('powernote-ext-drawio'),
      };
    }, TEMPLATE);

    expect(result.okWith).toBe(true);
    expect(result.blockCount).toBe(1);
    expect(result.hasVersion).toBe(true);
    expect(result.hasPayload).toBe(true);
    expect(result.matchesInjected).toBe(true);

    expect(result.okWithout).toBe(true);
    expect(result.withoutIsLegacy).toBe(true);
    expect(result.withoutHasBlock).toBe(false);
  });
});
