/**
 * Test 160: read_diagram + on-demand fit_diagram (both directions)
 * Covers: REQ-AGENT-056, REQ-AGENT-057, REQ-DIAG-142
 *
 * Placement-time fit stays shrink-only (T151). The on-demand path fills the
 * band: scale up when under, scale down with the 0.45 floor when over.
 */
import { test, expect } from '@playwright/test';
import {
  getCanvasStore,
  waitForCanvasReady,
  waitForBridgeReady,
  runBridge,
  runBridgeExpectingError,
} from '../helpers';

const SMALL = `@startuml
component "box" as b
@enduml`;

function mxfile(cells: string): string {
  return `<mxfile host="app.diagrams.net">
  <diagram name="Page-1" id="page1">
    <mxGraphModel>
      <root>
        <mxCell id="0"/>
        <mxCell id="1" parent="0"/>
        ${cells}
      </root>
    </mxGraphModel>
  </diagram>
</mxfile>`;
}

function vertex(
  id: string,
  geo: { x: number; y: number; w: number; h: number },
  value: string,
): string {
  return `<mxCell id="${id}" value="${value}" style="rounded=1;whiteSpace=wrap;html=1;" vertex="1" parent="1">
    <mxGeometry x="${geo.x}" y="${geo.y}" width="${geo.w}" height="${geo.h}" as="geometry"/>
  </mxCell>`;
}

const WIDE = mxfile(
  vertex('a', { x: 0, y: 0, w: 160, h: 60 }, 'Left') +
    vertex('b', { x: 1000, y: 0, w: 160, h: 60 }, 'Right'),
);

async function setScrollWidth(
  page: import('@playwright/test').Page,
  width: number,
  title = 'Band',
) {
  await page.evaluate(
    ({ width, title }) => {
      const ws = (window as any).__POWERNOTE_STORES__.workspace.getState();
      const pageId = ws.activePageId;
      const scrolls = (ws.getActivePage()?.scrolls ?? []).map((s: any, i: number) =>
        i === 0 ? { ...s, width, title: s.title || title } : { ...s },
      );
      ws.replacePageScrolls(pageId, scrolls);
    },
    { width, title },
  );
}

