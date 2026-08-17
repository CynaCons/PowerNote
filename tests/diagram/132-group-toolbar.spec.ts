/**
 * Test 132: Group edit is reachable from the selection toolbar
 * Covers: REQ-GROUP-020, REQ-GROUP-021, REQ-GROUP-022, REQ-DIAG-100, REQ-DIAG-101
 *
 * Isolation mode existed long before this, but every way into it was hidden —
 * double-click, Ctrl+Enter, or the context menu — so nothing on screen said the
 * mode was there. Worse, a diagram matched no toolbar context at all, so
 * selecting one produced an empty bar and the frame's only control was a button
 * hardcoded to read "plantuml" whatever language the diagram was written in.
 *
 * These tests pin the visible affordance and the honest label. The format
 * assertions matter most: they are the ones that catch the label going back to
 * a constant, which is invisible to any test that only checks the button works.
 */
import { test, expect } from '@playwright/test';
import { getCanvasStore, waitForCanvasReady } from '../helpers';

const MERMAID = `flowchart LR
  A[Read sensor] --> B[Publish]`;

const SVG = `<svg viewBox="0 0 200 100" xmlns="http://www.w3.org/2000/svg">
  <rect x="10" y="10" width="80" height="40" fill="#eef1f0" stroke="#14181a"/>
  <text x="20" y="35">hello</text>
</svg>`;

/** Places a diagram with the tool, which draws the starter source at once. */
async function place(page: import('@playwright/test').Page) {
  await page.getByTestId('nav-diagram-tool').click();
  await page.locator('[data-testid="canvas-container"]').click({ position: { x: 260, y: 200 } });
  await page.waitForFunction(
    () => (window as any).__POWERNOTE_STORES__.canvas.getState().nodes.length > 1,
  );
}

/** Selects the diagram frame through the store, avoiding canvas hit-testing. */
async function selectFrame(page: import('@playwright/test').Page) {
  await page.evaluate(() => {
    const canvas = (window as any).__POWERNOTE_STORES__.canvas;
    const frame = canvas.getState().nodes.find((n: any) => n.type === 'diagram');
    canvas.setState({ selectedNodeIds: [frame.id] });
  });
}

/** Replaces the frame's source through the dialog and redraws. */
async function redraw(page: import('@playwright/test').Page, source: string) {
  await page.getByTestId('toolbar-diagram-source').click();
  await page.getByTestId('diagram-source').fill(source);
  await page.getByTestId('diagram-apply').click();
}

