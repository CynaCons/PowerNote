/**
 * Test 154: The update embeds what is on the canvas NOW (REQ-UPDATE-030)
 *
 * Found by the v0.37.5 → v0.52.3 end-to-end update test: the Settings
 * panel's update handler snapshotted the workspace store, called
 * savePageNodes/savePageStrokes — which produce a NEW immutable state —
 * and then embedded the snapshot's `.workspace`, i.e. the PRE-save
 * workspace. Canvas edits made since the last explicit save were silently
 * missing from the updated notebook (the test's output page had zero
 * nodes). Every prior update test injected a workspace into performUpdate
 * directly, which is exactly why the component-level bug survived them.
 *
 * This test therefore goes through the REAL UI: unsaved node on the
 * canvas → Check for updates → Update → the downloaded file must contain
 * that node.
 */
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { waitForCanvasReady, disableFSA } from '../helpers';

const TEMPLATE =
  '<!doctype html><html><head><meta charset="utf-8"></head>' +
  '<body><div id="root"></div>' +
  '<script id="powernote-data" type="application/json">null</script>' +
  '</body></html>';

test.describe('154 - Update embeds unsaved canvas edits (REQ-UPDATE-030)', () => {
  test('a node added after load survives into the downloaded update', async ({ page }) => {
    await disableFSA(page);

    // The update check and the template download never leave the test.
    await page.route('https://api.github.com/repos/**/releases/latest', (route) =>
      route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          tag_name: 'v9.9.9',
          assets: [
            {
              id: 1,
              name: 'PowerNote.html',
              browser_download_url: 'https://example.com/PowerNote.html',
            },
          ],
          html_url: 'https://github.com/example/releases/tag/v9.9.9',
        }),
      }),
    );
    await page.route('https://raw.githubusercontent.com/**', (route) =>
      route.fulfill({ contentType: 'text/html', body: TEMPLATE }),
    );
    await page.route('https://example.com/**', (route) =>
      route.fulfill({ contentType: 'text/html', body: TEMPLATE }),
    );

    await page.goto('/');
    await waitForCanvasReady(page);

    // The unsaved edit: straight into the canvas store, no save of any kind.
    await page.evaluate(() => {
      (window as any).__POWERNOTE_STORES__.canvas.getState().addNode({
        id: 'unsaved-marker',
        type: 'text',
        x: 60, y: 60, width: 280, height: 30, layer: 3,
        data: {
          text: 'UNSAVED-CANVAS-MARKER',
          fontSize: 16, fontFamily: 'Inter', fontStyle: 'normal', fill: '#1a1a1a',
        },
      });
    });

    await page.locator('[data-testid="nav-settings"]').click();
    await page.locator('[data-testid="check-update-btn"]').click();
    await page.locator('[data-testid="update-btn"]').waitFor();

    const downloadPromise = page.waitForEvent('download');
    await page.locator('[data-testid="update-btn"]').click();
    const download = await downloadPromise;
    const filePath = await download.path();
    const updated = fs.readFileSync(filePath!, 'utf8');

    expect(updated).toContain('UNSAVED-CANVAS-MARKER');
  });
});
