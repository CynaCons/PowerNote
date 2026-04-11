/**
 * Test 69: Update Hot-Swap Flow
 *
 * Simulates the update workflow:
 * 1. App loads with workspace data (text nodes, sections)
 * 2. Export to HTML (which uses the dist-template)
 * 3. Import the exported file back (simulates opening an "updated" version)
 * 4. Verify all data survived the round-trip
 *
 * This tests the core data injection + template hydration that the
 * update mechanism relies on.
 */
import { test, expect } from '@playwright/test';
import { waitForCanvasReady, getWorkspaceStore, getCanvasStore, disableFSA } from '../helpers';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test.describe('69 - Update Hot-Swap (REQ-UPDATE-001)', () => {
  const tmpFile = path.join(__dirname, 'update-test.html');

  test.afterAll(() => {
    if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
  });

  test('data injection into template preserves all workspace content', async ({ page }) => {
    test.setTimeout(60000);
    await disableFSA(page);
    await page.goto('/');
    await waitForCanvasReady(page);

    // Setup: create rich content
    await page.evaluate(() => {
      const ws = (window as any).__POWERNOTE_STORES__.workspace.getState();
      ws.updateWorkspace({ filename: 'Update Test Notebook', editorVersion: '0.17.0' });
      ws.renameSection(ws.activeSectionId, 'Test Section Alpha');
      ws.renamePage(ws.activeSectionId, ws.activePageId, 'Test Page One');
      ws.addPage(ws.activeSectionId, 'Test Page Two');

      const cs = (window as any).__POWERNOTE_STORES__.canvas.getState();
      cs.addNode({
        id: 'surv-1', type: 'text', x: 100, y: 100, width: 200, height: 30, layer: 4,
        data: { text: 'This text must survive', fontSize: 16,
                fontFamily: 'Inter', fontStyle: 'bold', fill: '#dc2626' },
      });
      cs.addNode({
        id: 'surv-2', type: 'text', x: 100, y: 200, width: 200, height: 30, layer: 4,
        data: { text: '## Markdown header\n\n- [x] done\n- [ ] todo', fontSize: 14,
                fontFamily: 'Inter', fontStyle: 'normal', fill: '#2563eb' },
      });
    });
    await page.waitForTimeout(300);

    // Verify setup
    let ws = await getWorkspaceStore(page);
    expect(ws.workspace.filename).toBe('Update Test Notebook');
    expect(ws.workspace.sections[0].title).toBe('Test Section Alpha');
    expect(ws.workspace.sections[0].pages).toHaveLength(2);

    let cs = await getCanvasStore(page);
    expect(cs.nodes).toHaveLength(2);

    // Save (export to HTML) — this uses buildExportHtml which injects data into dist-template
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.keyboard.press('Control+s'),
    ]);
    const dlPath = await download.path();
    expect(dlPath).toBeTruthy();

    // Read the exported file and verify it contains our data
    const exportedHtml = fs.readFileSync(dlPath!, 'utf-8');
    expect(exportedHtml).toContain('powernote-data');
    expect(exportedHtml).toContain('This text must survive');
    expect(exportedHtml).toContain('Test Section Alpha');
    expect(exportedHtml).toContain('Test Page Two');
    expect(exportedHtml).toContain('#dc2626');

    // Save to temp file for re-import
    fs.writeFileSync(tmpFile, exportedHtml);

    // Now simulate "opening the updated notebook" by importing the file
    const fileInput = page.locator('[data-testid="file-input"]');
    await fileInput.setInputFiles(tmpFile);
    await page.waitForTimeout(1000);

    // Verify ALL data survived the template injection round-trip
    ws = await getWorkspaceStore(page);
    expect(ws.workspace.filename).toBe('Update Test Notebook');
    expect(ws.workspace.sections[0].title).toBe('Test Section Alpha');
    expect(ws.workspace.sections[0].pages[0].title).toBe('Test Page One');
    expect(ws.workspace.sections[0].pages).toHaveLength(2);

    cs = await getCanvasStore(page);
    expect(cs.nodes).toHaveLength(2);

    const textNode = cs.nodes.find((n: any) => n.id === 'surv-1');
    expect(textNode).toBeTruthy();
    expect(textNode!.data.text).toBe('This text must survive');
    expect((textNode!.data as any).fill).toBe('#dc2626');
    expect((textNode!.data as any).fontStyle).toBe('bold');

    const mdNode = cs.nodes.find((n: any) => n.id === 'surv-2');
    expect(mdNode).toBeTruthy();
    expect(mdNode!.data.text).toContain('## Markdown header');
    expect(mdNode!.data.text).toContain('[x] done');
  });

  test('buildExportHtml injects data into dist-template correctly', async ({ page }) => {
    test.setTimeout(30000);
    await disableFSA(page);
    await page.goto('/');
    await waitForCanvasReady(page);

    // Create content
    await page.evaluate(() => {
      const ws = (window as any).__POWERNOTE_STORES__.workspace.getState();
      ws.updateWorkspace({ filename: 'Injection Test' });
      const cs = (window as any).__POWERNOTE_STORES__.canvas.getState();
      cs.addNode({
        id: 'inject-1', type: 'text', x: 50, y: 50, width: 150, height: 30, layer: 4,
        data: { text: 'Injected content', fontSize: 16,
                fontFamily: 'Inter', fontStyle: 'normal', fill: '#000000' },
      });
    });

    // Call buildExportHtml directly and verify the output
    await page.waitForTimeout(200);
    const result = await page.evaluate(async () => {
      const ws = (window as any).__POWERNOTE_STORES__.workspace.getState();
      ws.savePageNodes((window as any).__POWERNOTE_STORES__.canvas.getState().nodes);
      // Get fresh state after flush
      const workspace = (window as any).__POWERNOTE_STORES__.workspace.getState().workspace;

      // Import dynamically
      const { buildExportHtml } = await import('/src/utils/serialization.ts');
      const html = await buildExportHtml(workspace);

      return {
        length: html.length,
        hasDoctype: html.startsWith('<!') || html.includes('<!doctype'),
        hasRoot: html.includes('<div id="root">'),
        hasDataScript: html.includes('powernote-data'),
        hasContent: html.includes('Injected content'),
        hasFilename: html.includes('Injection Test'),
      };
    });

    expect(result.hasDoctype).toBe(true);
    expect(result.hasRoot).toBe(true);
    expect(result.hasDataScript).toBe(true);
    expect(result.hasContent).toBe(true);
    expect(result.hasFilename).toBe(true);
    expect(result.length).toBeGreaterThan(100000); // Should be >100KB (full app bundle)
  });
});