test.describe('132 - Group edit from the toolbar (REQ-GROUP-020, REQ-DIAG-100)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForCanvasReady(page);
  });

  test('selecting a diagram fills the bar that used to be empty', async ({ page }) => {
    await place(page);
    await selectFrame(page);

    // 'diagram' matches no node-type context, so before the group segment was
    // lifted out of that chain this bar rendered nothing at all.
    await expect(page.getByTestId('bottom-toolbar')).toBeVisible();
    const segment = page.getByTestId('toolbar-group-segment');
    await expect(segment).toBeVisible();
    await expect(segment).toHaveAttribute('data-mode', 'idle');
    await expect(page.getByTestId('toolbar-group-edit')).toHaveText('Edit contents');
  });

  test('the toolbar takes you into isolation and back out', async ({ page }) => {
    await place(page);
    await selectFrame(page);

    await page.getByTestId('toolbar-group-edit').click();

    const groupId = await page.evaluate(
      () => (window as any).__POWERNOTE_STORES__.group.getState().editingGroupId,
    );
    expect(groupId).toBeTruthy();
    await expect(page.getByTestId('toolbar-group-segment')).toHaveAttribute('data-mode', 'editing');

    await page.getByTestId('group-isolation-done').click();
    expect(
      await page.evaluate(
        () => (window as any).__POWERNOTE_STORES__.group.getState().editingGroupId,
      ),
    ).toBeNull();
  });

  test('Done stays reachable while a member, not the frame, is selected', async ({ page }) => {
    await place(page);
    await selectFrame(page);
    await page.getByTestId('toolbar-group-edit').click();

    // Select one shape inside the diagram — the case the old breadcrumb existed
    // for, and the one an "only when the frame is selected" segment would miss.
    await page.evaluate(() => {
      const canvas = (window as any).__POWERNOTE_STORES__.canvas;
      const shape = canvas.getState().nodes.find((n: any) => n.type === 'shape');
      canvas.setState({ selectedNodeIds: [shape.id] });
    });

    await expect(page.getByTestId('group-isolation-done')).toBeVisible();
    await page.getByTestId('group-isolation-done').click();
    expect(
      await page.evaluate(
        () => (window as any).__POWERNOTE_STORES__.group.getState().editingGroupId,
      ),
    ).toBeNull();
  });

  test('the source button names the language the diagram is actually in', async ({ page }) => {
    await place(page);
    await selectFrame(page);

    // Placed from the starter source, which is PlantUML.
    await expect(page.getByTestId('toolbar-diagram-source')).toHaveAttribute(
      'data-format',
      'plantuml',
    );
    await expect(page.locator('.diagram-node__src').first()).toHaveAttribute(
      'data-format',
      'plantuml',
    );

    await redraw(page, MERMAID);
    await selectFrame(page);
    await expect(page.getByTestId('toolbar-diagram-source')).toHaveAttribute(
      'data-format',
      'mermaid',
    );
    await expect(page.locator('.diagram-node__src').first()).toHaveAttribute(
      'data-format',
      'mermaid',
    );
  });

  test('an SVG source redraws, and the frame stops calling itself plantuml', async ({ page }) => {
    await place(page);
    await selectFrame(page);

    await redraw(page, SVG);

    // The redraw has to actually produce marks — a label that says "SVG" over a
    // frame still holding the old PlantUML drawing would be worse than before.
    const store = await getCanvasStore(page);
    const frame = store.nodes.find((n: any) => n.type === 'diagram');
    expect(frame.data.source).toContain('<svg');
    const members = store.nodes.filter(
      (n: any) => n.groupId === frame.id && n.id !== frame.id,
    );
    expect(members.length).toBeGreaterThan(0);
    expect(members.every((n: any) => ['shape', 'text'].includes(n.type))).toBe(true);

    await expect(page.locator('.diagram-node__src').first()).toHaveAttribute('data-format', 'svg');
    await selectFrame(page);
    await expect(page.getByTestId('toolbar-diagram-source')).toHaveAttribute('data-format', 'svg');
    await expect(page.getByTestId('toolbar-diagram-source')).toHaveText('SVG');
  });

  test('a diagram has a context menu, and its layer moves the whole drawing', async ({
    page,
  }) => {
    await place(page);

    // The frame's Rect carries no id until you give it one, and the right-click
    // walk looks the id up to find the node — so a diagram had no menu at all.
    await page.locator('[data-testid="canvas-container"]').click({ position: { x: 300, y: 230 } });
    await page.locator('[data-testid="canvas-container"]').click({
      position: { x: 300, y: 230 },
      button: 'right',
    });
    await expect(page.getByTestId('layer-5')).toBeVisible();
    await page.getByTestId('layer-5').click();

    const state = await page.evaluate(() => {
      const nodes = (window as any).__POWERNOTE_STORES__.canvas.getState().nodes;
      const frame = nodes.find((n: any) => n.type === 'diagram');
      const members = nodes.filter((n: any) => n.groupId === frame.id && n.id !== frame.id);
      return {
        frameLayer: frame.layer,
        // Members must NOT have been shifted: their 2..5 spread is what keeps
        // containers behind entities and links under text.
        memberLayers: [...new Set(members.map((n: any) => n.layer))].sort(),
      };
    });
    expect(state.frameLayer).toBe(5);
    expect(state.memberLayers.length).toBeGreaterThan(1);
  });

  test('a plain ungrouped node offers nothing to step into', async ({ page }) => {
    // Added through the store rather than drawn: what is under test is the
    // segment's visibility rule, not shape creation.
    await page.evaluate(() => {
      const canvas = (window as any).__POWERNOTE_STORES__.canvas;
      const id = 'lone-shape';
      canvas.getState().addNode({
        id,
        type: 'shape',
        x: 300,
        y: 250,
        width: 120,
        height: 80,
        layer: 3,
        data: {
          shapeType: 'rect',
          fill: '#ffffff',
          stroke: '#14181a',
          strokeWidth: 2,
          strokeDash: [],
        },
      });
      canvas.setState({ selectedNodeIds: [id] });
    });

    await expect(page.getByTestId('toolbar-group-segment')).toHaveCount(0);
  });
});
