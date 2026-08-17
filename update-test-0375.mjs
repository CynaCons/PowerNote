/**
 * End-to-end update test: the REAL v0.37.5 release artifact updates itself to
 * the just-published release via the production update path (GitHub API +
 * committed build at the tag). FSA is disabled so the deterministic download
 * path runs. Deleted after the run.
 */
import { chromium } from '@playwright/test';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const DIR =
  'C:/Users/cynak/AppData/Local/Temp/claude/C--dev-private-repo-PowerNote/0cc97665-ca46-465a-b1c3-a5e7a5483d2b/scratchpad/update-test';
const PORT = 5399;

const server = http
  .createServer((req, res) => {
    const file = path.join(DIR, req.url === '/' ? 'PowerNote.html' : req.url);
    try {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.end(fs.readFileSync(file));
    } catch {
      res.statusCode = 404;
      res.end('nope');
    }
  })
  .listen(PORT);

const browser = await chromium.launch();
const ctx = await browser.newContext({ acceptDownloads: true });
await ctx.addInitScript(() => {
  // disableFSA — force the download-based update path
  try {
    delete window.showSaveFilePicker;
    delete window.showOpenFilePicker;
    delete window.showDirectoryPicker;
  } catch {
    window.showSaveFilePicker = undefined;
  }
});
const page = await ctx.newPage();
page.on('console', (m) => {
  if (m.text().includes('[PowerNote Update]')) console.log('APP:', m.text());
});

await page.goto(`http://localhost:${PORT}/PowerNote.html`);
await page.locator('[data-testid="canvas-container"] canvas').first().waitFor({ timeout: 20000 });
await page.waitForTimeout(500);

// Marker content that must survive the update
await page.evaluate(() => {
  window.__POWERNOTE_STORES__.canvas.getState().addNode({
    id: 'update-marker',
    type: 'text',
    x: 100, y: 100, width: 300, height: 40, layer: 3,
    data: { text: 'UPDATE-TEST-MARKER-0375', fontSize: 16, fontFamily: 'Inter', fontStyle: 'normal', fill: '#1a1a1a' },
  });
});

// Old version on its face
await page.locator('[data-testid="nav-settings"]').click();
const versionLabel = await page.locator('[data-testid="settings-app-version"]').innerText();
console.log('OLD VERSION LABEL:', versionLabel);

// Check for updates against the real GitHub API
await page.locator('[data-testid="check-update-btn"]').click();
await page.locator('[data-testid="update-btn"]').waitFor({ timeout: 30000 });
const available = await page.locator('[data-testid="update-btn"]').locator('xpath=preceding-sibling::span[1]').innerText().catch(() => '(label not read)');
console.log('AVAILABLE:', available);

// Run the update; capture the downloaded notebook
const downloadPromise = page.waitForEvent('download', { timeout: 60000 });
await page.locator('[data-testid="update-btn"]').click();
const download = await downloadPromise;
const outPath = path.join(DIR, 'updated.html');
await download.saveAs(outPath);
console.log('DOWNLOADED:', download.suggestedFilename());

const updated = fs.readFileSync(outPath, 'utf8');
const report = {
  size: updated.length,
  hasNewVersion: /0\.52\.2/.test(updated),
  hasOldVersion: /APP_VERSION\s*=\s*["']0\.37\.5["']/.test(updated),
  markerSurvived: updated.includes('UPDATE-TEST-MARKER-0375'),
};
console.log('REPORT:', JSON.stringify(report));

await browser.close();
server.close();
if (!report.hasNewVersion || !report.markerSurvived) {
  console.error('UPDATE TEST FAILED');
  process.exit(1);
}
console.log('UPDATE TEST PASSED');
