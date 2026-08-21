/**
 * Test 166: draw.io component diagrams — ports, orthogonal arrows, UML module
 * Covers: REQ-DIAG-143..148
 *
 * The user's loop is: prototype in diagrams.net, drop the .drawio into a
 * notebook. Component diagrams live or die on ports sitting on the parent
 * edge, and on orthogonal connectors that have no waypoints in the file.
 */
import { test, expect } from '@playwright/test';
import { waitForCanvasReady, waitForBridgeReady, runBridge, stubBridgeUrl } from '../helpers';

interface Transpiled {
  nodes: any[];
  diagnostics: { line: number; severity: string; message: string }[];
}

async function transpile(
  page: import('@playwright/test').Page,
  source: string,
  origin: { x: number; y: number } = { x: 0, y: 0 },
): Promise<Transpiled> {
  return page.evaluate(
    async ({ source, origin }) => {
      const mod = await import('/src/diagram/drawio.ts');
      return mod.transpileDrawio(source, {
        groupId: 'g',
        origin,
        measureText: (text: string, fontSize: number) => text.length * fontSize * 0.5,
      });
    },
    { source, origin },
  );
}

function mxfile(cells: string): string {
  return `<mxfile host="app.diagrams.net"><diagram name="Page-1" id="p1">
    <mxGraphModel><root>
      <mxCell id="0"/><mxCell id="1" parent="0"/>
      ${cells}
    </root></mxGraphModel>
  </diagram></mxfile>`;
}

test.describe('166 - draw.io components (REQ-DIAG-143..148)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForCanvasReady(page);
  });

  test('a relative port with offset sits on the parent right edge', async ({ page }) => {
    const r = await transpile(
      page,
      mxfile(`
        <mxCell id="comp" value="Gateway" style="rounded=1;" vertex="1" parent="1">
          <mxGeometry x="40" y="40" width="160" height="80" as="geometry"/>
        </mxCell>
        <mxCell id="pOut" value="" style="shape=port;" vertex="1" parent="comp">
          <mxGeometry x="1" y="0.5" width="10" height="10" relative="1" as="geometry">
            <mxPoint x="-5" y="-5" as="offset"/>
          </mxGeometry>
        </mxCell>
      `),
    );
    expect(r.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    const port = r.nodes.find((n) => n.type === 'shape' && n.width === 10 && n.height === 10);
    expect(port).toBeTruthy();
    // Parent at (40,40) 160×80; relative (1, 0.5) + offset (-5,-5) → (195, 75)
    expect(port.x).toBeCloseTo(40 + 160 - 5);
    expect(port.y).toBeCloseTo(40 + 40 - 5);
  });

  test('orthogonal edge without waypoints is routed, not refused', async ({ page }) => {
    const r = await transpile(
      page,
      mxfile(`
        <mxCell id="a" style="rounded=0;" vertex="1" parent="1">
          <mxGeometry x="0" y="0" width="80" height="40" as="geometry"/>
        </mxCell>
        <mxCell id="b" style="rounded=0;" vertex="1" parent="1">
          <mxGeometry x="200" y="80" width="80" height="40" as="geometry"/>
        </mxCell>
        <mxCell id="e" style="edgeStyle=orthogonalEdgeStyle;endArrow=classic;exitX=1;exitY=0.5;entryX=0;entryY=0.5;" edge="1" parent="1" source="a" target="b">
          <mxGeometry relative="1" as="geometry"/>
        </mxCell>
      `),
    );
    const errors = r.diagnostics.filter((d) => d.severity === 'error');
    expect(errors).toEqual([]);
    expect(r.diagnostics.some((d) => /routed/i.test(d.message))).toBe(true);
    const segs = r.nodes.filter((n) => n.data.shapeType === 'line' || n.data.shapeType === 'arrow');
    expect(segs.length).toBeGreaterThanOrEqual(2);
    expect(segs.some((n) => n.data.shapeType === 'arrow')).toBe(true);
  });

  test('UML module is a box with two left tabs, not a stencil refusal', async ({ page }) => {
    const r = await transpile(
      page,
      mxfile(`
        <mxCell id="m" value="Sensor" style="shape=module;fillColor=#eef1f0;" vertex="1" parent="1">
          <mxGeometry x="10" y="10" width="120" height="70" as="geometry"/>
        </mxCell>
      `),
    );
    expect(r.diagnostics.some((d) => /stencil/i.test(d.message))).toBe(false);
    const rects = r.nodes.filter((n) => n.type === 'shape' && n.data.shapeType === 'rect');
    expect(rects.length).toBe(3);
    const body = rects.find((n) => n.width === 120);
    expect(body).toBeTruthy();
    expect(r.nodes.some((n) => n.type === 'text' && n.data.text === 'Sensor')).toBe(true);
  });

  test('mxgraph.uml.component is drawn as a rectangle with an ignored note', async ({ page }) => {
    const r = await transpile(
      page,
      mxfile(`
        <mxCell id="c" value="Broker" style="shape=mxgraph.uml.component;" vertex="1" parent="1">
          <mxGeometry x="0" y="0" width="100" height="50" as="geometry"/>
        </mxCell>
      `),
    );
    // endsWith .component → module (tabs), not the generic box path
    const rects = r.nodes.filter((n) => n.type === 'shape' && n.data.shapeType === 'rect');
    expect(rects.length).toBeGreaterThanOrEqual(1);
    expect(r.diagnostics.some((d) => d.severity === 'error')).toBe(false);
    expect(r.nodes.some((n) => n.type === 'text' && n.data.text === 'Broker')).toBe(true);
  });

  test('source dialog offers Open file and a draw.io hint after a drawio import', async ({ page }) => {
    await stubBridgeUrl(page);
    await waitForBridgeReady(page);
    const source = mxfile(`
      <mxCell id="a" value="A" style="rounded=1;" vertex="1" parent="1">
        <mxGeometry x="0" y="0" width="80" height="40" as="geometry"/>
      </mxCell>
    `);
    const drawn = await runBridge(page, 'create_diagram', {
      format: 'drawio',
      title: 'From file',
      source,
      render: 'nodes',
    });
    expect(drawn.diagramId).toBeTruthy();
    await page.getByTestId(`diagram-source-btn-${drawn.diagramId}`).click();
    await expect(page.getByTestId('diagram-dialog')).toBeVisible();
    await expect(page.getByTestId('diagram-drawio-hint')).toBeVisible();
    await expect(page.getByTestId('diagram-open-file-btn')).toBeVisible();
  });
});
