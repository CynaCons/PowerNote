/**
 * Test 87: Updated HTML parse / hydrate (REQ-UPDATE-004)
 *
 * buildUpdatedHtml injects workspace into dist-template; serving that HTML
 * boots the app with content intact.
 */
import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import * as http from 'http';
import { fileURLToPath } from 'url';
import { buildUpdatedHtml } from '../../src/utils/updateChecker';
import type { WorkspaceData } from '../../src/types/data';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function serveHtml(html: string): Promise<{ server: http.Server; port: number }> {
  return new Promise((resolve) => {
    const server = http.createServer((_req, res) => {
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
      });
      res.end(html);
    });
    server.listen(0, () => {
      const addr = server.address() as { port: number };
      resolve({ server, port: addr.port });
    });
  });
}

test.describe('87 - Updated HTML hydrate (REQ-UPDATE-004)', () => {
  test('buildUpdatedHtml + template boots with injected workspace', async ({ browser }) => {
    test.setTimeout(30000);

    const templatePath = path.resolve(__dirname, '../../dist-template/index.html');
    if (!fs.existsSync(templatePath)) {
      test.skip();
      return;
    }

    const template = fs.readFileSync(templatePath, 'utf-8');
    const workspace: WorkspaceData = {
      version: '0.2.0',
      filename: 'Live Swap Test',
      editorVersion: '0.24.1',
      saveRevision: 3,
      settings: { backgroundMode: 'grid', bgColor: 'paper' },
      sections: [{
        id: 'sec-1',
        title: 'Update Section',
        pages: [{
          id: 'page-1',
          title: 'Update Page',
          nodes: [{
            id: 'node-1',
            type: 'text',
            x: 100,
            y: 100,
            width: 220,
            height: 30,
            layer: 4,
            data: {
              text: 'Survives live-swap hydrate',
              fontSize: 16,
              fontFamily: 'Inter',
              fontStyle: 'normal',
              fill: '#1a1a1a',
            },
          }],
          strokes: [],
        }],
      }],
    };

    const html = buildUpdatedHtml(template, workspace);
    expect(html).toContain('Survives live-swap hydrate');
    expect(html).toContain('"backgroundMode": "grid"');

    const { server, port } = await serveHtml(html);
    const page = await browser.newPage();
    try {
      await page.goto(`http://127.0.0.1:${port}/`);
      await page.locator('[data-testid="canvas-container"] canvas').first().waitFor({
        state: 'visible',
        timeout: 15000,
      });
      await page.waitForFunction(() => (window as any).__POWERNOTE_STORES__, { timeout: 10000 });

      const state = await page.evaluate(() => {
        const stores = (window as any).__POWERNOTE_STORES__;
        const ws = stores.workspace.getState().workspace;
        const nodes = stores.canvas.getState().nodes;
        return {
          filename: ws.filename,
          settings: ws.settings,
          text: nodes[0]?.data?.text,
          nodeCount: nodes.length,
        };
      });

      expect(state.filename).toBe('Live Swap Test');
      expect(state.nodeCount).toBe(1);
      expect(state.text).toBe('Survives live-swap hydrate');
      expect(state.settings?.backgroundMode).toBe('grid');
      expect(state.settings?.bgColor).toBe('paper');

      await page.locator('[data-testid="nav-settings"]').click();
      await expect(page.locator('[data-testid="settings-panel"]')).toBeVisible();
      await expect(page.locator('[data-testid="settings-app-version"]')).toContainText('PowerNote v');
    } finally {
      await page.close();
      server.close();
    }
  });
});
