/**
 * Test 146: draw.io transpiled to native canvas nodes
 * Covers: REQ-DIAG-110..119
 *
 * The module is exercised directly rather than through the canvas, because what
 * is under test is a pure function: mxGraph XML in, ShapeNode/TextNode out. Two
 * things matter and are checked separately — that the subset we claim maps
 * lands where it should, and that everything outside the subset is refused by
 * name instead of being dropped quietly or approximated.
 */
import { test, expect } from '@playwright/test';
import { waitForCanvasReady } from '../helpers';

interface Transpiled {
  nodes: any[];
  diagnostics: { line: number; severity: string; message: string }[];
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
      const mod = await import('/src/diagram/drawio.ts');
      return mod.transpileDrawio(source, {
        groupId: 'drawio-group',
        origin,
        measureText: (text: string, fontSize: number) => text.length * fontSize * 0.5,
      });
    },
    { source, origin },
  );
}

const messages = (r: Transpiled) => r.diagnostics.map((d) => d.message).join('\n');

function mxfile(cells: string, extraPages = ''): string {
  return `<mxfile host="app.diagrams.net">
  <diagram name="Page-1" id="page1">
    <mxGraphModel>
      <root>
        <mxCell id="0"/>
        <mxCell id="1" parent="0"/>
        ${cells}
      </root>
    </mxGraphModel>
  </diagram>${extraPages}
</mxfile>`;
}

function vertex(
  id: string,
  style: string,
  geo: { x: number; y: number; w: number; h: number },
  value = '',
  parent = '1',
  extraGeo = '',
): string {
  return `<mxCell id="${id}" value="${value}" style="${style}" vertex="1" parent="${parent}">
    <mxGeometry x="${geo.x}" y="${geo.y}" width="${geo.w}" height="${geo.h}"${extraGeo} as="geometry"/>
  </mxCell>`;
}

