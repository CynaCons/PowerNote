/**
 * Test 149: draw.io round-trip export
 * Covers: REQ-DIAG-130..135
 *
 * In-page, like T146/T147: the exporter and transpiler are imported as modules
 * so geometry does not depend on Konva hit-testing. The UI case is the one
 * exception — it opens the real context menu and waits for a download.
 */
import { test, expect } from '@playwright/test';
import { disableFSA, getCanvasStore, waitForCanvasReady } from '../helpers';

interface Exported {
  xml: string;
  report: string[];
}

interface Transpiled {
  nodes: any[];
  diagnostics: { line: number; severity: string; message: string }[];
}

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
  style: string,
  geo: { x: number; y: number; w: number; h: number },
): string {
  return `<mxCell id="${id}" value="" style="${style}" vertex="1" parent="1">
    <mxGeometry x="${geo.x}" y="${geo.y}" width="${geo.w}" height="${geo.h}" as="geometry"/>
  </mxCell>`;
}

function edge(
  id: string,
  style: string,
  opts: { source?: string; target?: string } = {},
): string {
  const src = opts.source ? ` source="${opts.source}"` : '';
  const tgt = opts.target ? ` target="${opts.target}"` : '';
  return `<mxCell id="${id}" style="${style}" edge="1" parent="1"${src}${tgt}>
    <mxGeometry relative="1" as="geometry"/>
  </mxCell>`;
}

const TWO_BOXES_ONE_EDGE = mxfile(
  vertex('a', 'fillColor=#aaaaaa;', { x: 0, y: 0, w: 40, h: 30 }) +
    vertex('b', 'fillColor=#bbbbbb;', { x: 120, y: 0, w: 40, h: 30 }) +
    edge('e1', 'endArrow=classic;html=1;', { source: 'a', target: 'b' }),
);

async function placeDrawio(
  page: import('@playwright/test').Page,
  source: string,
  title = 'Two boxes',
) {
  return page.evaluate(
    async ({ source, title }) => {
      const { placeDiagramOnCanvas } = await import('/src/diagram/canvasOps.ts');
      return placeDiagramOnCanvas({ x: 200, y: 150, source, title, format: 'drawio' });
    },
    { source, title },
  );
}

async function exportOf(
  page: import('@playwright/test').Page,
  frameOrGroupId: string,
): Promise<Exported> {
  return page.evaluate(async (id) => {
    const mod = await import('/src/diagram/drawioExport.ts');
    const nodes = (window as any).__POWERNOTE_STORES__.canvas.getState().nodes;
    return mod.exportDrawio(id, nodes);
  }, frameOrGroupId);
}

async function transpileXml(
  page: import('@playwright/test').Page,
  source: string,
  origin: { x: number; y: number } = { x: 0, y: 0 },
): Promise<Transpiled> {
  return page.evaluate(
    async ({ source, origin }) => {
      const mod = await import('/src/diagram/drawio.ts');
      return mod.transpileDrawio(source, {
        groupId: 'reimport',
        origin,
        measureText: (text: string, fontSize: number) => text.length * fontSize * 0.5,
      });
    },
    { source, origin },
  );
}

function shapeKind(n: any): string {
  return n.type === 'text' ? 'text' : n.data?.shapeType;
}

/**
 * Match each `got` mark to a unique `want` mark: same kind, geometry ±0.5,
 * same fill (and stroke when both have one). Used for the mapped closure
 * contract — ids and layers are not part of the drawing.
 */
function assertSameSet(got: any[], want: any[]) {
  expect(got).toHaveLength(want.length);
  const used = new Array(want.length).fill(false);
  for (const left of got) {
    const idx = want.findIndex((right, i) => {
      if (used[i]) return false;
      if (shapeKind(left) !== shapeKind(right)) return false;
      if (Math.abs(left.x - right.x) > 0.5) return false;
      if (Math.abs(left.y - right.y) > 0.5) return false;
      if (Math.abs(left.width - right.width) > 0.5) return false;
      if (Math.abs(left.height - right.height) > 0.5) return false;
      if ((left.data?.fill ?? '').toLowerCase() !== (right.data?.fill ?? '').toLowerCase()) return false;
      return true;
    });
    expect(idx, `no match for ${shapeKind(left)} at (${left.x},${left.y})`).toBeGreaterThanOrEqual(0);
    used[idx] = true;
  }
}

