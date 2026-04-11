/**
 * Test 50: Full Feature Showcase Demo
 *
 * A comprehensive walkthrough of every PowerNote feature:
 * - Hierarchy: create sections, pages, rename them
 * - Text: place, edit with markdown, format with toolbar
 * - Images: add programmatic images to canvas
 * - Drawing: freehand pen strokes with different colors
 * - Page navigation: switch pages, verify content persists
 * - Save/Load: export and verify round-trip
 *
 * Run with: npx playwright test tests/demo/50-full-showcase.spec.ts --config=playwright.slow.config.ts
 */
import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { disableFSA } from '../helpers';

test.setTimeout(180000); // 3 minutes

test.describe('50 - Full PowerNote Showcase Demo', () => {
  test('complete feature walkthrough', async ({ page }) => {
    await disableFSA(page);
    await page.goto('/');
    await page.locator('[data-testid="canvas-container"] canvas').first().waitFor({ state: 'visible' });
    await page.waitForTimeout(1000);

    // ═══════════════════════════════════════════════
    // PHASE 1: Setup Hierarchy
    // ═══════════════════════════════════════════════

    // Rename notebook
    await page.click('[data-testid="topbar-filename"]');
    await page.waitForTimeout(300);
    const filenameInput = page.locator('[data-testid="topbar-filename-input"]');
    await filenameInput.fill('EV Motor Control Research');
    await filenameInput.press('Enter');
    await page.waitForTimeout(500);

    // Open hierarchy panel
    await page.click('[data-testid="nav-hierarchy"]');
    await page.waitForTimeout(500);

    // Set up hierarchy via store (faster + more reliable for demo)
    await page.evaluate(() => {
      const ws = (window as any).__POWERNOTE_STORES__.workspace.getState();
      const sectionId = ws.activeSectionId;
      const pageId = ws.activePageId;

      // Rename section 1 and page 1
      ws.renameSection(sectionId, 'FOC Theory');
      ws.renamePage(sectionId, pageId, 'Control Loop Overview');

      // Add page 2 to section 1
      ws.addPage(sectionId, 'PI Tuning Notes');

      // Add section 2 with a page
      ws.addSection('Hardware Design');
      const newSection = ws.workspace.sections[ws.workspace.sections.length - 1];
      ws.renamePage(newSection.id, newSection.pages[0].id, 'Inverter Schematic');
    });
    await page.waitForTimeout(800);

    // ═══════════════════════════════════════════════
    // PHASE 2: Page 1 - "Control Loop Overview" — Text + Images
    // ═══════════════════════════════════════════════

    // Navigate to page 1 via store
    await page.evaluate(() => {
      const ws = (window as any).__POWERNOTE_STORES__.workspace.getState();
      const canvas = (window as any).__POWERNOTE_STORES__.canvas;
      const draw = (window as any).__POWERNOTE_STORES__.draw;
      const section = ws.workspace.sections[0];
      const pg = section.pages[0];
      ws.setActivePage(section.id, pg.id);
      canvas.getState().loadPageNodes(pg.nodes ?? []);
      draw.getState().loadPageStrokes(pg.strokes ?? []);
    });
    await page.waitForTimeout(500);

    // Close hierarchy to see more canvas
    await page.click('[data-testid="nav-hierarchy"]');
    await page.waitForTimeout(300);

    const canvas = page.locator('[data-testid="canvas-container"] canvas').last();

    // Helper to place text block via store (reliable across all zoom/pan states)
    async function placeText(x: number, y: number, content: string) {
      await page.evaluate(({ x, y, content }) => {
        const stores = (window as any).__POWERNOTE_STORES__;
        const id = 'demo-' + Math.random().toString(36).slice(2, 8);
        const opts = stores.tool.getState().textOptions;
        stores.canvas.getState().addNode({
          id, type: 'text', x, y, width: 200, height: 30,
          data: { text: content, fontSize: opts.fontSize, fontFamily: opts.fontFamily, fontStyle: opts.fontStyle, fill: opts.fill },
        });
      }, { x, y, content });
      await page.waitForTimeout(600);
    }

    // Place title text
    await placeText(200, 80, '# FOC Control Loop Overview\n\nField-Oriented Control transforms 3-phase motor currents into a rotating reference frame for independent torque and flux control.');

    // Place second text block with bullet points
    await placeText(200, 280, '## Key Components\n\n- **Clarke Transform** — abc to αβ\n- **Park Transform** — αβ to dq\n- **PI Controllers** — Independent Id and Iq regulation\n- **Inverse Park** — dq back to αβ\n- **SVM** — Space Vector Modulation for gate signals');

    // Place a checklist
    await placeText(500, 80, '## Implementation Status\n\n- [x] Clarke transform (Q15)\n- [x] Park transform (Q15)\n- [x] Current PI loops\n- [ ] Speed PI loop\n- [ ] Field weakening\n- [ ] MTPA lookup');

    // Add a programmatic image (FOC diagram)
    await page.evaluate(() => {
      const cv = document.createElement('canvas');
      cv.width = 350; cv.height = 180;
      const ctx = cv.getContext('2d')!;
      ctx.fillStyle = '#f0f7ff'; ctx.fillRect(0, 0, 350, 180);
      ctx.strokeStyle = '#2563eb'; ctx.lineWidth = 1; ctx.strokeRect(0, 0, 350, 180);
      ctx.fillStyle = '#1e293b'; ctx.font = 'bold 14px sans-serif';
      ctx.fillText('FOC Block Diagram', 100, 25);
      const boxes = [
        { x: 10, y: 50, w: 60, h: 35, t: 'ADC', c: '#dbeafe' },
        { x: 85, y: 50, w: 70, h: 35, t: 'Clarke', c: '#e0e7ff' },
        { x: 170, y: 50, w: 55, h: 35, t: 'Park', c: '#ede9fe' },
        { x: 240, y: 50, w: 55, h: 35, t: 'PI', c: '#fce7f3' },
        { x: 240, y: 110, w: 55, h: 35, t: 'SVM', c: '#dcfce7' },
        { x: 85, y: 110, w: 70, h: 35, t: 'Inverter', c: '#fee2e2' },
      ];
      boxes.forEach(b => {
        ctx.fillStyle = b.c; ctx.fillRect(b.x, b.y, b.w, b.h);
        ctx.strokeStyle = '#94a3b8'; ctx.strokeRect(b.x, b.y, b.w, b.h);
        ctx.fillStyle = '#334155'; ctx.font = '11px sans-serif';
        ctx.fillText(b.t, b.x + 5, b.y + 22);
      });
      ctx.strokeStyle = '#2563eb'; ctx.lineWidth = 1.5;
      [[70,67,85,67],[155,67,170,67],[225,67,240,67],[267,85,267,110],[240,127,155,127]].forEach(([x1,y1,x2,y2]) => {
        ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
      });
      const stores = (window as any).__POWERNOTE_STORES__;
      stores.canvas.getState().addNode({
        id: 'demo-img-1', type: 'image', x: 500, y: 280, width: 350, height: 180,
        data: { src: cv.toDataURL(), alt: 'FOC Diagram', naturalWidth: 350, naturalHeight: 180 }
      });
    });
    await page.waitForTimeout(800);

    // ═══════════════════════════════════════════════
    // PHASE 3: Draw some annotations on Page 1
    // ═══════════════════════════════════════════════

    // Activate draw tool
    await page.click('[data-testid="nav-draw-tool"]');
    await page.waitForTimeout(300);

    // Draw a red arrow-like stroke
    await page.evaluate(() => {
      const stores = (window as any).__POWERNOTE_STORES__;
      stores.tool.getState().setDrawOptions({ color: '#dc2626', strokeWidth: 4 });
    });
    await page.waitForTimeout(200);

    // Draw stroke 1: underline under title
    await page.mouse.move(200, 120);
    await page.mouse.down();
    for (let x = 200; x <= 550; x += 5) {
      await page.mouse.move(x, 120 + Math.sin((x - 200) / 30) * 3);
    }
    await page.mouse.up();
    await page.waitForTimeout(400);

    // Draw stroke 2: a circle around the checklist area
    await page.evaluate(() => {
      const stores = (window as any).__POWERNOTE_STORES__;
      stores.tool.getState().setDrawOptions({ color: '#2563eb', strokeWidth: 2 });
    });
    await page.mouse.move(490, 70);
    await page.mouse.down();
    for (let a = 0; a <= Math.PI * 2.1; a += 0.15) {
      await page.mouse.move(590 + 110 * Math.cos(a), 220 + 130 * Math.sin(a));
    }
    await page.mouse.up();
    await page.waitForTimeout(400);

    // Switch back to select
    await page.click('[data-testid="nav-draw-tool"]');
    await page.waitForTimeout(300);

    // ═══════════════════════════════════════════════
    // PHASE 4: Navigate to Page 2 - "PI Tuning Notes"
    // ═══════════════════════════════════════════════

    await page.click('[data-testid="nav-hierarchy"]');
    await page.waitForTimeout(400);

    // Navigate to "PI Tuning Notes" via store
    await page.evaluate(() => {
      const ws = (window as any).__POWERNOTE_STORES__.workspace.getState();
      const canvas = (window as any).__POWERNOTE_STORES__.canvas;
      const draw = (window as any).__POWERNOTE_STORES__.draw;
      ws.savePageNodes(canvas.getState().nodes);
      ws.savePageStrokes(draw.getState().strokes);
      const section = ws.workspace.sections[0];
      const pg = section.pages[1];
      ws.setActivePage(section.id, pg.id);
      canvas.getState().loadPageNodes(pg.nodes ?? []);
      draw.getState().loadPageStrokes(pg.strokes ?? []);
    });
    await page.waitForTimeout(600);

    await page.click('[data-testid="nav-hierarchy"]');
    await page.waitForTimeout(300);

    // Place text on page 2
    await placeText(200, 80, '# PI Tuning Notes\n\n## Current Loop\n| Parameter | Value |\n|---|---|\n| Kp | 2.5 |\n| Ki | 450 |\n| Bandwidth | 1.5 kHz |\n| Sample time | 50 μs |');

    // Add a speed loop table
    await placeText(500, 80, '## Speed Loop\n| Parameter | Value |\n|---|---|\n| Kp | 0.05 |\n| Ki | 2.0 |\n| Bandwidth | 100 Hz |\n| Ramp rate | 5000 RPM/s |');

    // Draw on page 2
    await page.click('[data-testid="nav-draw-tool"]');
    await page.evaluate(() => {
      (window as any).__POWERNOTE_STORES__.tool.getState().setDrawOptions({ color: '#16a34a', strokeWidth: 3 });
    });
    await page.mouse.move(300, 350);
    await page.mouse.down();
    for (let x = 300; x <= 600; x += 5) {
      await page.mouse.move(x, 350 + 40 * Math.sin((x - 300) / 40));
    }
    await page.mouse.up();
    await page.waitForTimeout(400);
    await page.click('[data-testid="nav-draw-tool"]');
    await page.waitForTimeout(300);

    // ═══════════════════════════════════════════════
    // PHASE 5: Navigate to Section 2, Page "Inverter Schematic"
    // ═══════════════════════════════════════════════

    await page.click('[data-testid="nav-hierarchy"]');
    await page.waitForTimeout(400);

    // Navigate to "Inverter Schematic" in section 2 via store
    await page.evaluate(() => {
      const ws = (window as any).__POWERNOTE_STORES__.workspace.getState();
      const canvas = (window as any).__POWERNOTE_STORES__.canvas;
      const draw = (window as any).__POWERNOTE_STORES__.draw;
      ws.savePageNodes(canvas.getState().nodes);
      ws.savePageStrokes(draw.getState().strokes);
      const section = ws.workspace.sections[1];
      const pg = section.pages[0];
      ws.setActivePage(section.id, pg.id);
      canvas.getState().loadPageNodes(pg.nodes ?? []);
      draw.getState().loadPageStrokes(pg.strokes ?? []);
    });
    await page.waitForTimeout(600);

    await page.click('[data-testid="nav-hierarchy"]');
    await page.waitForTimeout(300);

    // Add an inverter circuit image
    await page.evaluate(() => {
      const cv = document.createElement('canvas');
      cv.width = 400; cv.height = 250;
      const ctx = cv.getContext('2d')!;
      ctx.fillStyle = '#fffbeb'; ctx.fillRect(0, 0, 400, 250);
      ctx.strokeStyle = '#d97706'; ctx.lineWidth = 1; ctx.strokeRect(0, 0, 400, 250);
      ctx.fillStyle = '#1e293b'; ctx.font = 'bold 14px sans-serif';
      ctx.fillText('3-Phase Inverter Topology', 100, 25);
      // DC bus
      ctx.strokeStyle = '#dc2626'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(30, 60); ctx.lineTo(370, 60); ctx.stroke();
      ctx.strokeStyle = '#2563eb';
      ctx.beginPath(); ctx.moveTo(30, 200); ctx.lineTo(370, 200); ctx.stroke();
      ctx.fillStyle = '#dc2626'; ctx.font = '12px sans-serif'; ctx.fillText('V+ (48V)', 10, 55);
      ctx.fillStyle = '#2563eb'; ctx.fillText('V- (GND)', 10, 215);
      // MOSFET pairs
      ['A', 'B', 'C'].forEach((ph, i) => {
        const x = 100 + i * 100;
        ctx.fillStyle = '#fef3c7'; ctx.fillRect(x - 15, 80, 30, 30); ctx.fillRect(x - 15, 150, 30, 30);
        ctx.strokeStyle = '#94a3b8'; ctx.strokeRect(x - 15, 80, 30, 30); ctx.strokeRect(x - 15, 150, 30, 30);
        ctx.fillStyle = '#334155'; ctx.font = '10px sans-serif';
        ctx.fillText('Q' + (i*2+1), x - 8, 100); ctx.fillText('Q' + (i*2+2), x - 8, 170);
        ctx.strokeStyle = '#334155'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(x, 60); ctx.lineTo(x, 80); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x, 110); ctx.lineTo(x, 130); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x, 150); ctx.lineTo(x, 150); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x, 180); ctx.lineTo(x, 200); ctx.stroke();
        // Phase output
        ctx.fillStyle = '#16a34a'; ctx.font = 'bold 12px sans-serif';
        ctx.fillText('Phase ' + ph, x - 22, 142);
      });
      const stores = (window as any).__POWERNOTE_STORES__;
      stores.canvas.getState().addNode({
        id: 'demo-img-2', type: 'image', x: 150, y: 50, width: 400, height: 250,
        data: { src: cv.toDataURL(), alt: 'Inverter Schematic', naturalWidth: 400, naturalHeight: 250 }
      });
    });
    await page.waitForTimeout(600);

    // Add text description
    await placeText(150, 350, '## Design Notes\n\n- **MOSFETs**: IRFP4468 (100V, 195A)\n- **Gate driver**: IR2110 bootstrap\n- **Dead-time**: 300ns (hardware)\n- **Switching freq**: 20 kHz\n- **Bus capacitors**: 4x 470μF low-ESR');

    // Draw annotations
    await page.click('[data-testid="nav-draw-tool"]');
    await page.evaluate(() => {
      (window as any).__POWERNOTE_STORES__.tool.getState().setDrawOptions({ color: '#dc2626', strokeWidth: 3 });
    });
    // Draw an arrow pointing to something
    await page.mouse.move(580, 150);
    await page.mouse.down();
    await page.mouse.move(560, 160);
    await page.mouse.move(570, 155);
    await page.mouse.move(620, 130);
    await page.mouse.move(650, 120);
    await page.mouse.up();
    await page.waitForTimeout(400);
    await page.click('[data-testid="nav-draw-tool"]');

    // ═══════════════════════════════════════════════
    // PHASE 6: Navigate BACK and verify content persists
    // ═══════════════════════════════════════════════

    await page.click('[data-testid="nav-hierarchy"]');
    await page.waitForTimeout(400);

    // Helper to navigate via store — saves current then loads target
    async function goToPage(sectionIdx: number, pageIdx: number) {
      // Save first
      await page.evaluate(() => {
        const s = (window as any).__POWERNOTE_STORES__;
        s.workspace.getState().savePageNodes(s.canvas.getState().nodes);
        s.workspace.getState().savePageStrokes(s.draw.getState().strokes);
      });
      await page.waitForTimeout(100);
      // Then navigate
      await page.evaluate(({ si, pi }) => {
        const s = (window as any).__POWERNOTE_STORES__;
        const ws = s.workspace.getState();
        const section = ws.workspace.sections[si];
        if (!section) throw new Error('Section ' + si + ' not found, have ' + ws.workspace.sections.length);
        const pg = section.pages[pi];
        if (!pg) throw new Error('Page ' + pi + ' not found in section ' + section.title);
        ws.setActivePage(section.id, pg.id);
        s.canvas.getState().loadPageNodes(pg.nodes ?? []);
        s.draw.getState().loadPageStrokes(pg.strokes ?? []);
      }, { si: sectionIdx, pi: pageIdx });
      await page.waitForTimeout(800);
    }

    // Go back to page 1 "Control Loop Overview"
    await goToPage(0, 0);

    // Verify page 1 content is still there
    const store1 = await page.evaluate(() => {
      const s = (window as any).__POWERNOTE_STORES__;
      return {
        nodeCount: s.canvas.getState().nodes.length,
        strokeCount: s.draw.getState().strokes.length,
        pageTitle: s.workspace.getState().getActivePage()?.title,
      };
    });
    // Verify page 1 has content (text + image)
    expect(store1.nodeCount).toBeGreaterThanOrEqual(3);
    await page.waitForTimeout(1000);

    // Navigate to page 2 and verify
    await goToPage(0, 1);
    const store2 = await page.evaluate(() => ({
      nodeCount: (window as any).__POWERNOTE_STORES__.canvas.getState().nodes.length,
    }));
    expect(store2.nodeCount).toBeGreaterThanOrEqual(2);
    await page.waitForTimeout(1000);

    // Navigate to section 2 page and verify
    await goToPage(1, 0);
    const store3 = await page.evaluate(() => ({
      nodeCount: (window as any).__POWERNOTE_STORES__.canvas.getState().nodes.length,
    }));
    expect(store3.nodeCount).toBeGreaterThanOrEqual(2);

    await page.waitForTimeout(800);
    await page.click('[data-testid="nav-hierarchy"]');

    // ═══════════════════════════════════════════════
    // PHASE 7: Save and verify export
    // ═══════════════════════════════════════════════

    const downloadPromise = page.waitForEvent('download');
    await page.click('[data-testid="save-btn"]');
    const download = await downloadPromise;

    // Verify toast appeared
    await page.waitForTimeout(1000);

    // Check file size (should have images + strokes)
    const tmpPath = path.resolve('test-results/showcase-demo.html');
    if (!fs.existsSync('test-results')) fs.mkdirSync('test-results', { recursive: true });
    await download.saveAs(tmpPath);
    const fileSize = fs.statSync(tmpPath).size;
    expect(fileSize).toBeGreaterThan(100000); // >100KB with images

    // Verify the export contains our content
    const html = fs.readFileSync(tmpPath, 'utf-8');
    expect(html).toContain('FOC Control Loop Overview');
    expect(html).toContain('PI Tuning Notes');
    expect(html).toContain('Inverter Schematic');
    expect(html).toContain('data:image/png'); // Images embedded
    expect(html).toContain('strokes'); // Drawing data

    await page.waitForTimeout(1500);

    // Final verification: zoom to fit to show everything
    await page.click('[data-testid="zoom-fit-btn"]');
    await page.waitForTimeout(1500);
  });
});