test.describe('146 - draw.io transpile (REQ-DIAG-110..119)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForCanvasReady(page);
  });

  test('sniffFormat classifies mxfile and mxGraphModel as drawio, and does not steal SVG', async ({
    page,
  }) => {
    const sniffed = await page.evaluate(async () => {
      const mod = await import('/src/diagram/index.ts');
      return {
        mxfile: mod.sniffFormat('<mxfile host="app.diagrams.net"><diagram/></mxfile>'),
        model: mod.sniffFormat('<mxGraphModel><root/></mxGraphModel>'),
        svg: mod.sniffFormat('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"></svg>'),
        xmlSvg: mod.sniffFormat(
          '<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg"></svg>',
        ),
        xmlMxfile: mod.sniffFormat(
          '<?xml version="1.0" encoding="UTF-8"?><mxfile host="x"><diagram/></mxfile>',
        ),
      };
    });

    expect(sniffed.mxfile).toBe('drawio');
    expect(sniffed.model).toBe('drawio');
    expect(sniffed.svg).toBe('svg');
    // Ordering is load-bearing: mxGraph XML also starts with <?xml, so the
    // draw.io test has to win first — and an xml-prefixed SVG must still be SVG.
    expect(sniffed.xmlSvg).toBe('svg');
    expect(sniffed.xmlMxfile).toBe('drawio');
  });

  test('a rounded rect, ellipse, rhombus, triangle, standalone text and a labelled vertex each land as the documented node', async ({
    page,
  }) => {
    const rounded = await transpile(
      page,
      mxfile(vertex('r', 'rounded=1;whiteSpace=wrap;html=1;', { x: 10, y: 20, w: 100, h: 80 })),
    );
    expect(rounded.diagnostics).toEqual([]);
    expect(rounded.nodes).toHaveLength(1);
    const rect = rounded.nodes[0];
    expect(rect.type).toBe('shape');
    expect(rect.groupId).toBe('drawio-group');
    expect({ x: rect.x, y: rect.y, width: rect.width, height: rect.height }).toEqual({
      x: 110,
      y: 220,
      width: 100,
      height: 80,
    });
    expect(rect.data.shapeType).toBe('rect');
    expect(rect.data.cornerRadius).toBe(80 * 0.15);

    const ellipse = await transpile(
      page,
      mxfile(vertex('e', 'ellipse;whiteSpace=wrap;html=1;', { x: 50, y: 60, w: 40, h: 20 })),
    );
    expect(ellipse.diagnostics).toEqual([]);
    expect(ellipse.nodes).toHaveLength(1);
    expect(ellipse.nodes[0].data.shapeType).toBe('circle');
    expect({
      x: ellipse.nodes[0].x,
      y: ellipse.nodes[0].y,
      width: ellipse.nodes[0].width,
      height: ellipse.nodes[0].height,
    }).toEqual({ x: 150, y: 260, width: 40, height: 20 });

    const rhombus = await transpile(
      page,
      mxfile(vertex('d', 'rhombus;whiteSpace=wrap;html=1;', { x: 0, y: 0, w: 120, h: 80 })),
    );
    expect(rhombus.diagnostics).toEqual([]);
    expect(rhombus.nodes).toHaveLength(1);
    const diamond = rhombus.nodes[0];
    const side = 80 / Math.SQRT2;
    expect(diamond.data.shapeType).toBe('rect');
    expect(diamond.data.rotation).toBe(45);
    expect(diamond.width).toBeCloseTo(side);
    expect(diamond.height).toBeCloseTo(side);
    // Top-left of the inscribed square sits at the cell's mid-x / min-side top.
    expect(diamond.x).toBeCloseTo(100 + 120 / 2);
    expect(diamond.y).toBeCloseTo(200 + (80 - 80) / 2);

    const triangle = await transpile(
      page,
      mxfile(vertex('t', 'triangle;whiteSpace=wrap;html=1;', { x: 8, y: 12, w: 60, h: 50 })),
    );
    expect(triangle.diagnostics).toEqual([]);
    expect(triangle.nodes[0].data.shapeType).toBe('triangle');
    expect({
      x: triangle.nodes[0].x,
      y: triangle.nodes[0].y,
      width: triangle.nodes[0].width,
      height: triangle.nodes[0].height,
    }).toEqual({ x: 108, y: 212, width: 60, height: 50 });

    const standalone = await transpile(
      page,
      mxfile(vertex('txt', 'text;html=1;fontSize=16;', { x: 40, y: 80, w: 80, h: 30 }, 'Hello')),
    );
    expect(standalone.diagnostics).toEqual([]);
    expect(standalone.nodes).toHaveLength(1);
    expect(standalone.nodes[0].type).toBe('text');
    expect(standalone.nodes[0].data.text).toBe('Hello');
    expect(standalone.nodes[0].layer).toBe(5);
    expect(standalone.nodes[0].x + standalone.nodes[0].width / 2).toBeCloseTo(100 + 40 + 40);
    expect(standalone.nodes[0].y + standalone.nodes[0].height / 2).toBeCloseTo(200 + 80 + 15);

    const labelled = await transpile(
      page,
      mxfile(vertex('box', 'rounded=0;whiteSpace=wrap;html=1;', { x: 20, y: 30, w: 80, h: 40 }, 'Box')),
    );
    expect(labelled.diagnostics).toEqual([]);
    expect(labelled.nodes.map((n) => n.type)).toEqual(['shape', 'text']);
    const [box, label] = labelled.nodes;
    expect(label.data.text).toBe('Box');
    expect(label.x + label.width / 2).toBeCloseTo(box.x + box.width / 2);
    expect(label.y + label.height / 2).toBeCloseTo(box.y + box.height / 2);
  });

  test('paint keys map, and absent paint takes the defaults', async ({ page }) => {
    const styled = await transpile(
      page,
      mxfile(
        vertex(
          's',
          'fillColor=#ff0000;strokeColor=#003366;strokeWidth=2;dashed=1;dashPattern=6 3;',
          { x: 0, y: 0, w: 40, h: 30 },
        ),
      ),
    );
    expect(styled.diagnostics).toEqual([]);
    expect(styled.nodes[0].data).toMatchObject({
      fill: '#ff0000',
      stroke: '#003366',
      strokeWidth: 2,
      strokeDash: [6, 3],
    });

    const plain = await transpile(page, mxfile(vertex('p', '', { x: 0, y: 0, w: 40, h: 30 })));
    expect(plain.diagnostics).toEqual([]);
    expect(plain.nodes[0].data).toMatchObject({
      fill: '#ffffff',
      stroke: '#14181A',
      strokeWidth: 1,
      strokeDash: [],
    });

    const dashedDefault = await transpile(
      page,
      mxfile(vertex('d', 'dashed=1;', { x: 0, y: 0, w: 40, h: 30 })),
    );
    expect(dashedDefault.nodes[0].data.strokeDash).toEqual([8, 4]);
  });

  test('a child is placed at parent plus offset, and relative="1" is a fraction of the parent', async ({
    page,
  }) => {
    const nested = await transpile(
      page,
      mxfile(
        vertex('parent', 'rounded=0;', { x: 40, y: 50, w: 200, h: 100 }) +
          vertex('child', 'fillColor=#00ff00;', { x: 10, y: 20, w: 40, h: 30 }, '', 'parent'),
      ),
    );
    expect(nested.diagnostics).toEqual([]);
    const child = nested.nodes.find((n) => n.data.fill === '#00ff00');
    expect(child).toBeTruthy();
    expect({ x: child.x, y: child.y, width: child.width, height: child.height }).toEqual({
      x: 100 + 40 + 10,
      y: 200 + 50 + 20,
      width: 40,
      height: 30,
    });

    const relative = await transpile(
      page,
      mxfile(
        vertex('parent', 'rounded=0;', { x: 40, y: 50, w: 200, h: 100 }) +
          vertex(
            'frac',
            'fillColor=#0000ff;',
            { x: 0.5, y: 0.25, w: 40, h: 20 },
            '',
            'parent',
            ' relative="1"',
          ),
      ),
    );
    expect(relative.diagnostics).toEqual([]);
    const frac = relative.nodes.find((n) => n.data.fill === '#0000ff');
    expect(frac).toBeTruthy();
    expect({ x: frac.x, y: frac.y }).toEqual({
      x: 100 + 40 + 0.5 * 200,
      y: 200 + 50 + 0.25 * 100,
    });
  });

  test('a swimlane is a rect plus title, children are flat siblings, and every node shares groupId', async ({
    page,
  }) => {
    const r = await transpile(
      page,
      mxfile(
        vertex('lane', 'swimlane;startSize=30;', { x: 0, y: 0, w: 200, h: 160 }, 'Lane A') +
          vertex('kid', 'rounded=0;fillColor=#abcdef;', { x: 20, y: 40, w: 80, h: 40 }, '', 'lane'),
      ),
    );

    expect(r.diagnostics).toEqual([]);
    expect(r.nodes.every((n) => n.groupId === 'drawio-group')).toBe(true);
    const lane = r.nodes.find((n) => n.type === 'shape' && n.width === 200);
    const title = r.nodes.find((n) => n.type === 'text');
    const kid = r.nodes.find((n) => n.data.fill === '#abcdef');
    expect(lane?.data.shapeType).toBe('rect');
    expect(title?.data.text).toBe('Lane A');
    expect(title!.x + title!.width / 2).toBeCloseTo(100 + 100);
    expect(title!.y + title!.height / 2).toBeCloseTo(200 + 15);
    expect({ x: kid.x, y: kid.y }).toEqual({ x: 100 + 20, y: 200 + 40 });
    // Flattened: the child is a sibling of the lane, not nested under it.
    expect(r.nodes.filter((n) => n.type === 'shape')).toHaveLength(2);
  });

  test('stencil, image, gradient, ellipse rotation and rich HTML are each refused by name', async ({
    page,
  }) => {
    const r = await transpile(
      page,
      mxfile(
        [
          vertex('cloud', 'shape=cloud;', { x: 0, y: 0, w: 80, h: 60 }),
          vertex('azure', 'shape=mxgraph.mscae.enterprise.gateway;', { x: 100, y: 0, w: 80, h: 60 }),
          vertex('pic', 'shape=image;image=data:image/png,abc;', { x: 200, y: 0, w: 80, h: 60 }),
          vertex('grad', 'gradientColor=#ff0000;fillColor=#ffffff;', { x: 300, y: 0, w: 80, h: 60 }),
          vertex('rotel', 'ellipse;rotation=30;', { x: 400, y: 0, w: 80, h: 60 }),
          vertex('html', 'rounded=0;html=1;', { x: 500, y: 0, w: 80, h: 60 }, '&lt;b&gt;bold&lt;/b&gt;'),
          vertex('ok', 'fillColor=#00ff00;', { x: 600, y: 0, w: 80, h: 60 }),
        ].join(''),
      ),
    );

    const all = messages(r);
    expect(all).toContain('shape="cloud"');
    expect(all).toMatch(/stencil/i);
    expect(all).toContain('mxgraph.mscae.enterprise.gateway');
    expect(all).toMatch(/image=/i);
    expect(all).toContain('gradientColor');
    expect(all).toMatch(/rotation/i);
    expect(all).toMatch(/HTML/i);
    expect(r.diagnostics.filter((d) => d.severity === 'error').length).toBeGreaterThanOrEqual(5);
    // Refusing is not the same as giving up: the plain rect still lands.
    const ok = r.nodes.filter((n) => n.type === 'shape' && n.data.fill === '#00ff00');
    expect(ok).toHaveLength(1);
    // The HTML cell is left unlabelled rather than interpreted.
    expect(r.nodes.filter((n) => n.type === 'text')).toHaveLength(0);
  });

  test('a multi-page mxfile imports the first page and names the second in an ignored diagnostic', async ({
    page,
  }) => {
    const second = `
  <diagram name="Backend" id="page2">
    <mxGraphModel>
      <root>
        <mxCell id="0"/>
        <mxCell id="1" parent="0"/>
        ${vertex('other', 'fillColor=#0000ff;', { x: 0, y: 0, w: 40, h: 40 })}
      </root>
    </mxGraphModel>
  </diagram>`;
    const r = await transpile(
      page,
      mxfile(vertex('first', 'fillColor=#111111;', { x: 0, y: 0, w: 40, h: 40 }), second),
    );

    expect(r.nodes).toHaveLength(1);
    expect(r.nodes[0].data.fill).toBe('#111111');
    const skipped = r.diagnostics.filter((d) => d.severity === 'ignored');
    expect(skipped.some((d) => /Backend/.test(d.message) && /page 2/i.test(d.message))).toBe(true);
  });

  test('a straight connected edge lands as an arrow from border to border', async ({ page }) => {
    const r = await transpile(
      page,
      mxfile(
        vertex('a', 'fillColor=#aaaaaa;', { x: 0, y: 0, w: 40, h: 30 }) +
          vertex('b', 'fillColor=#bbbbbb;', { x: 120, y: 0, w: 40, h: 30 }) +
          `<mxCell id="e1" style="endArrow=classic;html=1;" edge="1" parent="1" source="a" target="b">
             <mxGeometry relative="1" as="geometry"/>
           </mxCell>`,
      ),
    );

    const shapes = r.nodes.filter((n) => n.type === 'shape');
    const rects = shapes.filter((n) => n.data.shapeType === 'rect');
    const arrows = shapes.filter((n) => n.data.shapeType === 'arrow');
    expect(rects).toHaveLength(2);
    expect(arrows).toHaveLength(1);
    expect(r.nodes.some((n) => n.data.shapeType === 'line')).toBe(false);
    expect(messages(r)).not.toMatch(/v0\.47/);
    // a at (0,0) 40×30, b at (120,0) 40×30, origin (100,200).
    // Centres (120, 215) → (240, 215); clip at the facing borders x=140 and x=220.
    const arrow = arrows[0];
    expect(arrow.x).toBeCloseTo(140);
    expect(arrow.y).toBeCloseTo(215);
    expect(arrow.width).toBeCloseTo(80);
    expect(arrow.height).toBeCloseTo(0);
    expect(arrow.data.fill).toBe('transparent');
  });

  test('normalizeDrawioSource inflates a compressed page and leaves uncompressed input alone', async ({
    page,
  }) => {
    const out = await page.evaluate(async () => {
      const mod = await import('/src/diagram/drawio.ts');
      const inner = `<mxGraphModel>
      <root>
        <mxCell id="0"/>
        <mxCell id="1" parent="0"/>
        <mxCell id="2" value="" style="fillColor=#ff0000;" vertex="1" parent="1">
          <mxGeometry x="10" y="20" width="30" height="40" as="geometry"/>
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
      const compressed = `<mxfile host="app.diagrams.net"><diagram name="Page-1" id="page1">${payload}</diagram></mxfile>`;

      const normalized = await mod.normalizeDrawioSource(compressed);
      const drawn = mod.transpileDrawio(normalized, {
        groupId: 'drawio-group',
        origin: { x: 100, y: 200 },
        measureText: (text: string, fontSize: number) => text.length * fontSize * 0.5,
      });

      const uncompressed = `<mxfile host="app.diagrams.net"><diagram name="Page-1" id="page1">${inner}</diagram></mxfile>`;
      const unchanged = await mod.normalizeDrawioSource(uncompressed);

      return {
        normalized,
        nodeCount: drawn.nodes.length,
        fill: drawn.nodes[0]?.data?.fill,
        box: drawn.nodes[0]
          ? {
              x: drawn.nodes[0].x,
              y: drawn.nodes[0].y,
              width: drawn.nodes[0].width,
              height: drawn.nodes[0].height,
            }
          : null,
        unchangedEqualsInput: unchanged === uncompressed,
      };
    });

    expect(out.normalized).toMatch(/<mxGraphModel/i);
    expect(out.normalized).toContain('fillColor=#ff0000');
    expect(out.nodeCount).toBe(1);
    expect(out.fill).toBe('#ff0000');
    expect(out.box).toEqual({ x: 110, y: 220, width: 30, height: 40 });
    expect(out.unchangedEqualsInput).toBe(true);
  });

  test('buildDiagram with format drawio returns nodes and bounds, skipping measure and layout', async ({
    page,
  }) => {
    const built = await page.evaluate(async () => {
      const mod = await import('/src/diagram/index.ts');
      const source = `<mxfile host="app.diagrams.net">
  <diagram name="Page-1" id="page1">
    <mxGraphModel>
      <root>
        <mxCell id="0"/>
        <mxCell id="1" parent="0"/>
        <mxCell id="2" value="" style="fillColor=#123456;" vertex="1" parent="1">
          <mxGeometry x="10" y="20" width="30" height="40" as="geometry"/>
        </mxCell>
      </root>
    </mxGraphModel>
  </diagram>
</mxfile>`;
      return mod.buildDiagram(source, {
        groupId: 'drawio-group',
        origin: { x: 100, y: 200 },
        format: 'drawio',
        measureText: (text: string, fontSize: number) => text.length * fontSize * 0.5,
      });
    });

    expect(built.nodes).toHaveLength(1);
    expect(built.elementCount).toBe(1);
    expect(built.nodes[0].data.fill).toBe('#123456');
    // Source coordinates are used as-is — measure/layout never rewrote them.
    expect({
      x: built.nodes[0].x,
      y: built.nodes[0].y,
      width: built.nodes[0].width,
      height: built.nodes[0].height,
    }).toEqual({ x: 110, y: 220, width: 30, height: 40 });
    expect(built.bounds).toEqual({ x: 110, y: 220, width: 30, height: 40 });
  });
});