function translateToOrigin(nodes: any[]): any[] {
  let minX = Infinity;
  let minY = Infinity;
  for (const n of nodes) {
    const link = n.data?.shapeType === 'line' || n.data?.shapeType === 'arrow';
    const x2 = link ? n.x + n.width : n.x;
    const y2 = link ? n.y + n.height : n.y;
    minX = Math.min(minX, n.x, x2);
    minY = Math.min(minY, n.y, y2);
  }
  if (!Number.isFinite(minX)) return nodes;
  return nodes.map((n) => ({ ...n, x: n.x - minX, y: n.y - minY }));
}

test.describe('149 - draw.io export (REQ-DIAG-130..135)', () => {
  test.beforeEach(async ({ page }) => {
    await disableFSA(page);
    await page.goto('/');
    await waitForCanvasReady(page);
  });

  test('unedited import exports the stored XML verbatim', async ({ page }) => {
    const placed = await placeDrawio(page, TWO_BOXES_ONE_EDGE, 'Two boxes');
    expect(placed.placed).toBe(true);
    expect(placed.elementCount).toBe(3);

    const store = await getCanvasStore(page);
    const frame = store.nodes.find((n: any) => n.id === placed.frameId);
    expect(frame.data.source).toBe(TWO_BOXES_ONE_EDGE);

    const exported = await exportOf(page, placed.frameId);
    expect(exported.report).toEqual([]);
    expect(exported.xml).toBe(TWO_BOXES_ONE_EDGE);
    expect(exported.xml).toBe(frame.data.source);
  });

  test('editing a member drops to the mapped tier; re-import recovers the current set', async ({
    page,
  }) => {
    const placed = await placeDrawio(page, TWO_BOXES_ONE_EDGE, 'Two boxes');
    expect(placed.placed).toBe(true);

    await page.evaluate((frameId) => {
      const canvas = (window as any).__POWERNOTE_STORES__.canvas;
      const rect = canvas
        .getState()
        .nodes.find(
          (n: any) =>
            n.groupId === frameId && n.id !== frameId && n.data?.shapeType === 'rect',
        );
      canvas.getState().updateNode(rect.id, { x: rect.x + 24, y: rect.y + 10 });
    }, placed.frameId);

    const exported = await exportOf(page, placed.frameId);
    expect(exported.xml).not.toBe(TWO_BOXES_ONE_EDGE);
    expect(exported.xml).toMatch(/<mxfile[\s>]/i);
    expect(exported.xml).toMatch(/<mxGraphModel[\s>]/i);

    const store = await getCanvasStore(page);
    const members = store.nodes.filter(
      (n: any) => n.groupId === placed.frameId && n.id !== placed.frameId,
    );
    const reimported = await transpileXml(page, exported.xml, { x: 0, y: 0 });
    expect(reimported.diagnostics).toEqual([]);
    assertSameSet(reimported.nodes, translateToOrigin(members));
  });

  test('a plain group of two rects and a line re-imports to the same shapes', async ({ page }) => {
    const gid = 'grp_export_plain';
    await page.evaluate((groupId) => {
      const add = (window as any).__POWERNOTE_STORES__.canvas.getState().addNode;
      add({
        id: 'r1',
        type: 'shape',
        x: 100,
        y: 100,
        width: 40,
        height: 30,
        layer: 3,
        groupId,
        data: {
          shapeType: 'rect',
          fill: '#ff0000',
          stroke: '#14181a',
          strokeWidth: 1,
          strokeDash: [],
        },
      });
      add({
        id: 'r2',
        type: 'shape',
        x: 200,
        y: 100,
        width: 40,
        height: 30,
        layer: 3,
        groupId,
        data: {
          shapeType: 'rect',
          fill: '#00ff00',
          stroke: '#14181a',
          strokeWidth: 1,
          strokeDash: [],
        },
      });
      add({
        id: 'ln',
        type: 'shape',
        x: 140,
        y: 115,
        width: 60,
        height: 0,
        layer: 3,
        groupId,
        data: {
          shapeType: 'line',
          fill: 'transparent',
          stroke: '#14181a',
          strokeWidth: 1,
          strokeDash: [],
        },
      });
    }, gid);

    const exported = await exportOf(page, gid);
    expect(exported.xml).toMatch(/<mxfile[\s>]/i);
    expect(exported.xml).toMatch(/<mxGraphModel[\s>]/i);
    expect(exported.xml).toMatch(/edge="1"/);
    expect(exported.report).toEqual([]);

    const store = await getCanvasStore(page);
    const members = store.nodes.filter((n: any) => n.groupId === gid);
    const reimported = await transpileXml(page, exported.xml);
    expect(reimported.diagnostics).toEqual([]);
    assertSameSet(reimported.nodes, translateToOrigin(members));
    expect(reimported.nodes.filter((n) => n.data?.shapeType === 'rect')).toHaveLength(2);
    expect(reimported.nodes.filter((n) => n.data?.shapeType === 'line')).toHaveLength(1);
  });

  test('cornerRadius, dash and rotation survive export then import', async ({ page }) => {
    const gid = 'grp_export_style';
    await page.evaluate((groupId) => {
      const add = (window as any).__POWERNOTE_STORES__.canvas.getState().addNode;
      add({
        id: 'rounded-rot',
        type: 'shape',
        x: 80,
        y: 80,
        width: 80,
        height: 60,
        layer: 3,
        groupId,
        data: {
          shapeType: 'rect',
          fill: '#eef1f0',
          stroke: '#14181a',
          strokeWidth: 2,
          strokeDash: [],
          cornerRadius: 12,
          rotation: 30,
        },
      });
      add({
        id: 'dash-line',
        type: 'shape',
        x: 80,
        y: 160,
        width: 100,
        height: 0,
        layer: 3,
        groupId,
        data: {
          shapeType: 'line',
          fill: 'transparent',
          stroke: '#14181a',
          strokeWidth: 2,
          strokeDash: [8, 4],
        },
      });
    }, gid);

    const exported = await exportOf(page, gid);
    expect(exported.xml).toMatch(/rounded=1/);
    expect(exported.xml).toMatch(/arcSize=/);
    expect(exported.xml).toMatch(/dashed=1/);
    expect(exported.xml).toMatch(/dashPattern=8 4/);
    expect(exported.xml).toMatch(/rotation=30/);

    const reimported = await transpileXml(page, exported.xml);
    expect(reimported.diagnostics).toEqual([]);
    const rect = reimported.nodes.find((n) => n.data?.shapeType === 'rect');
    const line = reimported.nodes.find((n) => n.data?.shapeType === 'line');
    expect(rect.data.cornerRadius).toBeCloseTo(12, 5);
    expect(rect.data.rotation).toBeCloseTo(30, 5);
    expect(line.data.strokeDash).toEqual([8, 4]);
  });

  test('an arc is exported as an ellipse placeholder and named in the report', async ({
    page,
  }) => {
    const gid = 'grp_export_arc';
    await page.evaluate((groupId) => {
      (window as any).__POWERNOTE_STORES__.canvas.getState().addNode({
        id: 'socket',
        type: 'shape',
        x: 120,
        y: 120,
        width: 24,
        height: 24,
        layer: 3,
        groupId,
        data: {
          shapeType: 'arc',
          fill: 'transparent',
          stroke: '#14181a',
          strokeWidth: 1.6,
          strokeDash: [],
          rotation: 90,
        },
      });
    }, gid);

    const exported = await exportOf(page, gid);
    expect(exported.report.some((m) => /arc/i.test(m))).toBe(true);
    expect(exported.report.join(' ')).toMatch(/ellipse/i);
    expect(exported.xml).toMatch(/ellipse/);
    expect(exported.xml).toMatch(/fillColor=none/);
    expect(exported.xml).not.toMatch(/shape=arc/);

    const reimported = await transpileXml(page, exported.xml);
    expect(reimported.nodes).toHaveLength(1);
    expect(reimported.nodes[0].data.shapeType).toBe('circle');
  });

  test('the context menu offers Export as .drawio and clicking it downloads', async ({
    page,
  }) => {
    const placed = await placeDrawio(page, TWO_BOXES_ONE_EDGE, 'ExportMe');
    expect(placed.placed).toBe(true);
    await page.locator('.diagram-node__src').first().waitFor({ state: 'visible' });

    const canvas = page.locator('[data-testid="canvas-container"]');
    await canvas.click({ position: { x: 280, y: 165 }, button: 'right' });
    const entry = page.getByTestId('context-export-drawio');
    await expect(entry).toBeVisible();
    await expect(entry).toHaveText(/Export as \.drawio/);

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      entry.click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/ExportMe\.drawio$/);
  });
});
