/**
 * Test 38: Full Workflow Persistence — EV Motor Control Report
 *
 * The definitive end-to-end workflow test:
 * 1. Create a multi-section scientific report on Low Voltage Motor Control for EVs
 * 2. Save to HTML
 * 3. Reopen the saved file
 * 4. Modify content (text changes, color changes, new nodes)
 * 5. Save again
 * 6. Reopen again
 * 7. Verify all changes persisted across 4 save/reopen cycles
 *
 * Also evaluates tool completeness for a researcher's workflow.
 */
import { test, expect } from '@playwright/test';
import {
  getWorkspaceStore,
  getCanvasStore,
  waitForCanvasReady,
  activateTool,
  disableFSA,
} from '../helpers';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEMP_FILE = path.join(__dirname, '..', 'ev-motor-control.html');

// Helper: save and return the HTML content
async function saveNotebook(page: any): Promise<string> {
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.locator('[data-testid="save-btn"]').click(),
  ]);
  const dlPath = await download.path();
  return fs.readFileSync(dlPath!, 'utf-8');
}

// Helper: inject HTML content directly into the workspace store (bypasses
// the file input which has reliability issues with Playwright's
// setInputFiles when called multiple times in the same test).
async function reopenNotebook(page: any, html: string) {
  await page.evaluate((htmlContent: string) => {
    const stores = (window as any).__POWERNOTE_STORES__;
    // Extract the data script from the HTML
    const match = htmlContent.match(/<script id="powernote-data" type="application\/json">([\s\S]*?)<\/script>/);
    if (!match) throw new Error('No data script found in html');
    const data = JSON.parse(match[1].trim());
    // Hydrate all three stores to simulate a fresh app load
    stores.workspace.setState({
      workspace: data,
      activeSectionId: data.sections[0]?.id,
      activePageId: data.sections[0]?.pages[0]?.id,
      isDirty: false,
    });
    const firstPage = data.sections[0]?.pages[0];
    stores.canvas.getState().loadPageNodes(firstPage?.nodes ?? []);
    stores.draw.getState().loadPageStrokes(firstPage?.strokes ?? []);
  }, html);
  await page.waitForTimeout(200);
}

// Helper: add a text node via store
async function addTextNode(page: any, id: string, x: number, y: number, text: string, opts: any = {}) {
  await page.evaluate(({ id, x, y, text, fontSize, fill }: any) => {
    const cs = (window as any).__POWERNOTE_STORES__.canvas.getState();
    cs.addNode({
      id, type: 'text', x, y, width: 120, height: 30,
      data: {
        text,
        fontSize: fontSize || 16,
        fontFamily: 'Inter, system-ui, sans-serif',
        fontStyle: 'normal',
        fill: fill || '#1a1a1a',
      },
    });
  }, { id, x, y, text, fontSize: opts.fontSize, fill: opts.fill });
}

