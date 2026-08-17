/**
 * Test 147: draw.io edges and the create_diagram_drawio bridge tool
 * Covers: REQ-DIAG-120..126
 *
 * Chunk 1 landed the edge subset and the bridge route. This file pins both
 * halves: the transpiler is exercised in-page (same import technique as T146)
 * so geometry does not depend on fonts or Konva hit-testing, and the three
 * bridge cases drive `create_diagram` the way T121 does.
 */
import { test, expect } from '@playwright/test';
import {
  getCanvasStore,
  waitForCanvasReady,
  waitForBridgeReady,
  runBridge,
  runBridgeExpectingError,
} from '../helpers';

interface Transpiled {
  nodes: any[];
  diagnostics: { line: number; severity: string; message: string }[];
  threw?: string;
}

/**
 * Runs the transpiler in-page with a deterministic text measurer, so geometry
 * assertions do not depend on which fonts the test machine has.
 */
async function transpile(
  page: import('@playwright/test').Page,
  source: string,
  origin: { x: number; y: number } = { x: 100, y: 200 },
): Promise<Transpiled> {
  return page.evaluate(
    async ({ source, origin }) => {
      try {
        const mod = await import('/src/diagram/drawio.ts');
        const result = mod.transpileDrawio(source, {
          groupId: 'drawio-group',
          origin,
          measureText: (text: string, fontSize: number) => text.length * fontSize * 0.5,
        });
        return { ...result, threw: undefined };
      } catch (err) {
        return {
          nodes: [],
          diagnostics: [],
          threw: err instanceof Error ? err.message : String(err),
        };
      }
    },
    { source, origin },
  );
}

const messages = (r: Transpiled) => r.diagnostics.map((d) => d.message).join('\n');

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
  value = '',
  parent = '1',
): string {
  return `<mxCell id="${id}" value="${value}" style="${style}" vertex="1" parent="${parent}">
    <mxGeometry x="${geo.x}" y="${geo.y}" width="${geo.w}" height="${geo.h}" as="geometry"/>
  </mxCell>`;
}

function edge(
  id: string,
  style: string,
  opts: {
    source?: string;
    target?: string;
    value?: string;
    parent?: string;
    points?: { x: number; y: number }[];
    sourcePoint?: { x: number; y: number };
    targetPoint?: { x: number; y: number };
  } = {},
): string {
  const src = opts.source ? ` source="${opts.source}"` : '';
  const tgt = opts.target ? ` target="${opts.target}"` : '';
  const val = opts.value != null ? ` value="${opts.value}"` : '';
  const parent = opts.parent ?? '1';
  const bits: string[] = [];
  if (opts.sourcePoint) {
    bits.push(`<mxPoint x="${opts.sourcePoint.x}" y="${opts.sourcePoint.y}" as="sourcePoint"/>`);
  }
  if (opts.points?.length) {
    bits.push(
      `<Array as="points">${opts.points.map((p) => `<mxPoint x="${p.x}" y="${p.y}"/>`).join('')}</Array>`,
    );
  }
  if (opts.targetPoint) {
    bits.push(`<mxPoint x="${opts.targetPoint.x}" y="${opts.targetPoint.y}" as="targetPoint"/>`);
  }
  const inner =
    bits.length > 0
      ? `<mxGeometry relative="1" as="geometry">${bits.join('')}</mxGeometry>`
      : `<mxGeometry relative="1" as="geometry"/>`;
  return `<mxCell id="${id}"${val} style="${style}" edge="1" parent="${parent}"${src}${tgt}>${inner}</mxCell>`;
}

const TWO_BOXES =
  vertex('a', 'fillColor=#aaaaaa;', { x: 0, y: 0, w: 40, h: 30 }) +
  vertex('b', 'fillColor=#bbbbbb;', { x: 120, y: 0, w: 40, h: 30 });

