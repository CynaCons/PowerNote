/**
 * Test 37: Full Round-Trip
 * Covers: REQ-FILE-004, REQ-FILE-007
 *
 * The definitive test: fills a notebook with real multi-section content,
 * exports to HTML, reopens the HTML file, and verifies every piece of
 * content survived the round-trip.
 */
import { test, expect } from '@playwright/test';
import { getWorkspaceStore, getCanvasStore, waitForCanvasReady, activateTool, disableFSA } from '../helpers';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test.describe('37 - Full Round-Trip (REQ-FILE-004, REQ-FILE-007)', () => {
  test('save → reopen → verify: complete notebook round-trip', async ({ page }) => {
    await disableFSA(page);
    await page.goto('/');
    await waitForCanvasReady(page);

    // ── Step 1: Fill the notebook with real content ──────────

    // Rename the default section to "Computer Science"
    await activateTool(page, 'hierarchy');
    await expect(page.locator('[data-testid="hierarchy-panel"]')).toBeVisible();

    // Add content to Page 1 via store
    await page.evaluate(() => {
      const cs = (window as any).__POWERNOTE_STORES__.canvas.getState();
      cs.addNode({
        id: 'cs-note-1', type: 'text', x: 100, y: 50, width: 400, height: 30,
        data: {
          text: '# Data Structures\n\n## Arrays\n- Fixed size\n- O(1) random access\n- O(n) insertion\n\n## Linked Lists\n- Dynamic size\n- O(n) access\n- O(1) insertion at head',
          fontSize: 16, fontFamily: 'Inter, system-ui, sans-serif', fontStyle: 'normal', fill: '#1a1a1a',
        },
      });
      cs.addNode({
        id: 'cs-note-2', type: 'text', x: 100, y: 400, width: 400, height: 30,
        data: {
          text: '## Study Checklist\n- [x] Arrays reviewed\n- [x] Linked lists reviewed\n- [ ] Trees\n- [ ] Graphs\n- [ ] Hash tables',
          fontSize: 16, fontFamily: 'Inter, system-ui, sans-serif', fontStyle: 'normal', fill: '#1a1a1a',
        },
      });
    });
    await page.waitForTimeout(200);

    // Add a second section "Math Notes"
    await page.locator('[data-testid="add-section-btn"]').click();
    await page.waitForTimeout(200);

    // Navigate to the new section's page
    const newPage = page.locator('.hierarchy-page').nth(1);
    await newPage.locator('.hierarchy-page__nav').click();
    await page.waitForTimeout(300);

    // Add math content to the second section's page
    await page.evaluate(() => {
      const cs = (window as any).__POWERNOTE_STORES__.canvas.getState();
      cs.addNode({
        id: 'math-note-1', type: 'text', x: 100, y: 50, width: 400, height: 30,
        data: {
          text: '# Linear Algebra\n\n**Eigenvalues**: solutions to `det(A - λI) = 0`\n\n1. Find characteristic polynomial\n2. Solve for λ\n3. Find eigenvectors\n\n> Key insight: eigenvectors define the axes of transformation',
          fontSize: 16, fontFamily: 'Inter, system-ui, sans-serif', fontStyle: 'normal', fill: '#1a1a1a',
        },
      });
    });
    await page.waitForTimeout(200);

    // Navigate back to first section's page to save the math nodes
    const firstPage = page.locator('.hierarchy-page').first();
    await firstPage.locator('.hierarchy-page__nav').click();
    await page.waitForTimeout(300);

    // ── Step 2: Export to HTML ───────────────────────────────

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.locator('[data-testid="save-btn"]').click(),
    ]);

    const downloadPath = await download.path();
    expect(downloadPath).toBeTruthy();

    const exportedHtml = fs.readFileSync(downloadPath!, 'utf-8');

    // Verify the exported HTML contains the data script
    expect(exportedHtml).toContain('powernote-data');
    expect(exportedHtml).toContain('Data Structures');
    expect(exportedHtml).toContain('Linear Algebra');
    expect(exportedHtml).toContain('Study Checklist');

    // ── Step 3: Extract and verify the embedded JSON ────────

    const dataMatch = exportedHtml.match(
      /<script id="powernote-data" type="application\/json">([\s\S]*?)<\/script>/
    );
    expect(dataMatch).toBeTruthy();

    const embeddedData = JSON.parse(dataMatch![1].trim());

    // Verify structure
    expect(embeddedData.sections).toHaveLength(2);
    expect(embeddedData.sections[0].title).toBe('Section 1');
    expect(embeddedData.sections[0].pages).toHaveLength(1);
    expect(embeddedData.sections[1].title).toBe('New Section');
    expect(embeddedData.sections[1].pages).toHaveLength(1);

    // Verify Section 1 page has 2 nodes
    const section1Nodes = embeddedData.sections[0].pages[0].nodes;
    expect(section1Nodes).toHaveLength(2);
    expect(section1Nodes[0].data.text).toContain('Data Structures');
    expect(section1Nodes[1].data.text).toContain('Study Checklist');

    // Verify Section 2 page has 1 node
    const section2Nodes = embeddedData.sections[1].pages[0].nodes;
    expect(section2Nodes).toHaveLength(1);
    expect(section2Nodes[0].data.text).toContain('Linear Algebra');

    // Verify node positions survived
    expect(section1Nodes[0].x).toBe(100);
    expect(section1Nodes[0].y).toBe(50);

    // ── Step 4: Import the file back and verify ─────────────

    // Save the exported file to a temp location
    const tmpFile = path.join(__dirname, '..', 'round-trip-test.html');
    fs.writeFileSync(tmpFile, exportedHtml);

    try {
      // Import via file input
      const fileInput = page.locator('[data-testid="file-input"]');
      await fileInput.setInputFiles(tmpFile);
      await page.waitForTimeout(500);

      // Verify workspace restored
      const ws = await getWorkspaceStore(page);
      expect(ws.workspace.sections).toHaveLength(2);
      expect(ws.workspace.sections[0].pages[0].nodes).toHaveLength(2);
      expect(ws.workspace.sections[1].pages[0].nodes).toHaveLength(1);

      // Verify canvas has the first section's nodes loaded
      const cs = await getCanvasStore(page);
      expect(cs.nodes).toHaveLength(2);
      expect(cs.nodes[0].data.text).toContain('Data Structures');
    } finally {
      if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
    }
  });
});
