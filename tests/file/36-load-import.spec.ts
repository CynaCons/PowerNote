/**
 * Test 36: Load / Import
 * Covers: REQ-FILE-005, REQ-FILE-006
 *
 * Verifies that the app can import a PowerNote HTML file and hydrate state.
 */
import { test, expect } from '@playwright/test';
import { getWorkspaceStore, getCanvasStore, waitForCanvasReady } from '../helpers';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test.describe('36 - Load / Import (REQ-FILE-005..006)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForCanvasReady(page);
  });

  test('importing a valid PowerNote HTML file hydrates the workspace', async ({ page }) => {
    // Create a mock PowerNote HTML file
    const mockData = {
      version: '0.4.0',
      filename: 'Imported Notebook',
      sections: [
        {
          id: 'imported-section-1',
          title: 'Imported Section',
          pages: [
            {
              id: 'imported-page-1',
              title: 'Imported Page',
              nodes: [
                {
                  id: 'imported-node-1',
                  type: 'text',
                  x: 100,
                  y: 100,
                  width: 200,
                  height: 30,
                  data: {
                    text: '# Imported Content\nThis was imported!',
                    fontSize: 16,
                    fontFamily: 'Inter, system-ui, sans-serif',
                    fontStyle: 'normal',
                    fill: '#1a1a1a',
                  },
                },
              ],
            },
          ],
        },
      ],
    };

    const mockHtml = `<!DOCTYPE html>
<html><head>
<script id="powernote-data" type="application/json">
${JSON.stringify(mockData)}
</script>
</head><body></body></html>`;

    // Write to a temp file
    const tmpFile = path.join(__dirname, '..', 'test-import.html');
    fs.writeFileSync(tmpFile, mockHtml);

    try {
      // Use the file input to import
      const fileInput = page.locator('[data-testid="file-input"]');
      await fileInput.setInputFiles(tmpFile);
      await page.waitForTimeout(500);

      // Verify workspace was hydrated
      const ws = await getWorkspaceStore(page);
      expect(ws.workspace.filename).toBe('Imported Notebook');
      expect(ws.workspace.sections).toHaveLength(1);
      expect(ws.workspace.sections[0].title).toBe('Imported Section');
      expect(ws.workspace.sections[0].pages[0].title).toBe('Imported Page');

      // Verify canvas nodes loaded
      const cs = await getCanvasStore(page);
      expect(cs.nodes).toHaveLength(1);
      expect(cs.nodes[0].data.text).toContain('Imported Content');

      // Verify breadcrumb updated
      await expect(page.locator('[data-testid="topbar-filename"]')).toHaveText('Imported Notebook');
      await expect(page.locator('[data-testid="topbar-section"]')).toHaveText('Imported Section');
    } finally {
      fs.unlinkSync(tmpFile);
    }
  });
});
