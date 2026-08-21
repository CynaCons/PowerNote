/**
 * Test 184: a standalone notebook with (and without) the embedded extension
 * boots and displays its snapshot, fully offline
 * Covers: REQ-DIAG-149, REQ-SETTINGS-019
 *
 * End-to-end: author a snapshot diagram in dev (real viewer), export via
 * buildExportHtml — rendering held the asset, so the export embeds the block
 * automatically — then boot the exported file with every request beyond the
 * file itself aborted. The block-stripped variant proves display never needed
 * the extension: the snapshot travels in powernote-data.
 */
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { runBridge, waitForBridgeReady, waitForCanvasReady } from '../helpers';

const SOURCE = `<mxfile><diagram name="p1"><mxGraphModel><root>
<mxCell id="0"/><mxCell id="1" parent="0"/>
<mxCell id="a" value="Standalone" style="rounded=1;fillColor=#dae8fc;gradientColor=#7ea6e0;" vertex="1" parent="1"><mxGeometry x="0" y="0" width="160" height="60" as="geometry"/></mxCell>
</root></mxGraphModel></diagram></mxfile>`;

const BLOCK_RE = /<script id="powernote-ext-drawio"[^>]*>[\s\S]*?<\/script>\n?/;

async function bootStandalone(
  browser: import('@playwright/test').Browser,
  html: string,
): Promise<{ syntaxErrors: string[]; hasRender: boolean; hasBlock: boolean }> {
  const page = await browser.newPage();
  const syntaxErrors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error' && /SyntaxError/.test(m.text())) syntaxErrors.push(m.text());
  });
  page.on('pageerror', (e) => syntaxErrors.push('pageerror: ' + e.message));

  const url = 'http://127.0.0.1:9877/standalone-under-test.html';
  await page.route('**/*', (route) => {
    if (route.request().url() === url) {
      void route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html });
    } else {
      void route.abort();
    }
  });
  await page.goto(url);
  await page.waitForSelector('[data-testid="canvas-container"]', { timeout: 20_000 });
  await page.waitForFunction(() => (window as any).__POWERNOTE_STORES__);
  await page.waitForTimeout(800);

  const state = await page.evaluate(() => {
    const nodes = (window as any).__POWERNOTE_STORES__.workspace
      .getState()
      .workspace.sections.flatMap((s: any) => s.pages)
      .flatMap((p: any) => p.nodes);
    const frame = nodes.find((n: any) => n.type === 'diagram');
    return {
      hasRender: Boolean(frame?.data?.render?.src?.startsWith('data:image/')),
      hasBlock: Boolean(document.getElementById('powernote-ext-drawio')),
    };
  });
  await page.close();
  return { syntaxErrors, ...state };
}

test.describe('184 - standalone boot with embedded extension (REQ-SETTINGS-019)', () => {
  test('exported notebook renders offline, with and without the block', async ({ page, browser }) => {
    test.skip(!fs.existsSync('dist-template/index.html'), 'dist-template not built');

    await page.goto('/');
    await waitForCanvasReady(page);
    await waitForBridgeReady(page);

    const drawn = await runBridge(page, 'create_diagram', {
      source: SOURCE,
      title: 'Standalone',
      format: 'drawio',
    });
    expect(drawn.renderMode).toBe('snapshot');

    // The render held the asset → the export embeds the block by itself.
    const html: string = await page.evaluate(async () => {
      const { buildExportHtml } = await import('/src/utils/serialization.ts');
      const wsStore = (window as any).__POWERNOTE_STORES__.workspace.getState();
      wsStore.savePageNodes((window as any).__POWERNOTE_STORES__.canvas.getState().nodes);
      return buildExportHtml((window as any).__POWERNOTE_STORES__.workspace.getState().workspace);
    });
    expect(html.split('id="powernote-ext-drawio"').length - 1).toBe(1);
    expect(html).toContain('id="powernote-data"');

    const withBlock = await bootStandalone(browser, html);
    expect(withBlock.syntaxErrors).toEqual([]);
    expect(withBlock.hasRender).toBe(true);
    expect(withBlock.hasBlock).toBe(true);

    // Strip the block: a notebook saved without the extension still DISPLAYS
    // the snapshot — the extension is only needed to build/redraw.
    const stripped = html.replace(BLOCK_RE, '');
    expect(stripped).not.toMatch(/<script\b[^>]*\bid=["']powernote-ext-drawio["']/i);
    const withoutBlock = await bootStandalone(browser, stripped);
    expect(withoutBlock.syntaxErrors).toEqual([]);
    expect(withoutBlock.hasRender).toBe(true);
    expect(withoutBlock.hasBlock).toBe(false);
  });
});
