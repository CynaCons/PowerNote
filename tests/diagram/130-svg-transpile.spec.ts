/**
 * Test 130: SVG transpiled to native canvas nodes
 * Covers: REQ-DIAG-080..089
 *
 * The module is exercised directly rather than through the canvas, because what
 * is under test is a pure function: SVG text in, ShapeNode/TextNode out. Two
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
      const mod = await import('/src/diagram/svg.ts');
      return mod.transpileSvg(source, {
        groupId: 'svg-group',
        origin,
        measureText: (text: string, fontSize: number) => text.length * fontSize * 0.5,
      });
    },
    { source, origin },
  );
}

const messages = (r: Transpiled) => r.diagnostics.map((d) => d.message).join('\n');

test.describe('130 - SVG transpile (REQ-DIAG-080..089)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForCanvasReady(page);
  });

  test('a rect lands at the origin with its paint and corner radius', async ({ page }) => {
    const r = await transpile(
      page,
      `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100">
         <rect x="10" y="20" width="30" height="40" rx="5"
               fill="#ff0000" stroke="#003366" stroke-width="2" stroke-dasharray="6 3"/>
       </svg>`,
    );

    expect(r.diagnostics).toEqual([]);
    expect(r.nodes).toHaveLength(1);
    const n = r.nodes[0];
    expect(n.type).toBe('shape');
    expect(n.groupId).toBe('svg-group');
    expect({ x: n.x, y: n.y, width: n.width, height: n.height }).toEqual({ x: 110, y: 220, width: 30, height: 40 });
    expect(n.data).toMatchObject({
      shapeType: 'rect',
      fill: '#ff0000',
      stroke: '#003366',
      strokeWidth: 2,
      strokeDash: [6, 3],
      cornerRadius: 5,
    });
  });

  test('viewBox and width/height set the scale, and the viewBox origin lands on origin', async ({ page }) => {
    const r = await transpile(
      page,
      `<svg width="200" height="200" viewBox="10 10 100 100">
         <rect x="10" y="10" width="30" height="40" stroke="#000" stroke-width="2" fill="none"/>
       </svg>`,
    );

    expect(r.diagnostics).toEqual([]);
    const n = r.nodes[0];
    // scale 2: the viewBox corner (10,10) is the origin, and everything doubles.
    expect({ x: n.x, y: n.y, width: n.width, height: n.height }).toEqual({ x: 100, y: 200, width: 60, height: 80 });
    expect(n.data.strokeWidth).toBe(4);
    expect(n.data.fill).toBe('transparent');
  });

  test('circle and ellipse both become box-sized ellipse nodes', async ({ page }) => {
    const r = await transpile(
      page,
      `<svg viewBox="0 0 200 200">
         <circle cx="50" cy="50" r="20" fill="#eee"/>
         <ellipse cx="120" cy="60" rx="30" ry="10" fill="#eee"/>
       </svg>`,
    );

    expect(r.diagnostics).toEqual([]);
    expect(r.nodes.map((n) => n.data.shapeType)).toEqual(['circle', 'circle']);
    expect({ x: r.nodes[0].x, y: r.nodes[0].y, w: r.nodes[0].width, h: r.nodes[0].height }).toEqual({
      x: 130,
      y: 230,
      w: 40,
      h: 40,
    });
    expect({ x: r.nodes[1].x, y: r.nodes[1].y, w: r.nodes[1].width, h: r.nodes[1].height }).toEqual({
      x: 190,
      y: 250,
      w: 60,
      h: 20,
    });
  });

  test('a line keeps its signed direction, and marker-end makes it an arrow', async ({ page }) => {
    const r = await transpile(
      page,
      `<svg viewBox="0 0 200 200">
         <line x1="50" y1="50" x2="10" y2="90" stroke="#333" stroke-dasharray="4,2"/>
         <line x1="0" y1="0" x2="40" y2="10" stroke="#333" marker-end="url(#head)"/>
       </svg>`,
    );

    expect(r.diagnostics).toEqual([]);
    const [plain, arrow] = r.nodes;
    expect(plain.data.shapeType).toBe('line');
    // A backwards line is stored as a negative direction vector, not a flipped box.
    expect({ x: plain.x, y: plain.y, width: plain.width, height: plain.height }).toEqual({
      x: 150,
      y: 250,
      width: -40,
      height: 40,
    });
    expect(plain.data.strokeDash).toEqual([4, 2]);
    expect(arrow.data.shapeType).toBe('arrow');
  });

  test('a strokeless line is not invented into a visible mark', async ({ page }) => {
    const r = await transpile(page, '<svg viewBox="0 0 10 10"><line x1="0" y1="0" x2="5" y2="5"/></svg>');
    expect(r.nodes).toHaveLength(0);
    expect(messages(r)).toContain('<line> has no stroke');
  });

  test('nested g translates compose, and paint inherits down the tree', async ({ page }) => {
    const r = await transpile(
      page,
      `<svg viewBox="0 0 200 200">
         <g transform="translate(10, 20)" fill="#0000ff" stroke="#00ff00">
           <g transform="translate(5,5)">
             <rect x="0" y="0" width="10" height="10"/>
             <rect x="0" y="0" width="10" height="10" style="fill:#123456" fill="#abcdef"/>
           </g>
         </g>
       </svg>`,
    );

    expect(r.diagnostics).toEqual([]);
    expect({ x: r.nodes[0].x, y: r.nodes[0].y }).toEqual({ x: 115, y: 225 });
    expect(r.nodes[0].data).toMatchObject({ fill: '#0000ff', stroke: '#00ff00' });
    // A style declaration outranks the presentation attribute next to it.
    expect(r.nodes[1].data.fill).toBe('#123456');
  });

  test('a uniform scale on a g scales geometry and stroke alike', async ({ page }) => {
    const r = await transpile(
      page,
      `<svg viewBox="0 0 200 200">
         <g transform="translate(10,10) scale(3)">
           <rect x="1" y="2" width="4" height="5" stroke="#000" stroke-width="2"/>
         </g>
       </svg>`,
    );
    expect(r.diagnostics).toEqual([]);
    const n = r.nodes[0];
    expect({ x: n.x, y: n.y, width: n.width, height: n.height }).toEqual({ x: 113, y: 216, width: 12, height: 15 });
    expect(n.data.strokeWidth).toBe(6);
  });

  test('text is placed by its baseline and anchored by the measured run', async ({ page }) => {
    const r = await transpile(
      page,
      `<svg viewBox="0 0 200 200">
         <text x="50" y="30" font-size="20" fill="#111">Hello</text>
         <text x="50" y="60" font-size="20" text-anchor="middle" font-weight="bold">Hello</text>
         <text x="50" y="90" font-size="20" text-anchor="end">Hello</text>
       </svg>`,
    );

    expect(r.diagnostics).toEqual([]);
    expect(r.nodes.map((n) => n.type)).toEqual(['text', 'text', 'text']);
    expect(r.nodes.every((n) => n.layer === 5)).toBe(true);

    // measure stub: 5 chars * 20px * 0.5 = 50 wide. Padding is 4 a side.
    const [start, middle, end] = r.nodes;
    expect(start.data).toMatchObject({ text: 'Hello', fontSize: 20, fontStyle: 'normal', fill: '#111' });
    expect(start.x).toBe(100 + 50 - 4);
    // Baseline sits ~1em below the top of the text box.
    expect(start.y).toBe(200 + 30 - 20 - 4);
    expect(middle.x).toBe(100 + 50 - 25 - 4);
    expect(middle.data.fontStyle).toBe('bold');
    expect(end.x).toBe(100 + 50 - 50 - 4);
  });

  test('a positioned tspan becomes its own text node', async ({ page }) => {
    const r = await transpile(
      page,
      `<svg viewBox="0 0 200 200">
         <text x="10" y="20" font-size="10"><tspan x="10" y="20">one</tspan><tspan x="10" y="40">two</tspan></text>
       </svg>`,
    );
    expect(r.diagnostics).toEqual([]);
    expect(r.nodes.map((n) => n.data.text)).toEqual(['one', 'two']);
    expect(r.nodes[1].y - r.nodes[0].y).toBe(20);
  });

  test('a tspan that only restyles is folded in, and says so', async ({ page }) => {
    const r = await transpile(
      page,
      `<svg viewBox="0 0 200 200"><text x="0" y="10" font-size="10">a <tspan fill="#f00">b</tspan></text></svg>`,
    );
    expect(r.nodes).toHaveLength(1);
    expect(r.nodes[0].data.text).toBe('a b');
    expect(messages(r)).toContain('per-run styling inside <text> is not carried');
  });

  test('path, image, gradients, filters and masks are each refused by name', async ({ page }) => {
    const r = await transpile(
      page,
      `<svg viewBox="0 0 200 200">
         <defs><linearGradient id="g"><stop offset="0" stop-color="#fff"/></linearGradient></defs>
         <path d="M0 0 C 10 10, 20 20, 30 30"/>
         <image href="photo.png" x="0" y="0" width="10" height="10"/>
         <mask id="m"><rect width="10" height="10"/></mask>
         <filter id="f"><feGaussianBlur stdDeviation="2"/></filter>
         <rect x="0" y="0" width="10" height="10" fill="url(#g)"/>
         <rect x="0" y="0" width="10" height="10" filter="url(#f)"/>
         <rect x="0" y="0" width="10" height="10" fill="#0f0"/>
       </svg>`,
    );

    const all = messages(r);
    expect(all).toContain('<path> is refused');
    expect(all).toContain('<image> is refused');
    expect(all).toContain('<mask> is refused');
    expect(all).toContain('<filter> is refused');
    expect(all).toContain('gradient or pattern reference');
    expect(all).toContain('filter="url(#f)"');
    expect(all).toContain('<defs> was skipped');
    expect(r.diagnostics.filter((d) => d.severity === 'error').length).toBeGreaterThanOrEqual(6);
    // Refusing is not the same as giving up: the plain rect still lands.
    expect(r.nodes).toHaveLength(1);
    expect(r.nodes[0].data.fill).toBe('#0f0');
  });

  test('rotate and non-uniform scale are refused rather than mis-placed', async ({ page }) => {
    const r = await transpile(
      page,
      `<svg viewBox="0 0 200 200">
         <g transform="rotate(45)"><rect x="0" y="0" width="10" height="10"/></g>
         <g transform="scale(2,3)"><rect x="0" y="0" width="10" height="10"/></g>
       </svg>`,
    );
    const all = messages(r);
    expect(all).toContain('transform="rotate(…)"');
    expect(all).toContain('not a positive uniform scale');
    // The whole subtree goes with the transform it could not honour.
    expect(r.nodes).toHaveLength(0);
  });

  test('a polygon is drawn edge by edge and its fill loss is stated', async ({ page }) => {
    const r = await transpile(
      page,
      `<svg viewBox="0 0 200 200">
         <polygon points="0,0 10,0 10,10" fill="#abc"/>
         <polyline points="0,0 10,0 10,10" fill="none" stroke="#000"/>
       </svg>`,
    );
    // 3 closed edges + 2 open ones.
    expect(r.nodes).toHaveLength(5);
    expect(r.nodes.every((n) => n.data.shapeType === 'line')).toBe(true);
    expect(messages(r)).toContain('drawn as its outline only');
    expect(r.nodes[0].data.stroke).toBe('#abc');
  });

  test('malformed SVG never throws — it reports and salvages', async ({ page }) => {
    const r = await transpile(page, '<svg viewBox="0 0 10 10"><rect width="10" height="10" fill="#111"><circle r="2"/>');
    expect(messages(r)).toContain('not well-formed XML');
    // The HTML parser still hands back the shapes it could read.
    expect(r.nodes.length).toBeGreaterThan(0);

    const garbage = await transpile(page, 'this is not markup at all');
    expect(garbage.nodes).toHaveLength(0);
    expect(messages(garbage)).toContain('No <svg> element');

    const empty = await transpile(page, '   ');
    expect(empty.nodes).toHaveLength(0);
    expect(messages(empty)).toContain('empty');
  });

  test('diagnostics point at the source line that caused them', async ({ page }) => {
    const r = await transpile(page, '<svg viewBox="0 0 10 10">\n  <rect width="4" height="4"/>\n  <path d="M0 0"/>\n</svg>');
    const refusal = r.diagnostics.find((d) => d.message.includes('<path>'));
    expect(refusal?.line).toBe(3);
  });

  test('the module degrades to a diagnostic when DOMParser is missing', async ({ page }) => {
    const r = await page.evaluate(async () => {
      const mod = await import('/src/diagram/svg.ts');
      const saved = window.DOMParser;
      try {
        (window as any).DOMParser = undefined;
        return mod.transpileSvg('<svg><rect width="4" height="4"/></svg>', {
          groupId: 'g',
          origin: { x: 0, y: 0 },
        });
      } finally {
        (window as any).DOMParser = saved;
      }
    });
    expect(r.nodes).toHaveLength(0);
    expect(r.diagnostics[0].message).toContain('DOMParser');
  });

  test('an oversized drawing is cut off with an explanation, not left to hang', async ({ page }) => {
    const r = await page.evaluate(async () => {
      const mod = await import('/src/diagram/svg.ts');
      const rects = new Array(4200).fill('<rect x="0" y="0" width="2" height="2" fill="#111"/>').join('');
      const out = mod.transpileSvg(`<svg viewBox="0 0 10 10">${rects}</svg>`, {
        groupId: 'g',
        origin: { x: 0, y: 0 },
        measureText: (t: string) => t.length * 7,
      });
      return { count: out.nodes.length, messages: out.diagnostics.map((d) => d.message) };
    });
    expect(r.count).toBe(4000);
    expect(r.messages.join('\n')).toContain('canvas nodes; the rest was skipped');
  });
});
