/**
 * Test 103: An agent-set canvas look persists to disk
 * Covers: REQ-SETTINGS-006, REQ-AGENT-041
 *
 * The claim under test is that agent-set settings need no persistence path of
 * their own — `set_background` writes through `updateSettings`, which is the
 * same door the settings panel uses, so the existing save pipeline carries it.
 *
 * Coverage boundary: the save is triggered from the app, not via the agent's
 * `save_notebook`. That command deliberately refuses unless the notebook is
 * bound to a real file (see T100), and a test page has no FSA handle. What
 * matters here is the part that could actually break — whether an agent's write
 * reaches the serialized file at all — and that is fully exercised.
 */
import { test, expect } from '@playwright/test';
import {
  waitForCanvasReady,
  waitForBridgeReady,
  runBridge,
  stubBridgeUrl,
  getWorkspaceStore,
  disableFSA,
} from '../helpers';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test.describe('103 - Agent-set look persists (REQ-SETTINGS-006)', () => {
  test('set_background survives save → reopen', async ({ page }) => {
    await disableFSA(page);
    await stubBridgeUrl(page);
    await page.goto('/');
    await waitForCanvasReady(page);
    await waitForBridgeReady(page);

    await runBridge(page, 'set_background', { guideStyle: 'scroll', color: 'paper' });

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.locator('[data-testid="save-btn"]').click(),
    ]);
    const tmpPath = path.join(__dirname, '..', '..', 'test-results', 'agent-background.html');
    fs.mkdirSync(path.dirname(tmpPath), { recursive: true });
    await download.saveAs(tmpPath);

    const html = fs.readFileSync(tmpPath, 'utf-8');
    expect(html).toContain('"backgroundMode": "scroll"');
    expect(html).toContain('"bgColor": "paper"');

    await page.goto('/');
    await waitForCanvasReady(page);
    await page.locator('[data-testid="file-input"]').setInputFiles(tmpPath);

    await expect
      .poll(
        async () => (await getWorkspaceStore(page)).workspace.settings?.backgroundMode,
        { timeout: 5000 },
      )
      .toBe('scroll');

    const ws = await getWorkspaceStore(page);
    expect(ws.workspace.settings?.bgColor).toBe('paper');
    await expect(page.locator('[data-testid="canvas-container"]')).toHaveClass(
      /infinite-canvas--paper/,
    );
  });

  test('save_notebook still refuses when nothing is bound, after a look change', async ({
    page,
  }) => {
    await disableFSA(page);
    await stubBridgeUrl(page);
    await page.goto('/');
    await waitForCanvasReady(page);
    await waitForBridgeReady(page);

    await runBridge(page, 'set_background', { guideStyle: 'scroll' });

    // Changing settings must not accidentally look like a bound file — the
    // agent has to be told its change is in memory only.
    const err = await page.evaluate(async () => {
      try {
        await (window as any).__POWERNOTE_BRIDGE__.runBridgeCommand('save_notebook', {});
      } catch (e: any) {
        return { code: e.code, message: String(e.message) };
      }
      return null;
    });

    expect(err?.code).toBe('PRECONDITION');
    expect(err?.message).toContain('not bound to a file');
  });
});
