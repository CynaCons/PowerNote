/**
 * Test 177: snapshot frames and the source dialog
 * Covers: REQ-DIAG-154, 156
 *
 * Double-click on a snapshot frame opens the source dialog (isolation would
 * dim the page around nothing editable). Redraw is async; drawing a non-drawio
 * source over a snapshot clears `render` and lands members; a frame deleted
 * under the open dialog makes Redraw a no-op rather than a resurrection.
 * Search finds a snapshot diagram by the words in its XML.
 */
import { test, expect } from '@playwright/test';
import { getCanvasStore, runBridge, waitForBridgeReady, waitForCanvasReady } from '../helpers';

const SOURCE = `<mxfile><diagram name="p1"><mxGraphModel><root>
<mxCell id="0"/><mxCell id="1" parent="0"/>
<mxCell id="a" value="ZephyrGateway" style="rounded=1;fillColor=#dae8fc;gradientColor=#7ea6e0;" vertex="1" parent="1"><mxGeometry x="0" y="0" width="150" height="50" as="geometry"/></mxCell>
</root></mxGraphModel></diagram></mxfile>`;

const PLANTUML = `@startuml
component "broker" as b
component "buffer" as q
b --> q : Queue
@enduml`;

test.describe('177 - snapshot frames in the source dialog (REQ-DIAG-154)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForCanvasReady(page);
    await waitForBridgeReady(page);
  });

  async function createSnapshot(page: import('@playwright/test').Page): Promise<string> {
    const drawn = await runBridge(page, 'create_diagram', {
      source: SOURCE,
      title: 'Snap',
      format: 'drawio',
    });
    expect(drawn.renderMode).toBe('snapshot');
    return drawn.diagramId as string;
  }

  test('double-click opens the source dialog, not isolation', async ({ page }) => {
    const id = await createSnapshot(page);

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
    }, id);

    await page.mouse.dblclick(target.x, target.y);

    await expect(page.getByTestId('diagram-dialog')).toBeVisible();
    const isolation = await page.evaluate(
      () => (window as any).__POWERNOTE_STORES__.group.getState().editingGroupId,
    );
    expect(isolation).toBeNull();
  });

  test('a non-drawio redraw over a snapshot clears render and lands members', async ({ page }) => {
    const id = await createSnapshot(page);

    await page.getByTestId(`diagram-source-btn-${id}`).click();
    await expect(page.getByTestId('diagram-dialog')).toBeVisible();

    await page.getByTestId('diagram-source').fill(PLANTUML);
    await page.getByTestId('diagram-apply').click();

    await page.waitForFunction((id) => {
      const s = (window as any).__POWERNOTE_STORES__.canvas.getState();
      const frame = s.nodes.find((n: any) => n.id === id);
      return frame && !frame.data.render;
    }, id);

    const store = await getCanvasStore(page);
    const frame = store.nodes.find((n: any) => n.id === id);
    expect(frame.data.render).toBeFalsy();
    expect(frame.data.source).toContain('@startuml');
    const members = store.nodes.filter((n: any) => n.groupId === id && n.id !== id);
    expect(members.length).toBeGreaterThan(0);
  });

  test('a drawio redraw refreshes the snapshot asynchronously', async ({ page }) => {
    const id = await createSnapshot(page);
    const before = await page.evaluate(
      (id) =>
        (window as any).__POWERNOTE_STORES__.canvas.getState().nodes.find((n: any) => n.id === id)
          .data.render.src as string,
      id,
    );

    await page.getByTestId(`diagram-source-btn-${id}`).click();
    const edited = SOURCE.replace('ZephyrGateway', 'RenamedGateway');
    await page.getByTestId('diagram-source').fill(edited);
    await page.getByTestId('diagram-apply').click();

    await page.waitForFunction(
      ({ id, before }) => {
        const s = (window as any).__POWERNOTE_STORES__.canvas.getState();
        const frame = s.nodes.find((n: any) => n.id === id);
        return frame?.data.render && frame.data.render.src !== before;
      },
      { id, before },
    );

    const store = await getCanvasStore(page);
    const frame = store.nodes.find((n: any) => n.id === id);
    expect(frame.data.source).toContain('RenamedGateway');
    expect(store.nodes.filter((n: any) => n.groupId === id && n.id !== id)).toHaveLength(0);
    await expect(page.getByTestId('diagram-apply')).toHaveText('Redraw');
  });

  test('Redraw on a frame deleted under the dialog is a no-op', async ({ page }) => {
    const id = await createSnapshot(page);
    await page.getByTestId(`diagram-source-btn-${id}`).click();
    await expect(page.getByTestId('diagram-dialog')).toBeVisible();

    await page.evaluate((id) => {
      (window as any).__POWERNOTE_STORES__.canvas.getState().deleteNode(id);
    }, id);

    await page.getByTestId('diagram-apply').click();
    // Nothing reappears, nothing crashes.
    await page.waitForTimeout(400);
    const store = await getCanvasStore(page);
    expect(store.nodes.find((n: any) => n.id === id)).toBeFalsy();
    expect(store.nodes.filter((n: any) => n.type === 'diagram')).toHaveLength(0);
  });

  test('search finds a snapshot diagram by a word in its XML (REQ-DIAG-156)', async ({ page }) => {
    await createSnapshot(page);

    await page.keyboard.press('Control+Shift+f');
    await page.locator('[data-testid="search-input"]').fill('ZephyrGateway');
    await page.waitForTimeout(300);

    expect(await page.locator('[data-testid="search-result"]').count()).toBe(1);
  });
});
