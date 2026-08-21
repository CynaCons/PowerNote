/**
 * Test 185: Convert to editable nodes
 * Covers: REQ-DIAG-155
 *
 * The deliberate reverse of the snapshot default: right-click → Convert runs
 * the transpiler over the stored source, lands members, drops `render` — and
 * ONE undo restores the snapshot. The gradient cell is beyond the converter's
 * subset, so the toast reports a skip; what survives becomes real members.
 */
import { test, expect } from '@playwright/test';
import { getCanvasStore, runBridge, waitForBridgeReady, waitForCanvasReady } from '../helpers';

const SOURCE = `<mxfile><diagram name="p1"><mxGraphModel><root>
<mxCell id="0"/><mxCell id="1" parent="0"/>
<mxCell id="a" value="Plain" style="rounded=1;fillColor=#dae8fc;" vertex="1" parent="1"><mxGeometry x="0" y="0" width="140" height="50" as="geometry"/></mxCell>
<mxCell id="b" value="Shiny" style="fillColor=#d5e8d4;gradientColor=#97d077;" vertex="1" parent="1"><mxGeometry x="240" y="120" width="140" height="50" as="geometry"/></mxCell>
<mxCell id="e" style="endArrow=classic;" edge="1" parent="1" source="a" target="b"><mxGeometry relative="1" as="geometry"/></mxCell>
</root></mxGraphModel></diagram></mxfile>`;

test.describe('185 - convert snapshot to editable nodes (REQ-DIAG-155)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForCanvasReady(page);
    await waitForBridgeReady(page);
  });

  test('convert lands members, drops render; one undo restores the snapshot', async ({ page }) => {
    const drawn = await runBridge(page, 'create_diagram', {
      source: SOURCE,
      title: 'Convert me',
      format: 'drawio',
    });
    expect(drawn.renderMode).toBe('snapshot');

    const target = await page.evaluate((id) => {
      const container = document.querySelector('[data-testid="canvas-container"]') as HTMLElement;
      const rect = container.getBoundingClientRect();
      const state = (window as any).__POWERNOTE_STORES__.canvas.getState();
      const frame = state.nodes.find((n: any) => n.id === id);
      const vp = state.viewport;
      return {
        x: rect.left + vp.x + (frame.x + frame.width / 2) * vp.scale,
        y: rect.top + vp.y + (frame.y + frame.height / 2) * vp.scale,
      };
    }, drawn.diagramId);

    await page.mouse.click(target.x, target.y, { button: 'right' });
    await page.getByTestId('context-convert-nodes').click();

    await page.waitForFunction((id) => {
      const s = (window as any).__POWERNOTE_STORES__.canvas.getState();
      const frame = s.nodes.find((n: any) => n.id === id);
      return frame && !frame.data.render;
    }, drawn.diagramId);

    let store = await getCanvasStore(page);
    let frame = store.nodes.find((n: any) => n.id === drawn.diagramId);
    let members = store.nodes.filter((n: any) => n.groupId === frame.id && n.id !== frame.id);
    expect(frame.data.render).toBeFalsy();
    // Plain rect + its label + the arrow survive; the gradient cell is skipped.
    expect(members.length).toBeGreaterThan(0);
    const toasts = (await page.getByTestId('toast').allTextContents()).join(' | ');
    expect(toasts).toMatch(/Converted into \d+ editable nodes/);
    expect(toasts).toMatch(/skipped/);

    // The convert already ran under Konva focus; undo via the store to keep
    // the assertion about the BATCH, not about keyboard focus routing.
    await page.keyboard.press('Control+z');
    await page.waitForFunction((id) => {
      const s = (window as any).__POWERNOTE_STORES__.canvas.getState();
      const frame = s.nodes.find((n: any) => n.id === id);
      return frame && Boolean(frame.data.render);
    }, drawn.diagramId);

    store = await getCanvasStore(page);
    frame = store.nodes.find((n: any) => n.id === drawn.diagramId);
    members = store.nodes.filter((n: any) => n.groupId === frame.id && n.id !== frame.id);
    expect(frame.data.render).toBeTruthy();
    expect(members).toHaveLength(0);
  });

  test('the entry only shows for snapshot frames', async ({ page }) => {
    const drawn = await runBridge(page, 'create_diagram', {
      source: SOURCE,
      title: 'Members',
      format: 'drawio',
      render: 'nodes',
    });

    const target = await page.evaluate((id) => {
      const container = document.querySelector('[data-testid="canvas-container"]') as HTMLElement;
      const rect = container.getBoundingClientRect();
      const state = (window as any).__POWERNOTE_STORES__.canvas.getState();
      const frame = state.nodes.find((n: any) => n.id === id);
      const vp = state.viewport;
      return {
        x: rect.left + vp.x + (frame.x + 10) * vp.scale,
        y: rect.top + vp.y + (frame.y + 10) * vp.scale,
      };
    }, drawn.diagramId);

    await page.mouse.click(target.x, target.y, { button: 'right' });
    await expect(page.getByTestId('context-menu')).toBeVisible();
    await expect(page.getByTestId('context-convert-nodes')).toHaveCount(0);
  });
});
