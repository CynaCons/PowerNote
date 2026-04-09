/**
 * Test 70: Standalone HTML opens and renders correctly
 *
 * Builds the standalone template, injects test data, opens it in
 * a browser via a local server, and verifies the app boots with data.
 */
import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import * as http from 'http';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Serve a single HTML file on a random port with proper MIME types
function serveHtml(html: string): Promise<{ server: http.Server; port: number }> {
  return new Promise((resolve) => {
    const server = http.createServer((_req, res) => {
      // Proper headers for module scripts to work
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
      });
      res.end(html);
    });
    server.listen(0, () => {
      const addr = server.address() as any;
      resolve({ server, port: addr.port });
    });
  });
}

test.describe('70 - Standalone HTML Opens Correctly', () => {
  test('template with injected data boots and shows content', async ({ browser }) => {
    test.setTimeout(30000);

    // Read the built template
    const templatePath = path.resolve(__dirname, '../../dist-template/index.html');
    if (!fs.existsSync(templatePath)) {
      test.skip();
      return;
    }
    let html = fs.readFileSync(templatePath, 'utf-8');

    // Inject test data
    const testData = {
      version: '0.2.0',
      filename: 'Standalone Test',
      editorVersion: '0.18.3',
      saveRevision: 1,
      sections: [{
        id: 'sec-1',
        title: 'Test Section',
        pages: [{
          id: 'page-1',
          title: 'Test Page',
          nodes: [{
            id: 'node-1', type: 'text', x: 100, y: 100, width: 200, height: 30, layer: 4,
            data: { text: 'Standalone test content', fontSize: 16,
                    fontFamily: 'Inter', fontStyle: 'normal', fill: '#1a1a1a' },
          }],
          strokes: [],
        }],
      }],
    };

    const dataScript = `<script id="powernote-data" type="application/json">\n${JSON.stringify(testData, null, 2)}\n</script>`;

    // Insert data before </head>
    const headClose = html.indexOf('</head>');
    console.log(`[Test 70] Template size: ${html.length}, </head> at: ${headClose}`);
    if (headClose >= 0) {
      html = html.substring(0, headClose) + dataScript + '\n' + html.substring(headClose);
    }
    console.log(`[Test 70] After injection: ${html.length} bytes`);

    // Serve the HTML
    const { server, port } = await serveHtml(html);

    try {
      const page = await browser.newPage();
      const consoleErrors: string[] = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
      });
      page.on('pageerror', (err) => consoleErrors.push(err.message));

      await page.goto(`http://localhost:${port}`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(3000);

      // Log ALL errors for diagnosis
      if (consoleErrors.length > 0) {
        console.log('[Test 70] Console errors:', consoleErrors);
      }

      // Check for syntax errors
      const syntaxErrors = consoleErrors.filter((e) =>
        e.includes('SyntaxError') || e.includes('regular expression')
      );

      // If there are syntax errors, the template is broken — fail with details
      if (syntaxErrors.length > 0) {
        console.error('[Test 70] SYNTAX ERRORS IN STANDALONE HTML:', syntaxErrors);
      }
      expect(syntaxErrors).toEqual([]);

      // Check the app rendered
      const root = page.locator('#root');
      await expect(root).not.toBeEmpty();

      // Check canvas is visible
      const canvas = page.locator('[data-testid="canvas-container"]');
      await expect(canvas).toBeVisible({ timeout: 10000 });

      // Check data was loaded
      const ws = await page.evaluate(() => {
        const stores = (window as any).__POWERNOTE_STORES__;
        if (!stores) return null;
        return stores.workspace.getState().workspace;
      });
      expect(ws).not.toBeNull();
      expect(ws.filename).toBe('Standalone Test');
      expect(ws.sections[0].title).toBe('Test Section');

      // Check nodes loaded
      const nodes = await page.evaluate(() => {
        const stores = (window as any).__POWERNOTE_STORES__;
        if (!stores) return null;
        return stores.canvas.getState().nodes;
      });
      expect(nodes).not.toBeNull();
      expect(nodes.length).toBeGreaterThanOrEqual(1);
      expect(nodes[0].data.text).toBe('Standalone test content');

      await page.close();
    } finally {
      server.close();
    }
  });
});
