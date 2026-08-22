/**
 * Test 187: PowerScroll rename and release compatibility
 * Covers: REQ-FILE-024/025, REQ-UPDATE-034/035
 */
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const TEMPLATE = path.resolve('dist-template/index.html');

test.describe('187 - PowerScroll brand and PowerNote compatibility', () => {
  test('the standalone build uses the PowerScroll brand and keeps the legacy data contract', () => {
    const html = fs.readFileSync(TEMPLATE, 'utf8');
    expect(html).toContain('<title>PowerScroll');
    expect(html).toContain('powernote-data');
    expect(html).toContain('PowerScroll v');
    expect(html).not.toContain('PowerNote v0.67.0');
  });

  test('the updater targets the renamed repository and prefers the new artifact', async ({ page }) => {
    await page.route('https://api.github.com/repos/CynaCons/PowerScroll/releases/latest', (route) =>
      route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          tag_name: 'v9.9.9',
          html_url: 'https://github.com/CynaCons/PowerScroll/releases/tag/v9.9.9',
          assets: [
            { name: 'PowerNote.html', browser_download_url: 'https://example.test/legacy' },
            { name: 'PowerScroll.html', browser_download_url: 'https://example.test/current' },
          ],
        }),
      }),
    );
    await page.goto('/');
    const info = await page.evaluate(async () => {
      const update = await import('/src/utils/updateChecker.ts');
      return {
        repo: update.GITHUB_REPO,
        names: update.RELEASE_ASSET_NAMES,
        info: await update.checkForUpdate('0.1.0', { force: true }),
      };
    });
    expect(info.repo).toBe('CynaCons/PowerScroll');
    expect(info.names).toEqual(['PowerScroll.html', 'PowerNote.html']);
    expect(info.info?.downloadUrl).toBe('https://example.test/current');
  });

  test('the updater accepts the transitional PowerNote artifact alias', async ({ page }) => {
    await page.route('https://api.github.com/repos/CynaCons/PowerScroll/releases/latest', (route) =>
      route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          tag_name: 'v9.9.9',
          html_url: 'https://github.com/CynaCons/PowerScroll/releases/tag/v9.9.9',
          assets: [
            { name: 'PowerNote.html', browser_download_url: 'https://example.test/legacy-only' },
          ],
        }),
      }),
    );
    await page.goto('/');
    const info = await page.evaluate(async () => {
      const update = await import('/src/utils/updateChecker.ts');
      return update.checkForUpdate('0.1.0', { force: true });
    });
    expect(info?.available).toBe(true);
    expect(info?.downloadUrl).toBe('https://example.test/legacy-only');
  });

  test('release and Pages workflows publish the compatibility and live-demo artifacts', () => {
    const release = fs.readFileSync('.github/workflows/release.yml', 'utf8');
    const pages = fs.readFileSync('.github/workflows/pages.yml', 'utf8');
    expect(release).toContain('PowerScroll.html');
    expect(release).toContain('PowerNote.html');
    expect(release).toContain('powerscroll-mcp.tgz');
    expect(pages).toContain('build-pages-demo.mjs');
    expect(pages).toContain('_site/app/index.html');
  });
});