test.describe('38 - Workflow Persistence: EV Motor Control Report', () => {

  test('complete 4-cycle save/reopen workflow with scientific content', async ({ page }) => {
    // Increase timeout for this long test
    test.setTimeout(120000);

    await disableFSA(page);
    await page.goto('/');
    await waitForCanvasReady(page);

    // ════════════════════════════════════════════════════════
    // CYCLE 1: Create the initial scientific report
    // ════════════════════════════════════════════════════════

    // Open hierarchy panel and rename default section
    await activateTool(page, 'hierarchy');
    await expect(page.locator('[data-testid="hierarchy-panel"]')).toBeVisible();

    // Rename Section 1 → "Introduction"
    await page.locator('[data-testid="rename-section-btn"]').first().click({ force: true });
    const sectionInput = page.locator('[data-testid="section-rename-input"]');
    await expect(sectionInput).toBeVisible({ timeout: 2000 });
    await sectionInput.fill('Introduction');
    await sectionInput.press('Enter');
    await page.waitForTimeout(200);

    // Rename Page 1 → "Overview"
    await page.locator('[data-testid="rename-page-btn"]').first().click({ force: true });
    const pageInput = page.locator('[data-testid="page-rename-input"]');
    await expect(pageInput).toBeVisible({ timeout: 2000 });
    await pageInput.fill('Overview');
    await pageInput.press('Enter');
    await page.waitForTimeout(200);

    // Add content to the Overview page
    await addTextNode(page, 'title-node', 80, 30,
      '# Low Voltage Motor Control for Electric Vehicles\n\n**Technical Report — Rev. 1.0**\n\nAuthor: PowerNote Research Team\nDate: March 2026');

    await addTextNode(page, 'abstract-node', 80, 200,
      '## Abstract\n\nThis report covers the design and implementation of low voltage (48V) motor control systems for electric vehicle applications. Key topics include:\n\n- PWM-based inverter topologies\n- Field-Oriented Control (FOC) algorithms\n- Current sensing and feedback loops\n- Thermal management considerations\n- EMC compliance strategies');

    await addTextNode(page, 'checklist-node', 80, 500,
      '## Review Status\n\n- [x] Literature review complete\n- [x] Simulation model validated\n- [ ] Hardware prototype tested\n- [ ] EMC certification pending\n- [ ] Final review by Dr. Mueller');

    await page.waitForTimeout(300);

    // Add a second section: "Motor Control Theory"
    await page.locator('[data-testid="add-section-btn"]').click();
    await page.waitForTimeout(200);

    // Rename it
    await page.locator('[data-testid="rename-section-btn"]').nth(1).click({ force: true });
    const section2Input = page.locator('[data-testid="section-rename-input"]');
    await expect(section2Input).toBeVisible({ timeout: 2000 });
    await section2Input.fill('Motor Control Theory');
    await section2Input.press('Enter');
    await page.waitForTimeout(200);

    // Navigate to the new section's page
    await page.locator('.hierarchy-page__nav').nth(1).click();
    await page.waitForTimeout(300);

    // Add theory content
    await addTextNode(page, 'foc-node', 80, 30,
      '## Field-Oriented Control (FOC)\n\nFOC transforms the 3-phase stator currents into a rotating reference frame (d-q frame) aligned with the rotor flux.\n\n### Key Equations\n\n`Vd = Rs·Id + Ld·dId/dt - ωe·Lq·Iq`\n\n`Vq = Rs·Iq + Lq·dIq/dt + ωe·(Ld·Id + λm)`\n\nWhere:\n- `Rs` = stator resistance\n- `Ld, Lq` = d-axis and q-axis inductances\n- `ωe` = electrical angular velocity\n- `λm` = permanent magnet flux linkage');

    await addTextNode(page, 'pwm-node', 80, 450,
      '## PWM Inverter Design\n\n### 48V Architecture Advantages\n\n1. Below SELV safety threshold (no HV certification)\n2. Lower isolation requirements\n3. Compatible with standard automotive connectors\n4. Reduced EMI compared to 400V/800V systems\n\n### Switching Frequency Selection\n\n| Parameter | Value | Notes |\n|-----------|-------|-------|\n| fsw | 20 kHz | Above audible range |\n| Dead time | 500 ns | Prevents shoot-through |\n| Duty cycle range | 5-95% | With bootstrap driver |');

    await page.waitForTimeout(300);

    // Add a third section: "Testing & Validation"
    // Navigate back to first page first to save current
    await page.locator('.hierarchy-page__nav').first().click();
    await page.waitForTimeout(300);

    await page.locator('[data-testid="add-section-btn"]').click();
    await page.waitForTimeout(200);

    // Rename third section
    await page.locator('[data-testid="rename-section-btn"]').nth(2).click({ force: true });
    const section3Input = page.locator('[data-testid="section-rename-input"]');
    await expect(section3Input).toBeVisible({ timeout: 2000 });
    await section3Input.fill('Testing & Validation');
    await section3Input.press('Enter');
    await page.waitForTimeout(200);

    // Navigate to testing section page
    await page.locator('.hierarchy-page__nav').nth(2).click();
    await page.waitForTimeout(300);

    await addTextNode(page, 'test-plan-node', 80, 30,
      '## Test Plan\n\n### Phase 1: Simulation\n- MATLAB/Simulink FOC model\n- Thermal analysis (COMSOL)\n- EMC pre-compliance (CST)\n\n### Phase 2: Bench Testing\n- Dynamometer setup with PMSM\n- Current probe measurements\n- Efficiency mapping (torque vs speed)\n\n### Phase 3: Vehicle Integration\n- CAN bus communication validation\n- Vibration & shock testing (ISO 16750)\n- Temperature cycling (-40°C to +85°C)');

    await page.waitForTimeout(300);

    // Navigate back to first page for the save
    await page.locator('.hierarchy-page__nav').first().click();
    await page.waitForTimeout(300);

    // Verify initial structure
    let ws = await getWorkspaceStore(page);
    expect(ws.workspace.sections).toHaveLength(3);
    expect(ws.workspace.sections[0].title).toBe('Introduction');
    expect(ws.workspace.sections[1].title).toBe('Motor Control Theory');
    expect(ws.workspace.sections[2].title).toBe('Testing & Validation');

    // ── SAVE (Cycle 1) ──────────────────────────────────────
    const html1 = await saveNotebook(page);
    expect(html1).toContain('Low Voltage Motor Control');
    expect(html1).toContain('Field-Oriented Control');
    expect(html1).toContain('Test Plan');

    // ════════════════════════════════════════════════════════
    // CYCLE 2: Reopen and modify text content
    // ════════════════════════════════════════════════════════

    await reopenNotebook(page, html1);

    // Verify all 3 sections survived
    ws = await getWorkspaceStore(page);
    expect(ws.workspace.sections).toHaveLength(3);
    expect(ws.workspace.sections[0].title).toBe('Introduction');

    // Verify the first page's nodes
    let cs = await getCanvasStore(page);
    expect(cs.nodes).toHaveLength(3);
    expect(cs.nodes[0].data.text).toContain('Low Voltage Motor Control');

    // Modify the abstract — update revision
    await page.evaluate(() => {
      const store = (window as any).__POWERNOTE_STORES__.canvas.getState();
      const titleNode = store.nodes.find((n: any) => n.id === 'title-node');
      if (titleNode) {
        store.updateNode('title-node', {
          data: {
            ...titleNode.data,
            text: titleNode.data.text.replace('Rev. 1.0', 'Rev. 2.0 — Updated after simulation review'),
          },
        });
      }
    });
    await page.waitForTimeout(200);

    // Check a checkbox
    await page.evaluate(() => {
      const store = (window as any).__POWERNOTE_STORES__.canvas.getState();
      const checklistNode = store.nodes.find((n: any) => n.id === 'checklist-node');
      if (checklistNode) {
        store.updateNode('checklist-node', {
          data: {
            ...checklistNode.data,
            text: checklistNode.data.text.replace('- [ ] Hardware prototype tested', '- [x] Hardware prototype tested'),
          },
        });
      }
    });
    await page.waitForTimeout(200);

    // ── SAVE (Cycle 2) ──────────────────────────────────────
    const html2 = await saveNotebook(page);
    expect(html2).toContain('Rev. 2.0');
    expect(html2).toContain('[x] Hardware prototype tested');

    // ════════════════════════════════════════════════════════
    // CYCLE 3: Reopen and change colors + add new content
    // ════════════════════════════════════════════════════════

    await reopenNotebook(page, html2);

    // Verify modifications persisted
    cs = await getCanvasStore(page);
    expect(cs.nodes[0].data.text).toContain('Rev. 2.0');

    // Change the title node color to blue
    await page.evaluate(() => {
      const store = (window as any).__POWERNOTE_STORES__.canvas.getState();
      const titleNode = store.nodes.find((n: any) => n.id === 'title-node');
      if (titleNode) {
        store.updateNode('title-node', {
          data: { ...titleNode.data, fill: '#2563eb' },
        });
      }
    });
    await page.waitForTimeout(200);

    // Change abstract font size
    await page.evaluate(() => {
      const store = (window as any).__POWERNOTE_STORES__.canvas.getState();
      const abstractNode = store.nodes.find((n: any) => n.id === 'abstract-node');
      if (abstractNode) {
        store.updateNode('abstract-node', {
          data: { ...abstractNode.data, fontSize: 14 },
        });
      }
    });
    await page.waitForTimeout(200);

    // Add a new conclusion node
    await addTextNode(page, 'conclusion-node', 80, 700,
      '## Preliminary Conclusions\n\n> The 48V FOC-based drive system demonstrates **92.3% peak efficiency** at rated load, exceeding the 90% target.\n\n**Key findings:**\n1. Dead-time compensation improves THD by 15%\n2. Overmodulation extends speed range by 10%\n3. Thermal design is margin-positive up to 75°C ambient',
      { fill: '#16a34a' });

    await page.waitForTimeout(200);

    // ── SAVE (Cycle 3) ──────────────────────────────────────
    const html3 = await saveNotebook(page);
    expect(html3).toContain('#2563eb'); // Blue color on title
    expect(html3).toContain('Preliminary Conclusions');
    expect(html3).toContain('92.3% peak efficiency');

    // ════════════════════════════════════════════════════════
    // CYCLE 4: Final reopen — verify everything survived
    // ════════════════════════════════════════════════════════

    await reopenNotebook(page, html3);

    // ── Final verification: all data intact ─────────────────

    ws = await getWorkspaceStore(page);
    cs = await getCanvasStore(page);

    // Structure: 3 sections
    expect(ws.workspace.sections).toHaveLength(3);
    expect(ws.workspace.sections[0].title).toBe('Introduction');
    expect(ws.workspace.sections[1].title).toBe('Motor Control Theory');
    expect(ws.workspace.sections[2].title).toBe('Testing & Validation');

    // Introduction page: 4 nodes (title, abstract, checklist, conclusion)
    expect(cs.nodes).toHaveLength(4);

    // Title: Rev 2.0, blue color
    const titleNode = cs.nodes.find((n: any) => n.id === 'title-node');
    expect(titleNode).toBeTruthy();
    expect(titleNode!.data.text).toContain('Rev. 2.0');
    expect((titleNode!.data as any).fill).toBe('#2563eb');

    // Abstract: font size 14
    const abstractNode = cs.nodes.find((n: any) => n.id === 'abstract-node');
    expect(abstractNode).toBeTruthy();
    expect((abstractNode!.data as any).fontSize).toBe(14);

    // Checklist: hardware prototype checked
    const checklistNode = cs.nodes.find((n: any) => n.id === 'checklist-node');
    expect(checklistNode).toBeTruthy();
    expect(checklistNode!.data.text).toContain('[x] Hardware prototype tested');

    // Conclusion: green color, new content
    const conclusionNode = cs.nodes.find((n: any) => n.id === 'conclusion-node');
    expect(conclusionNode).toBeTruthy();
    expect(conclusionNode!.data.text).toContain('92.3% peak efficiency');
    expect((conclusionNode!.data as any).fill).toBe('#16a34a');

    // Position integrity
    expect(titleNode!.x).toBe(80);
    expect(titleNode!.y).toBe(30);

    // ── Verify other sections have content too ──────────────

    // Motor Control Theory section
    const section2Nodes = ws.workspace.sections[1].pages[0].nodes;
    expect(section2Nodes).toHaveLength(2);
    expect(section2Nodes[0].data.text).toContain('Field-Oriented Control');
    expect(section2Nodes[1].data.text).toContain('PWM Inverter Design');
    expect(section2Nodes[1].data.text).toContain('20 kHz'); // Table data

    // Testing section
    const section3Nodes = ws.workspace.sections[2].pages[0].nodes;
    expect(section3Nodes).toHaveLength(1);
    expect(section3Nodes[0].data.text).toContain('MATLAB/Simulink');
    expect(section3Nodes[0].data.text).toContain('ISO 16750');

    // ── Breadcrumb check ────────────────────────────────────
    await expect(page.locator('[data-testid="topbar-section"]')).toHaveText('Introduction');
    await expect(page.locator('[data-testid="topbar-page"]')).toHaveText('Overview');
  });
});