test.describe('160 - read_diagram + fit_diagram (REQ-AGENT-056, REQ-DIAG-142)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForCanvasReady(page);
    await waitForBridgeReady(page);
  });

  test('read_diagram returns full detail; refusals name the type', async ({ page }) => {
    const drawn = await runBridge(page, 'create_diagram', {
      source: SMALL,
      title: 'Little box',
    });

    const detail = await runBridge(page, 'read_diagram', { diagramId: drawn.diagramId });
    expect(detail.id).toBe(drawn.diagramId);
    expect(detail.title).toBe('Little box');
    expect(detail.format).toBe('plantuml');
    expect(detail.source).toContain('box');
    expect(detail.memberCount).toBeGreaterThan(0);
    expect(detail.members).toHaveLength(detail.memberCount);
    expect(detail.members[0]).toEqual(
      expect.objectContaining({
        id: expect.any(String),
        type: expect.any(String),
        x: expect.any(Number),
        y: expect.any(Number),
        w: expect.any(Number),
        h: expect.any(Number),
      }),
    );
    expect(detail.bounds.width).toBe(drawn.width);

    const missing = await runBridgeExpectingError(page, 'read_diagram', {
      diagramId: 'no-such-frame',
    });
    expect(missing.code).toBe('NOT_FOUND');

    const block = await runBridge(page, 'append_block', { markdown: 'not a diagram' });
    const wrong = await runBridgeExpectingError(page, 'read_diagram', {
      diagramId: block.blockId,
    });
    expect(wrong.code).toBe('UNSUPPORTED');
    expect(wrong.message).toContain('text');
  });

  test('fit_diagram scales UP to a widened band', async ({ page }) => {
    const drawn = await runBridge(page, 'create_diagram', {
      source: SMALL,
      title: 'Grow me',
    });
    const before = (await getCanvasStore(page)).nodes.find((n: any) => n.id === drawn.diagramId);
    expect(before.width).toBeLessThan(1200);

    await setScrollWidth(page, 1600, 'Wide');
    const fitted = await runBridge(page, 'fit_diagram', { diagramId: drawn.diagramId });
    expect(fitted.scale).toBeGreaterThan(1);
    expect(fitted.width).toBeCloseTo(1600 - 16, 0);

    const after = (await getCanvasStore(page)).nodes.find((n: any) => n.id === drawn.diagramId);
    expect(after.width).toBeCloseTo(1600 - 16, 0);
    expect(after.height).toBeGreaterThan(before.height);
  });

  test('fit_diagram scales DOWN with the 0.45 floor on a narrow band', async ({ page }) => {
    // render:'nodes' — member fit under test; snapshot fit is T179's subject.
    const drawn = await runBridge(page, 'create_diagram', {
      source: WIDE,
      title: 'Shrink me',
      format: 'drawio',
      render: 'nodes',
    });
    const placed = (await getCanvasStore(page)).nodes.find((n: any) => n.id === drawn.diagramId);
    const placedWidth = placed.width;

    await setScrollWidth(page, 180, 'Narrow');
    const fitted = await runBridge(page, 'fit_diagram', { diagramId: drawn.diagramId });
    expect(fitted.scale).toBeCloseTo(0.45, 2);
    expect(fitted.width).toBeCloseTo(placedWidth * 0.45, 0);
  });

  test('out-of-band fit_diagram is PRECONDITION naming the diagram', async ({ page }) => {
    const farX = await page.evaluate(async () => {
      const layout = await import('/src/utils/pageLayout.ts');
      return layout.columnLeft(4);
    });
    const frameId = await page.evaluate(
      ({ source, x }) => {
        const canvas = (window as any).__POWERNOTE_STORES__.canvas.getState();
        canvas.addNode({
          id: 'oob-frame',
          type: 'diagram',
          x,
          y: 80,
          width: 260,
          height: 140,
          layer: 2,
          groupId: 'oob-frame',
          data: { source, title: 'Stranded' },
        });
        const nodes = (window as any).__POWERNOTE_STORES__.canvas.getState().nodes;
        (window as any).__POWERNOTE_STORES__.workspace.getState().savePageNodes(nodes);
        return 'oob-frame';
      },
      { source: SMALL, x: farX },
    );

    const err = await runBridgeExpectingError(page, 'fit_diagram', { diagramId: frameId });
    expect(err.code).toBe('PRECONDITION');
    expect(err.message).toContain('Stranded');
    expect(err.message).toMatch(/not inside a scroll band/i);
  });

  test('context menu offers Fit to scroll width; one undo restores', async ({ page }) => {
    await page.evaluate(() => {
      const canvas = (window as any).__POWERNOTE_STORES__.canvas.getState();
      canvas.addNode({
        id: 'menu-frame',
        type: 'diagram',
        x: 300,
        y: 300,
        width: 260,
        height: 160,
        layer: 2,
        groupId: 'menu-frame',
        data: { source: '', title: 'Menu fit' },
      });
      canvas.addNode({
        id: 'menu-member',
        type: 'shape',
        x: 320,
        y: 350,
        width: 80,
        height: 40,
        layer: 3,
        groupId: 'menu-frame',
        data: {
          shapeType: 'rect',
          fill: '#eef1f0',
          stroke: '#14181a',
          strokeWidth: 1.6,
          strokeDash: [],
        },
      });
      (window as any).__POWERNOTE_STORES__.workspace
        .getState()
        .savePageNodes((window as any).__POWERNOTE_STORES__.canvas.getState().nodes);
    });
    await setScrollWidth(page, 1400, 'Menu band');

    const before = (await getCanvasStore(page)).nodes.find((n: any) => n.id === 'menu-frame');

    const canvas = page.locator('[data-testid="canvas-container"] canvas').last();
    await canvas.click({ position: { x: 360, y: 330 }, button: 'right' });
    await expect(page.getByTestId('context-menu')).toBeVisible();
    await expect(page.getByTestId('context-fit-diagram')).toHaveText('Fit to scroll width');
    await page.getByTestId('context-fit-diagram').click();

    const after = (await getCanvasStore(page)).nodes.find((n: any) => n.id === 'menu-frame');
    expect(after.width).toBeGreaterThan(before.width);
    expect(after.width).toBeCloseTo(1400 - 16, 0);

    await page.evaluate(() => {
      (window as any).__POWERNOTE_STORES__.canvas.getState().undo();
    });
    const restored = (await getCanvasStore(page)).nodes.find((n: any) => n.id === 'menu-frame');
    expect(restored.width).toBeCloseTo(before.width, 0);
    expect(restored.height).toBeCloseTo(before.height, 0);
  });

  test('placement-time fit stays shrink-only (T151 contract)', async ({ page }) => {
    await setScrollWidth(page, 1600, 'Still wide');
    const drawn = await runBridge(page, 'create_diagram', {
      source: SMALL,
      title: 'Do not grow at place',
    });

    const raw = await page.evaluate(async ({ source }) => {
      const ops = await import('/src/diagram/canvasOps.ts');
      const layout = await import('/src/utils/pageLayout.ts');
      const built = ops.rebuildDiagram(
        {
          id: 'probe',
          type: 'diagram',
          x: layout.columnLeft(0),
          y: 48,
          width: 260,
          height: 120,
          layer: 2,
          groupId: 'probe',
          data: { source, title: 'probe' },
        },
        source,
        'plantuml',
      );
      return built.frame.width;
    }, { source: SMALL });

    expect(drawn.width).toBeCloseTo(raw, 0);
    expect(drawn.width).toBeLessThan(1600 - 16);
    expect(drawn.warnings ?? []).toEqual([]);
  });
});