test.describe('147 - draw.io edges and tool (REQ-DIAG-120..126)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForCanvasReady(page);
  });

  test('a straight connected edge lands as an arrow from border to border, not centre to centre', async ({
    page,
  }) => {
    const r = await transpile(
      page,
      mxfile(TWO_BOXES + edge('e1', 'endArrow=classic;html=1;', { source: 'a', target: 'b' })),
    );

    expect(r.threw).toBeUndefined();
    expect(r.diagnostics).toEqual([]);
    const rects = r.nodes.filter((n) => n.type === 'shape' && n.data.shapeType === 'rect');
    const arrows = r.nodes.filter((n) => n.type === 'shape' && n.data.shapeType === 'arrow');
    expect(rects).toHaveLength(2);
    expect(arrows).toHaveLength(1);
    expect(r.nodes.some((n) => n.data.shapeType === 'line')).toBe(false);

    // a at (0,0) 40×30, b at (120,0) 40×30, origin (100,200).
    // Centres (120, 215) → (240, 215). Clip at the facing borders x=140 and x=220.
    // A centre-to-centre arrow would start at x=120 and be 120 wide.
    const arrow = arrows[0];
    expect(arrow.x).toBeCloseTo(140);
    expect(arrow.y).toBeCloseTo(215);
    expect(arrow.width).toBeCloseTo(80);
    expect(arrow.height).toBeCloseTo(0);
    expect(arrow.data.fill).toBe('transparent');
    expect(arrow.x).not.toBeCloseTo(120);
    expect(arrow.width).not.toBeCloseTo(120);
  });

  test('endArrow=none is a line, and dashed / strokeColor / strokeWidth map on the edge', async ({
    page,
  }) => {
    const r = await transpile(
      page,
      mxfile(
        TWO_BOXES +
          edge('e1', 'endArrow=none;dashed=1;dashPattern=6 3;strokeColor=#003366;strokeWidth=2;', {
            source: 'a',
            target: 'b',
          }),
      ),
    );

    expect(r.threw).toBeUndefined();
    expect(r.diagnostics).toEqual([]);
    const links = r.nodes.filter(
      (n) => n.type === 'shape' && (n.data.shapeType === 'line' || n.data.shapeType === 'arrow'),
    );
    expect(links).toHaveLength(1);
    expect(links[0].data.shapeType).toBe('line');
    expect(links[0].data).toMatchObject({
      stroke: '#003366',
      strokeWidth: 2,
      strokeDash: [6, 3],
      fill: 'transparent',
    });
    // Same clip as the headed case — paint must not change geometry.
    expect(links[0].x).toBeCloseTo(140);
    expect(links[0].width).toBeCloseTo(80);
  });

  test('a waypointed orthogonal edge splits into straight segments, arrow only on the last, label on the longest midpoint', async ({
    page,
  }) => {
    // A (0,0) 40×30, B (160,120) 40×30. Waypoints (100,15) and (100,135) sit
    // outside both boxes so clipping is unambiguous.
    // Clipped path: (40,15) → (100,15) → (100,135) → (160,135).
    // Lengths 60 / 120 / 60 — the vertical is longest; its midpoint is (100, 75).
    const boxes =
      vertex('a', 'fillColor=#aaaaaa;', { x: 0, y: 0, w: 40, h: 30 }) +
      vertex('b', 'fillColor=#bbbbbb;', { x: 160, y: 120, w: 40, h: 30 });
    const points = [
      { x: 100, y: 15 },
      { x: 100, y: 135 },
    ];

    const fromValue = await transpile(
      page,
      mxfile(
        boxes +
          edge('e1', 'edgeStyle=orthogonalEdgeStyle;endArrow=classic;html=1;', {
            source: 'a',
            target: 'b',
            value: 'Queue',
            points,
          }),
      ),
    );

    expect(fromValue.threw).toBeUndefined();
    expect(fromValue.diagnostics).toEqual([]);
    const valueSegs = fromValue.nodes.filter(
      (n) => n.type === 'shape' && (n.data.shapeType === 'line' || n.data.shapeType === 'arrow'),
    );
    expect(valueSegs).toHaveLength(3);
    expect(valueSegs.map((n) => n.data.shapeType)).toEqual(['line', 'line', 'arrow']);
    expect(valueSegs[0]).toMatchObject({ x: 140, y: 215, width: 60, height: 0 });
    expect(valueSegs[1]).toMatchObject({ x: 200, y: 215, width: 0, height: 120 });
    expect(valueSegs[2]).toMatchObject({ x: 200, y: 335, width: 60, height: 0 });

    const valueLabel = fromValue.nodes.find((n) => n.type === 'text');
    expect(valueLabel?.data.text).toBe('Queue');
    expect(valueLabel!.x + valueLabel!.width / 2).toBeCloseTo(200);
    expect(valueLabel!.y + valueLabel!.height / 2).toBeCloseTo(275);

    const fromChild = await transpile(
      page,
      mxfile(
        boxes +
          edge('e1', 'edgeStyle=orthogonalEdgeStyle;endArrow=classic;html=1;', {
            source: 'a',
            target: 'b',
            points,
          }) +
          `<mxCell id="elab" value="ChildLab" style="edgeLabel;html=1;align=center;" vertex="1" connectable="0" parent="e1">
             <mxGeometry relative="1" as="geometry"/>
           </mxCell>`,
      ),
    );

    expect(fromChild.threw).toBeUndefined();
    expect(fromChild.diagnostics).toEqual([]);
    const childSegs = fromChild.nodes.filter(
      (n) => n.type === 'shape' && (n.data.shapeType === 'line' || n.data.shapeType === 'arrow'),
    );
    expect(childSegs).toHaveLength(3);
    expect(childSegs.map((n) => n.data.shapeType)).toEqual(['line', 'line', 'arrow']);
    const childLabel = fromChild.nodes.find((n) => n.type === 'text');
    expect(childLabel?.data.text).toBe('ChildLab');
    expect(childLabel!.x + childLabel!.width / 2).toBeCloseTo(200);
    expect(childLabel!.y + childLabel!.height / 2).toBeCloseTo(275);
    // The child cell is an edge label, not a second vertex next to the boxes.
    expect(fromChild.nodes.filter((n) => n.type === 'shape' && n.data.shapeType === 'rect')).toHaveLength(
      2,
    );
  });

  test('floating terminals (explicit mxPoints, no source/target cells) are used directly', async ({
    page,
  }) => {
    const r = await transpile(
      page,
      mxfile(
        edge('e1', 'endArrow=classic;html=1;', {
          sourcePoint: { x: 10, y: 20 },
          targetPoint: { x: 110, y: 20 },
        }),
      ),
    );

    expect(r.threw).toBeUndefined();
    expect(r.diagnostics).toEqual([]);
    expect(r.nodes).toHaveLength(1);
    const arrow = r.nodes[0];
    expect(arrow.data.shapeType).toBe('arrow');
    expect({ x: arrow.x, y: arrow.y, width: arrow.width, height: arrow.height }).toEqual({
      x: 110,
      y: 220,
      width: 100,
      height: 0,
    });
  });

  test('startArrow classic with endArrow=none reverses; classic+end and diamond are refused by name', async ({
    page,
  }) => {
    const reversed = await transpile(
      page,
      mxfile(
        TWO_BOXES +
          edge('e1', 'startArrow=classic;endArrow=none;html=1;', { source: 'a', target: 'b' }),
      ),
    );

    expect(reversed.threw).toBeUndefined();
    expect(reversed.diagnostics).toEqual([]);
    const arrows = reversed.nodes.filter((n) => n.type === 'shape' && n.data.shapeType === 'arrow');
    expect(arrows).toHaveLength(1);
    // Forward clip is (40,15)→(120,15). Reversed, the head sits at the source
    // border: (120,15)→(40,15) → canvas (220, 215) with signed (−80, 0).
    expect(arrows[0].x).toBeCloseTo(220);
    expect(arrows[0].y).toBeCloseTo(215);
    expect(arrows[0].width).toBeCloseTo(-80);
    expect(arrows[0].height).toBeCloseTo(0);
    expect(reversed.nodes.some((n) => n.data.shapeType === 'line')).toBe(false);

    const both = await transpile(
      page,
      mxfile(
        TWO_BOXES +
          vertex('ok', 'fillColor=#00ff00;', { x: 0, y: 80, w: 40, h: 30 }) +
          edge('e2', 'startArrow=classic;endArrow=classic;html=1;', { source: 'a', target: 'b' }),
      ),
    );
    expect(both.threw).toBeUndefined();
    expect(messages(both)).toMatch(/startArrow=classic/i);
    expect(messages(both)).toMatch(/double-headed/i);
    expect(both.nodes.some((n) => n.type === 'shape' && n.data.shapeType === 'arrow')).toBe(false);
    expect(both.nodes.some((n) => n.data.fill === '#00ff00')).toBe(true);

    const diamond = await transpile(
      page,
      mxfile(
        TWO_BOXES +
          vertex('ok', 'fillColor=#00ff00;', { x: 0, y: 80, w: 40, h: 30 }) +
          edge('e3', 'startArrow=diamond;endArrow=none;html=1;', { source: 'a', target: 'b' }),
      ),
    );
    expect(diamond.threw).toBeUndefined();
    expect(messages(diamond)).toContain('diamond');
    expect(messages(diamond)).toMatch(/startArrow=diamond/i);
    expect(diamond.nodes.some((n) => n.type === 'shape' && n.data.shapeType === 'arrow')).toBe(false);
    expect(diamond.nodes.some((n) => n.data.fill === '#00ff00')).toBe(true);
  });

  test('curved, rounded-with-waypoints and router-without-waypoints are refused by name; rounded on a 2-point edge is a no-op', async ({
    page,
  }) => {
    const refused = await transpile(
      page,
      mxfile(
        TWO_BOXES +
          vertex('ok', 'fillColor=#00ff00;', { x: 0, y: 80, w: 40, h: 30 }) +
          edge('curve', 'curved=1;endArrow=classic;html=1;', { source: 'a', target: 'b' }) +
          edge('fillet', 'rounded=1;endArrow=classic;html=1;', {
            source: 'a',
            target: 'b',
            points: [
              { x: 80, y: 15 },
              { x: 80, y: 60 },
            ],
          }) +
          edge('router', 'edgeStyle=orthogonalEdgeStyle;endArrow=classic;html=1;', {
            source: 'a',
            target: 'b',
          }),
      ),
    );

    expect(refused.threw).toBeUndefined();
    const all = messages(refused);
    expect(all).toContain('curved=1');
    expect(all).toMatch(/rounded/i);
    expect(all).toMatch(/edgeStyle=orthogonalEdgeStyle/i);
    expect(all).toMatch(/waypoint/i);
    expect(refused.diagnostics.filter((d) => d.severity === 'error').length).toBeGreaterThanOrEqual(3);
    expect(refused.nodes.some((n) => n.data.shapeType === 'arrow' || n.data.shapeType === 'line')).toBe(
      false,
    );
    // Refusing is not the same as giving up: the plain rect still lands.
    expect(refused.nodes.filter((n) => n.type === 'shape' && n.data.fill === '#00ff00')).toHaveLength(1);
    expect(refused.nodes.filter((n) => n.type === 'shape' && n.data.shapeType === 'rect').length).toBeGreaterThanOrEqual(
      3,
    );

    const twoPointRounded = await transpile(
      page,
      mxfile(
        TWO_BOXES + edge('e1', 'rounded=1;endArrow=classic;html=1;', { source: 'a', target: 'b' }),
      ),
    );
    expect(twoPointRounded.threw).toBeUndefined();
    expect(messages(twoPointRounded)).not.toMatch(/rounded/i);
    expect(twoPointRounded.diagnostics).toEqual([]);
    const arrows = twoPointRounded.nodes.filter(
      (n) => n.type === 'shape' && n.data.shapeType === 'arrow',
    );
    expect(arrows).toHaveLength(1);
    expect(arrows[0].x).toBeCloseTo(140);
    expect(arrows[0].width).toBeCloseTo(80);
  });

  test('create_diagram with format drawio draws a two-rect-one-edge frame and stores the XML', async ({
    page,
  }) => {
    await waitForBridgeReady(page);
    const source = mxfile(
      TWO_BOXES + edge('e1', 'endArrow=classic;html=1;', { source: 'a', target: 'b' }),
    );

    const result = await runBridge(page, 'create_diagram', {
      source,
      title: 'Two boxes',
      format: 'drawio',
    });

    expect(result.format).toBe('drawio');
    expect(result.title).toBe('Two boxes');
    expect(result.diagramId).toBeTruthy();
    // Two rects + one arrow. No labels.
    expect(result.elementCount).toBe(3);

    const store = await getCanvasStore(page);
    const frame = store.nodes.find((n: any) => n.id === result.diagramId);
    expect(frame.type).toBe('diagram');
    expect(frame.data.source).toBe(source);
    expect(frame.data.source).toMatch(/<mxfile[\s>]/i);

    const members = store.nodes.filter((n: any) => n.groupId === result.diagramId && n.id !== frame.id);
    expect(members).toHaveLength(result.elementCount);
    expect(members.every((n: any) => n.type === 'shape' || n.type === 'text')).toBe(true);
    expect(members.filter((n: any) => n.data.shapeType === 'rect')).toHaveLength(2);
    expect(members.filter((n: any) => n.data.shapeType === 'arrow')).toHaveLength(1);
  });

  test('a compressed draw.io source succeeds and the stored source is readable XML', async ({
    page,
  }) => {
    await waitForBridgeReady(page);

    const compressed = await page.evaluate(async () => {
      const inner = `<mxGraphModel>
      <root>
        <mxCell id="0"/>
        <mxCell id="1" parent="0"/>
        <mxCell id="a" value="" style="fillColor=#aaaaaa;" vertex="1" parent="1">
          <mxGeometry x="0" y="0" width="40" height="30" as="geometry"/>
        </mxCell>
        <mxCell id="b" value="" style="fillColor=#bbbbbb;" vertex="1" parent="1">
          <mxGeometry x="120" y="0" width="40" height="30" as="geometry"/>
        </mxCell>
        <mxCell id="e1" style="endArrow=classic;html=1;" edge="1" parent="1" source="a" target="b">
          <mxGeometry relative="1" as="geometry"/>
        </mxCell>
      </root>
    </mxGraphModel>`;
      const encoded = encodeURIComponent(inner);
      const stream = new Blob([encoded]).stream().pipeThrough(new CompressionStream('deflate-raw'));
      const buf = await new Response(stream).arrayBuffer();
      const bytes = new Uint8Array(buf);
      let bin = '';
      for (const b of bytes) bin += String.fromCharCode(b);
      const payload = btoa(bin);
      return `<mxfile host="app.diagrams.net"><diagram name="Page-1" id="page1">${payload}</diagram></mxfile>`;
    });

    // The fixture really is a base64 blob inside the diagram, not already XML.
    expect(compressed).toMatch(/<diagram[^>]*>[A-Za-z0-9+/=]+<\/diagram>/);

    const result = await runBridge(page, 'create_diagram', {
      source: compressed,
      title: 'Packed',
      format: 'drawio',
    });

    expect(result.elementCount).toBe(3);

    const store = await getCanvasStore(page);
    const frame = store.nodes.find((n: any) => n.id === result.diagramId);
    const stored: string = frame.data.source;
    expect(stored.trimStart()).toMatch(/^<(mxfile|mxGraphModel)\b/i);
    expect(stored).toMatch(/<mxGraphModel/i);
    expect(stored).toContain('fillColor=#aaaaaa');
    // Not the base64 payload: a compressed page is a long run of [A-Za-z0-9+/=]
    // with no mxCell tags.
    expect(stored).toContain('<mxCell');
    expect(stored).not.toBe(compressed);
  });

  test('declared format drawio with a Mermaid source is refused with the mismatch error', async ({
    page,
  }) => {
    await waitForBridgeReady(page);

    const err = await runBridgeExpectingError(page, 'create_diagram', {
      source: 'flowchart LR\nA[Read sensor] --> B[Send]',
      format: 'drawio',
    });

    expect(err.code).toBe('PRECONDITION');
    expect(err.message).toMatch(/Mermaid/i);
    expect(err.message).toMatch(/draw\.io/i);

    const store = await getCanvasStore(page);
    expect(store.nodes.filter((n: any) => n.type === 'diagram')).toHaveLength(0);
  });
});
