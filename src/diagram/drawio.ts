/**
 * A documented subset of draw.io / mxGraph, transpiled into ordinary canvas nodes.
 *
 * Same bargain as `svg.ts`: every mark lands as a plain ShapeNode or TextNode
 * sharing a groupId, so an imported drawing can be taken apart with the tools
 * that already exist. Fidelity is the thing we trade away for that, which is
 * why a custom stencil is refused instead of being approximated as a rectangle
 * — a box standing in for a lambda icon is a lie that survives every later
 * edit, and the user has no way to tell it was ever a lie.
 *
 * Understood: the first `<diagram>` page of an `<mxfile>` (or a bare
 * `<mxGraphModel>`), `<mxCell>` vertices, parent-relative `mxGeometry` resolved
 * to absolute while walking, rectangles (incl. `rounded` / `rotation`),
 * ellipses, rhombi (as a 45° rect fitted to the cell), triangles, labels,
 * standalone text cells, and flattened groups / containers / swimlanes.
 * Paint comes from the `key=value;` style string.
 *
 * Understood on edges: a straight edge with `endArrow != none` is an `arrow`
 * ShapeNode (signed direction vector, same as `materialize.ts`); `endArrow=none`
 * is a `line`. Connected terminals clip centre-to-centre at each cell's box.
 * Orthogonal edges with explicit `mxPoint` waypoints decompose into consecutive
 * 2-point segments. Edge labels land at the midpoint of the longest segment.
 *
 * The caller must pass uncompressed XML — `normalizeDrawioSource` inflates a
 * base64+raw-deflate `<diagram>` payload with the browser-native
 * `DecompressionStream('deflate-raw')` so the stored source stays readable.
 * Curved / router-bent / unmappable-arrow edges are named in a diagnostic.
 * Nothing here throws: the caller is a canvas that has to keep working on
 * input it did not author.
 */

import type { CanvasNode, ShapeNodeData, TextNodeData } from '../types/data';
import { generateId } from '../utils/ids';
import { MIN_TEXT_WIDTH } from '../utils/pageLayout';
import { MARKDOWN_PADDING } from '../utils/renderMarkdown';
import { canvasMeasureText } from './layout';
import { INK } from './tokens';
import type { Diagnostic, DiagnosticSeverity, MeasureText } from './types';

export interface TranspileDrawioOptions {
  /** Shared by every node produced, so the drawing can be found again. */
  groupId: string;
  /** Page coordinates the drawing's origin lands on. */
  origin: { x: number; y: number };
  measureText?: MeasureText;
}

export interface TranspileDrawioResult {
  nodes: CanvasNode[];
  diagnostics: Diagnostic[];
}

/** One font across the app, so an imported drawing does not arrive in Helvetica. */
const FONT_FAMILY = 'Inter, system-ui, sans-serif';

/**
 * Shapes share a layer because mxGraph paints in document order and the canvas
 * sorts by layer with a stable sort — equal layers keep insertion order. Text
 * goes above, as it does everywhere else here. Containers are emitted before
 * their children (root listing is parent-first) so a child covers its lane.
 */
const LAYER_SHAPE = 3;
/** Above shapes so a connector crossing a box stays visible. */
const LAYER_LINK = 4;
const LAYER_TEXT = 5;

/** draw.io's implicit vertex fill when `fillColor` is absent. */
const DEFAULT_FILL = '#ffffff';
/** draw.io default label size. */
const DEFAULT_FONT = 12;
/**
 * mxGraph `RECTANGLE_ROUNDING_FACTOR` when `rounded=1` carries no `arcSize`.
 * A canvas rect wants a pixel radius, not a flag.
 */
const DEFAULT_ROUND_FACTOR = 0.15;

/** An import that wants more nodes than this is a mistake, not a diagram. */
const NODE_BUDGET = 4000;
/** Past this the list has stopped being a report and started being the payload. */
const DIAGNOSTIC_BUDGET = 200;

/**
 * Constructs we can only get wrong. Each message says why, because "some of
 * your drawing is missing" is not a diagnostic. Stencil names are interpolated
 * at the call site so the user can see *which* library shape was dropped.
 */
const REFUSED: Record<string, string> = {
  stencil:
    'is refused — custom stencils (mscae/aws/cisco/UML libraries) are little rendering programs this transpiler does not run. Redraw it with a rectangle, ellipse, rhombus, triangle or text.',
  image:
    'image= is refused — an embedded raster is not a canvas node. Import the picture as an image block instead.',
  gradient:
    'gradientColor is refused — a shape node carries one flat fill, and picking a stop colour would misrepresent the drawing.',
  rotation:
    'rotation on a non-rectangle is refused — circle/triangle Konva components ignore rotation, and silently dropping it would misplace the drawing.',
  sketch:
    'sketch=1 is refused — rough/hand-drawn rendering has no canvas equivalent, and a clean shape would not be what was drawn.',
  nested:
    'A nested <mxGraphModel> is refused — it opens a second graph with its own origin, and flattening it would move everything inside.',
  html:
    'HTML-formatted labels beyond plain text are refused — <br>/<div> and entities are stripped, but remaining markup would have to be interpreted. The cell was left unlabelled.',
  curved:
    'curved=1 is refused — the canvas has no bezier primitive, and a straightened curve misstates the drawing.',
  rounded:
    'rounded routing is refused — the canvas has no bezier primitive, and a straightened curve misstates the drawing.',
  router:
    'is refused — the bends live in draw.io\'s router, not in the file. Right-click the edge in draw.io → Edit connection to make waypoints explicit, then import again.',
  startArrow:
    'is refused — PowerNote arrows have one head, at the end of the segment, and this start head has no canvas equivalent.',
  bothArrows:
    'is refused — the canvas has no double-headed primitive, and dropping one head would misstate the drawing.',
};

/** Built-in `shape=` values we map. Anything else is a named stencil refusal. */
const ACCEPTED_SHAPES = new Set([
  '',
  'rectangle',
  'rect',
  'label',
  'ellipse',
  'rhombus',
  'triangle',
  'text',
  'swimlane',
  'group',
]);

type Kind = 'rect' | 'ellipse' | 'rhombus' | 'triangle' | 'text' | 'swimlane' | 'group';

interface Style {
  map: Map<string, string>;
}

interface Pt {
  x: number;
  y: number;
}

interface Geo {
  x: number;
  y: number;
  w: number;
  h: number;
  relative: boolean;
  sourcePoint: Pt | null;
  targetPoint: Pt | null;
  /** Explicit waypoints from `<Array as="points">`. */
  points: Pt[];
}

interface Cell {
  id: string;
  parentId: string | null;
  vertex: boolean;
  edge: boolean;
  value: string;
  style: Style;
  geo: Geo;
  line: number;
  /** True when this cell XML contains another mxGraphModel. */
  nested: boolean;
  sourceId: string | null;
  targetId: string | null;
}

interface TagRef {
  tag: string;
  line: number;
}

interface Ctx {
  nodes: CanvasNode[];
  diagnostics: Diagnostic[];
  groupId: string;
  origin: { x: number; y: number };
  measure: MeasureText;
  tags: TagRef[];
  cursor: number;
  overBudget: boolean;
}

interface Paint {
  fill: string;
  stroke: string;
  strokeWidth: number;
  dash: number[];
  rotation: number;
  cornerRadius: number;
  fontSize: number;
  fontWeight: number;
  italic: boolean;
  fontColor: string;
}

// ── Source line lookup ──────────────────────────────────────

/**
 * DOMParser hands back a tree with no source positions, so diagnostics would
 * have to say "line 0" for everything. Scanning the raw text for open tags in
 * order gives a line per tag; a `<` inside a CDATA block can shift them, which
 * is why nothing but a diagnostic's line number depends on this.
 */
function scanTags(source: string): TagRef[] {
  const text = source.replace(/<!--[\s\S]*?-->/g, (m) => m.replace(/[^\n]/g, ' '));
  const refs: TagRef[] = [];
  const re = /<([A-Za-z_][\w.:-]*)/g;
  let match: RegExpExecArray | null;
  let line = 1;
  let at = 0;
  while ((match = re.exec(text)) !== null) {
    while (at < match.index) {
      if (text.charCodeAt(at) === 10) line += 1;
      at += 1;
    }
    refs.push({ tag: match[1].toLowerCase().replace(/^.*:/, ''), line });
  }
  return refs;
}

function nextLine(ctx: Ctx, tag: string): number {
  const end = Math.min(ctx.tags.length, ctx.cursor + 64);
  for (let i = ctx.cursor; i < end; i += 1) {
    if (ctx.tags[i].tag === tag) {
      ctx.cursor = i + 1;
      return ctx.tags[i].line;
    }
  }
  return 0;
}

function report(ctx: Ctx, line: number, severity: DiagnosticSeverity, message: string): void {
  if (ctx.diagnostics.length >= DIAGNOSTIC_BUDGET) return;
  ctx.diagnostics.push({ line, severity, message });
}

// ── Attribute / style reading ───────────────────────────────

function tagOf(el: Element): string {
  return (el.localName || el.tagName || '').toLowerCase();
}

function attr(el: Element, name: string): string | null {
  const direct = el.getAttribute(name);
  if (direct !== null) return direct;
  const lower = name.toLowerCase();
  for (const a of Array.from(el.attributes)) {
    if (a.name.toLowerCase() === lower) return a.value;
  }
  return null;
}

function num(raw: string | null | undefined, fallback = 0): number {
  if (raw == null || raw === '') return fallback;
  const n = Number.parseFloat(raw);
  return Number.isFinite(n) ? n : fallback;
}

function parseStyle(raw: string | null): Style {
  const map = new Map<string, string>();
  if (!raw) return { map };
  for (const part of raw.split(';')) {
    if (!part) continue;
    const eq = part.indexOf('=');
    if (eq < 0) {
      const key = part.trim().toLowerCase();
      if (key) map.set(key, '1');
    } else {
      const key = part.slice(0, eq).trim().toLowerCase();
      const value = part.slice(eq + 1).trim();
      if (key) map.set(key, value);
    }
  }
  return { map };
}

function styleGet(style: Style, key: string): string | undefined {
  return style.map.get(key.toLowerCase());
}

function styleHas(style: Style, key: string): boolean {
  return style.map.has(key.toLowerCase());
}

function colour(raw: string | undefined, fallback: string): string {
  if (raw == null || raw === '') return fallback;
  const v = raw.trim();
  const low = v.toLowerCase();
  if (low === 'none' || low === 'transparent') return 'transparent';
  if (low === 'default' || low === 'inherit') return fallback;
  if (low.startsWith('#')) return v;
  if (/^[0-9a-f]{3,8}$/i.test(v)) return `#${v}`;
  return fallback;
}

function dashes(style: Style): number[] {
  if (styleGet(style, 'dashed') !== '1') return [];
  const raw = styleGet(style, 'dashpattern');
  if (!raw) return [8, 4];
  const parts: number[] = [];
  for (const piece of raw.split(/[\s,]+/)) {
    if (!piece) continue;
    const n = Number.parseFloat(piece);
    if (!Number.isFinite(n) || n < 0) return [8, 4];
    parts.push(n);
  }
  return parts.length > 0 ? parts : [8, 4];
}

function classify(style: Style): Kind | { stencil: string } {
  const shape = (styleGet(style, 'shape') ?? '').trim();
  const low = shape.toLowerCase();
  if (shape && !ACCEPTED_SHAPES.has(low)) return { stencil: shape };
  if (low === 'ellipse' || styleHas(style, 'ellipse')) return 'ellipse';
  if (low === 'rhombus' || styleHas(style, 'rhombus')) return 'rhombus';
  if (low === 'triangle' || styleHas(style, 'triangle')) return 'triangle';
  if (low === 'text' || styleHas(style, 'text')) return 'text';
  if (low === 'swimlane' || styleHas(style, 'swimlane')) return 'swimlane';
  if (low === 'group' || styleHas(style, 'group') || styleGet(style, 'container') === '1') return 'group';
  return 'rect';
}

function readPaint(style: Style, box: { w: number; h: number }): Paint {
  const fontStyle = num(styleGet(style, 'fontstyle'), 0);
  const rounded = styleGet(style, 'rounded') === '1';
  let cornerRadius = 0;
  if (rounded) {
    const arc = styleGet(style, 'arcsize');
    if (arc != null && arc !== '') {
      const a = num(arc, 0);
      cornerRadius =
        styleGet(style, 'absolutearcsize') === '1'
          ? Math.max(0, a)
          : Math.min(box.w, box.h) * (a / 100);
    } else {
      cornerRadius = Math.min(box.w, box.h) * DEFAULT_ROUND_FACTOR;
    }
  }
  const fontSizeRaw = num(styleGet(style, 'fontsize'), DEFAULT_FONT);
  return {
    fill: colour(styleGet(style, 'fillcolor'), DEFAULT_FILL),
    stroke: colour(styleGet(style, 'strokecolor'), INK),
    strokeWidth: Math.max(0, num(styleGet(style, 'strokewidth'), 1)),
    dash: dashes(style),
    rotation: num(styleGet(style, 'rotation'), 0),
    cornerRadius,
    fontSize: fontSizeRaw > 0 ? fontSizeRaw : DEFAULT_FONT,
    fontWeight: (fontStyle & 1) !== 0 ? 700 : 400,
    italic: (fontStyle & 2) !== 0,
    fontColor: colour(styleGet(style, 'fontcolor'), INK),
  };
}

// ── Labels ──────────────────────────────────────────────────

/**
 * draw.io stores labels as XML-attribute text. After the parser has decoded
 * entities once, `html=1` values still contain `<br>` / `<div>` (and sometimes
 * real markup). We turn block boundaries into newlines and refuse anything
 * that still looks like a tag — stripping `<b>` would keep the words and lose
 * the fact that they were a formatted run.
 */
function decodeEntities(raw: string): string {
  return raw
    .replace(/&nbsp;/gi, ' ')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => {
      const n = Number.parseInt(h, 16);
      return Number.isFinite(n) && n >= 0 && n <= 0x10ffff ? String.fromCodePoint(n) : '';
    })
    .replace(/&#(\d+);/g, (_, d: string) => {
      const n = Number.parseInt(d, 10);
      return Number.isFinite(n) && n >= 0 && n <= 0x10ffff ? String.fromCodePoint(n) : '';
    })
    .replace(/&amp;/gi, '&');
}

function readLabel(raw: string): { text: string } | { html: true } {
  if (!raw) return { text: '' };
  let s = raw.replace(/<br\s*\/?>/gi, '\n');
  s = s.replace(/<\/(?:div|p)\s*>/gi, '\n');
  s = s.replace(/<(?:div|p)(?:\s[^>]*)?>/gi, '');
  if (/<\/?[a-zA-Z]/.test(s)) return { html: true };
  s = decodeEntities(s);
  s = s.replace(/\r\n?/g, '\n').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  return { text: s };
}

// ── Geometry ────────────────────────────────────────────────

function readMxPoint(el: Element): Pt {
  return { x: num(attr(el, 'x')), y: num(attr(el, 'y')) };
}

function geometryOf(cellEl: Element): Geo {
  const empty: Geo = {
    x: 0,
    y: 0,
    w: 0,
    h: 0,
    relative: false,
    sourcePoint: null,
    targetPoint: null,
    points: [],
  };
  const list = Array.from(cellEl.getElementsByTagName('mxGeometry'));
  const geo = list.find((g) => (attr(g, 'as') ?? 'geometry') === 'geometry') ?? list[0];
  if (!geo) return empty;

  let sourcePoint: Pt | null = null;
  let targetPoint: Pt | null = null;
  const points: Pt[] = [];
  for (const child of Array.from(geo.children)) {
    const t = tagOf(child);
    const as = (attr(child, 'as') ?? '').toLowerCase();
    if (t === 'mxpoint') {
      if (as === 'sourcepoint') sourcePoint = readMxPoint(child);
      else if (as === 'targetpoint') targetPoint = readMxPoint(child);
    } else if (t === 'array' && as === 'points') {
      for (const p of Array.from(child.children)) {
        if (tagOf(p) === 'mxpoint') points.push(readMxPoint(p));
      }
    }
  }

  return {
    x: num(attr(geo, 'x')),
    y: num(attr(geo, 'y')),
    w: num(attr(geo, 'width')),
    h: num(attr(geo, 'height')),
    relative: attr(geo, 'relative') === '1',
    sourcePoint,
    targetPoint,
    points,
  };
}

function firstMxCell(el: Element): Element | null {
  for (const child of Array.from(el.children)) {
    if (tagOf(child) === 'mxcell') return child;
  }
  return el.getElementsByTagName('mxCell')[0] ?? null;
}

/**
 * `mxGeometry` x/y are relative to the parent *cell*, not the page. Walking
 * the parent-id chain (not the XML tree — mxGraph stores every cell flat
 * under `<root>`) is the only way to land children next to their container.
 */
function resolveAbs(cell: Cell, byId: Map<string, Cell>): { x: number; y: number } {
  let x = 0;
  let y = 0;
  let cur: Cell | undefined = cell;
  const seen = new Set<string>();
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id);
    const parent: Cell | undefined = cur.parentId ? byId.get(cur.parentId) : undefined;
    if (cur.geo.relative && parent) {
      x += cur.geo.x * parent.geo.w;
      y += cur.geo.y * parent.geo.h;
    } else {
      x += cur.geo.x;
      y += cur.geo.y;
    }
    cur = parent;
  }
  return { x, y };
}

function readCell(el: Element, line: number): Cell | null {
  const tag = tagOf(el);
  let id: string | null = null;
  let value = '';
  let mx: Element | null = null;

  if (tag === 'object' || tag === 'userobject') {
    mx = firstMxCell(el);
    if (!mx) return null;
    id = attr(el, 'id') ?? attr(mx, 'id');
    value = attr(el, 'label') ?? attr(el, 'value') ?? attr(mx, 'value') ?? '';
  } else if (tag === 'mxcell') {
    mx = el;
    id = attr(el, 'id');
    value = attr(el, 'value') ?? '';
  } else {
    return null;
  }
  if (!id || !mx) return null;

  return {
    id,
    parentId: attr(mx, 'parent'),
    vertex: attr(mx, 'vertex') === '1',
    edge: attr(mx, 'edge') === '1',
    value,
    style: parseStyle(attr(mx, 'style')),
    geo: geometryOf(mx),
    line,
    nested: mx.getElementsByTagName('mxGraphModel').length > 0 || el.getElementsByTagName('mxGraphModel').length > 0,
    sourceId: attr(mx, 'source'),
    targetId: attr(mx, 'target'),
  };
}

// ── Emitting ────────────────────────────────────────────────

function pushNode(ctx: Ctx, node: CanvasNode): boolean {
  if (ctx.nodes.length >= NODE_BUDGET) {
    if (!ctx.overBudget) {
      ctx.overBudget = true;
      report(
        ctx,
        0,
        'error',
        `The drawing needs more than ${NODE_BUDGET} canvas nodes; the rest was skipped. Simplify it or import it as an image.`,
      );
    }
    return false;
  }
  ctx.nodes.push(node);
  return true;
}

function shapeData(paint: Paint, shapeType: ShapeNodeData['shapeType'], extra?: Partial<ShapeNodeData>): ShapeNodeData {
  return {
    shapeType,
    fill: paint.fill,
    stroke: paint.stroke,
    strokeWidth: paint.strokeWidth,
    strokeDash: paint.dash,
    ...extra,
  };
}

function emitShape(
  ctx: Ctx,
  x: number,
  y: number,
  width: number,
  height: number,
  data: ShapeNodeData,
): void {
  pushNode(ctx, {
    id: generateId(),
    type: 'shape',
    x: ctx.origin.x + x,
    y: ctx.origin.y + y,
    width,
    height,
    layer: LAYER_SHAPE,
    groupId: ctx.groupId,
    data,
  });
}

function emitLabel(
  ctx: Ctx,
  text: string,
  cx: number,
  cy: number,
  paint: Paint,
): void {
  if (!text) return;
  const lines = text.split('\n');
  let measured = 0;
  for (const line of lines) {
    measured = Math.max(measured, ctx.measure(line, paint.fontSize, paint.fontWeight));
  }
  const width = Math.max(MIN_TEXT_WIDTH, Math.ceil(measured) + 2 * MARKDOWN_PADDING + 6);
  const height = Math.ceil(paint.fontSize * 1.4 * lines.length) + 2 * MARKDOWN_PADDING;
  const data: TextNodeData = {
    text,
    fontSize: paint.fontSize,
    fontFamily: FONT_FAMILY,
    fontStyle: [paint.fontWeight >= 600 ? 'bold' : '', paint.italic ? 'italic' : ''].filter(Boolean).join(' ') || 'normal',
    fill: paint.fontColor,
  };
  pushNode(ctx, {
    id: generateId(),
    type: 'text',
    x: ctx.origin.x + cx - width / 2,
    y: ctx.origin.y + cy - height / 2,
    width,
    height,
    layer: LAYER_TEXT,
    groupId: ctx.groupId,
    data,
  });
}

function labelText(ctx: Ctx, cell: Cell): string | null {
  const parsed = readLabel(cell.value);
  if ('html' in parsed) {
    report(ctx, cell.line, 'error', `Cell "${cell.id}": ${REFUSED.html}`);
    return null;
  }
  return parsed.text;
}

/**
 * Konva rotates a rect about its top-left, not its centre. A square of side
 * S/√2 placed at the cell's mid-x / min-side top, turned 45°, fills the
 * S×S box inscribed in the cell — the v0.35.1 decision-diamond trick.
 */
function emitRhombus(ctx: Ctx, absX: number, absY: number, w: number, h: number, paint: Paint): void {
  const S = Math.min(w, h);
  if (S <= 0) return;
  const side = S / Math.SQRT2;
  const x = absX + w / 2;
  const y = absY + (h - S) / 2;
  emitShape(ctx, x, y, side, side, shapeData(paint, 'rect', { rotation: 45 + paint.rotation, cornerRadius: paint.cornerRadius }));
}

function emitVertex(ctx: Ctx, cell: Cell, byId: Map<string, Cell>): void {
  if (cell.nested) {
    report(ctx, cell.line, 'error', REFUSED.nested);
    return;
  }

  const image = styleGet(cell.style, 'image');
  if (image && image.toLowerCase() !== 'none') {
    report(ctx, cell.line, 'error', `Cell "${cell.id}": ${REFUSED.image}`);
    return;
  }

  // Stencil before gradient/sketch: real AWS/mscae styles carry both, and
  // naming the library shape is the refusal the user can act on.
  const kind = classify(cell.style);
  if (typeof kind === 'object') {
    report(ctx, cell.line, 'error', `Cell "${cell.id}": shape="${kind.stencil}" ${REFUSED.stencil}`);
    return;
  }

  const gradient = styleGet(cell.style, 'gradientcolor');
  if (gradient && gradient.toLowerCase() !== 'none' && gradient !== '') {
    report(ctx, cell.line, 'error', `Cell "${cell.id}": ${REFUSED.gradient}`);
    return;
  }

  if (styleGet(cell.style, 'sketch') === '1') {
    report(ctx, cell.line, 'error', `Cell "${cell.id}": ${REFUSED.sketch}`);
    return;
  }

  const { w, h } = cell.geo;
  if (w <= 0 || h <= 0) {
    report(ctx, cell.line, 'error', `Cell "${cell.id}" has no usable width and height, so it was skipped.`);
    return;
  }

  const abs = resolveAbs(cell, byId);
  const paint = readPaint(cell.style, { w, h });

  const isRectKind = kind === 'rect' || kind === 'rhombus' || kind === 'swimlane' || kind === 'group';
  if (!isRectKind && paint.rotation !== 0) {
    report(ctx, cell.line, 'error', `Cell "${cell.id}": ${REFUSED.rotation}`);
    return;
  }

  if (kind === 'triangle') {
    const dir = (styleGet(cell.style, 'direction') ?? 'north').toLowerCase();
    if (dir && dir !== 'north' && dir !== 'up') {
      report(ctx, cell.line, 'error', `Cell "${cell.id}": ${REFUSED.rotation}`);
      return;
    }
  }

  if (kind === 'text') {
    const text = labelText(ctx, cell);
    if (text) emitLabel(ctx, text, abs.x + w / 2, abs.y + h / 2, paint);
    return;
  }

  if (kind === 'ellipse') {
    emitShape(ctx, abs.x, abs.y, w, h, shapeData(paint, 'circle'));
    const text = labelText(ctx, cell);
    if (text) emitLabel(ctx, text, abs.x + w / 2, abs.y + h / 2, paint);
    return;
  }

  if (kind === 'triangle') {
    emitShape(ctx, abs.x, abs.y, w, h, shapeData(paint, 'triangle'));
    const text = labelText(ctx, cell);
    if (text) emitLabel(ctx, text, abs.x + w / 2, abs.y + h / 2, paint);
    return;
  }

  if (kind === 'rhombus') {
    emitRhombus(ctx, abs.x, abs.y, w, h, paint);
    const text = labelText(ctx, cell);
    if (text) emitLabel(ctx, text, abs.x + w / 2, abs.y + h / 2, paint);
    return;
  }

  // group / swimlane / rect: one flat rect. Children are siblings sharing
  // groupId; there is no parentId in the data model, by design.
  if ((kind === 'group' || kind === 'swimlane') && paint.rotation !== 0) {
    report(
      ctx,
      cell.line,
      'error',
      `Cell "${cell.id}": rotation on a container is refused — flattening children to siblings cannot rotate them with the box, so the box was drawn unrotated.`,
    );
  }

  const rotation = kind === 'rect' ? paint.rotation : 0;
  emitShape(ctx, abs.x, abs.y, w, h, shapeData(paint, 'rect', { cornerRadius: paint.cornerRadius, rotation }));

  const text = labelText(ctx, cell);
  if (!text) return;

  if (kind === 'swimlane') {
    const start = num(styleGet(cell.style, 'startsize'), 26);
    const vertical = styleGet(cell.style, 'horizontal') === '0';
    if (vertical) {
      emitLabel(ctx, text, abs.x + start / 2, abs.y + h / 2, paint);
    } else {
      emitLabel(ctx, text, abs.x + w / 2, abs.y + start / 2, paint);
    }
    return;
  }

  emitLabel(ctx, text, abs.x + w / 2, abs.y + h / 2, paint);
}

// ── Edges ───────────────────────────────────────────────────

/**
 * startArrow decision:
 *   none / absent — accepted; the segment is oriented source → target.
 *   classic       — accepted only when endArrow is none. The one available
 *                   head is then the start, so the point list is reversed and
 *                   the last segment becomes the arrow. Faithful: one head,
 *                   at the end that had classic.
 *   classic + any end head — refused. No double-headed primitive, and dropping
 *                   one head would misstate the drawing.
 *   anything else (diamond, oval, open, block, ERone, …) — refused by name.
 *                   Those heads have no canvas equivalent.
 */

interface Term {
  kind: 'box' | 'point';
  x: number;
  y: number;
  w: number;
  h: number;
}

function parentOrigin(cell: Cell, byId: Map<string, Cell>): Pt {
  const parent = cell.parentId ? byId.get(cell.parentId) : undefined;
  if (!parent) return { x: 0, y: 0 };
  return resolveAbs(parent, byId);
}

function terminalOf(cell: Cell, which: 'source' | 'target', byId: Map<string, Cell>): Term | null {
  const id = which === 'source' ? cell.sourceId : cell.targetId;
  const fallback = which === 'source' ? cell.geo.sourcePoint : cell.geo.targetPoint;
  if (id) {
    const other = byId.get(id);
    if (other && other.vertex && other.geo.w > 0 && other.geo.h > 0) {
      const abs = resolveAbs(other, byId);
      return { kind: 'box', x: abs.x, y: abs.y, w: other.geo.w, h: other.geo.h };
    }
  }
  if (fallback) {
    const origin = parentOrigin(cell, byId);
    return { kind: 'point', x: origin.x + fallback.x, y: origin.y + fallback.y, w: 0, h: 0 };
  }
  return null;
}

function centreOf(term: Term): Pt {
  if (term.kind === 'point') return { x: term.x, y: term.y };
  return { x: term.x + term.w / 2, y: term.y + term.h / 2 };
}

/**
 * First intersection of the ray `inside → toward` with `box`'s boundary.
 * `inside` is the box centre; used to clip a centre-to-centre (or
 * centre-to-waypoint) segment onto the cell's border.
 */
function boxExit(inside: Pt, toward: Pt, box: Term): Pt {
  const dx = toward.x - inside.x;
  const dy = toward.y - inside.y;
  if (dx === 0 && dy === 0) return { x: inside.x, y: inside.y };
  const left = box.x;
  const right = box.x + box.w;
  const top = box.y;
  const bottom = box.y + box.h;
  const candidates: number[] = [];
  if (dx !== 0) {
    candidates.push((left - inside.x) / dx);
    candidates.push((right - inside.x) / dx);
  }
  if (dy !== 0) {
    candidates.push((top - inside.y) / dy);
    candidates.push((bottom - inside.y) / dy);
  }
  let best = Infinity;
  const on = 1e-6;
  for (const t of candidates) {
    if (t <= 1e-9 || t >= best) continue;
    const px = inside.x + t * dx;
    const py = inside.y + t * dy;
    if (px >= left - on && px <= right + on && py >= top - on && py <= bottom + on) {
      best = t;
    }
  }
  if (!Number.isFinite(best) || best >= 1) return { x: inside.x, y: inside.y };
  return { x: inside.x + best * dx, y: inside.y + best * dy };
}

function clipEnd(term: Term, toward: Pt): Pt {
  if (term.kind === 'point') return { x: term.x, y: term.y };
  return boxExit(centreOf(term), toward, term);
}

function isRouterStyle(style: Style): string | null {
  const raw = styleGet(style, 'edgestyle');
  if (raw == null || raw === '') return null;
  const low = raw.trim().toLowerCase();
  if (!low || low === 'none' || low === 'straight' || low === 'straightedgestyle') return null;
  return raw;
}

function startArrowKind(raw: string | undefined): 'none' | 'classic' | 'other' {
  if (raw == null || raw === '') return 'none';
  const v = raw.trim().toLowerCase();
  if (!v || v === 'none' || v === '0') return 'none';
  if (v === 'classic') return 'classic';
  return 'other';
}

function endHasHead(raw: string | undefined): boolean {
  return (raw ?? '').trim().toLowerCase() !== 'none';
}

function emitSegment(ctx: Ctx, a: Pt, b: Pt, paint: Paint, arrow: boolean): boolean {
  const width = b.x - a.x;
  const height = b.y - a.y;
  if (width === 0 && height === 0) return false;
  return pushNode(ctx, {
    id: generateId(),
    type: 'shape',
    x: ctx.origin.x + a.x,
    y: ctx.origin.y + a.y,
    width,
    height,
    layer: LAYER_LINK,
    groupId: ctx.groupId,
    data: {
      shapeType: arrow ? 'arrow' : 'line',
      fill: 'transparent',
      stroke: paint.stroke,
      strokeWidth: paint.strokeWidth,
      strokeDash: paint.dash,
    },
  });
}

function longestMid(pts: Pt[]): Pt | null {
  if (pts.length < 2) return null;
  let best = 0;
  let bestLen = -1;
  for (let i = 0; i < pts.length - 1; i += 1) {
    const dx = pts[i + 1].x - pts[i].x;
    const dy = pts[i + 1].y - pts[i].y;
    const len = dx * dx + dy * dy;
    if (len > bestLen) {
      bestLen = len;
      best = i;
    }
  }
  return {
    x: (pts[best].x + pts[best + 1].x) / 2,
    y: (pts[best].y + pts[best + 1].y) / 2,
  };
}

function edgeLabelText(ctx: Ctx, cell: Cell, cells: Cell[]): string | null {
  const own = labelText(ctx, cell);
  if (own) return own;
  for (const child of cells) {
    if (child.parentId === cell.id && !child.edge) {
      const text = labelText(ctx, child);
      if (text) return text;
    }
  }
  return null;
}

function emitEdge(ctx: Ctx, cell: Cell, byId: Map<string, Cell>, cells: Cell[]): void {
  if (cell.nested) {
    report(ctx, cell.line, 'error', REFUSED.nested);
    return;
  }

  if (styleGet(cell.style, 'sketch') === '1') {
    report(ctx, cell.line, 'error', `Cell "${cell.id}": ${REFUSED.sketch}`);
    return;
  }

  if (styleGet(cell.style, 'curved') === '1') {
    report(ctx, cell.line, 'error', `Cell "${cell.id}": ${REFUSED.curved}`);
    return;
  }

  const router = isRouterStyle(cell.style);
  const hasWaypoints = cell.geo.points.length > 0;
  if (router && !hasWaypoints) {
    report(ctx, cell.line, 'error', `Cell "${cell.id}": edgeStyle=${router} ${REFUSED.router}`);
    return;
  }

  // rounded=1 on a 2-point edge is a no-op; on a bent path it fillets corners
  // we cannot draw, so a straightened polyline would misstate the drawing.
  if (styleGet(cell.style, 'rounded') === '1' && hasWaypoints) {
    report(ctx, cell.line, 'error', `Cell "${cell.id}": ${REFUSED.rounded}`);
    return;
  }

  const startRaw = styleGet(cell.style, 'startarrow');
  const endRaw = styleGet(cell.style, 'endarrow');
  const startKind = startArrowKind(startRaw);
  const headAtEnd = endHasHead(endRaw);

  if (startKind === 'other') {
    report(ctx, cell.line, 'error', `Cell "${cell.id}": startArrow=${startRaw} ${REFUSED.startArrow}`);
    return;
  }
  if (startKind === 'classic' && headAtEnd) {
    report(
      ctx,
      cell.line,
      'error',
      `Cell "${cell.id}": startArrow=classic with endArrow=${endRaw ?? 'classic'} ${REFUSED.bothArrows}`,
    );
    return;
  }

  const src = terminalOf(cell, 'source', byId);
  const tgt = terminalOf(cell, 'target', byId);
  if (!src || !tgt) {
    report(ctx, cell.line, 'error', `Cell "${cell.id}" has no usable terminals, so it was skipped.`);
    return;
  }

  const origin = parentOrigin(cell, byId);
  const mids = cell.geo.points.map((p) => ({ x: origin.x + p.x, y: origin.y + p.y }));
  let pts: Pt[];
  if (mids.length > 0) {
    pts = [clipEnd(src, mids[0]), ...mids, clipEnd(tgt, mids[mids.length - 1])];
  } else {
    const a = centreOf(src);
    const b = centreOf(tgt);
    pts = [clipEnd(src, b), clipEnd(tgt, a)];
  }

  const reverse = startKind === 'classic' && !headAtEnd;
  if (reverse) pts = pts.slice().reverse();

  const paint = readPaint(cell.style, { w: 1, h: 1 });
  const arrowLast = headAtEnd || reverse;
  let emitted = 0;
  for (let i = 0; i < pts.length - 1; i += 1) {
    const isLast = i === pts.length - 2;
    if (emitSegment(ctx, pts[i], pts[i + 1], paint, isLast && arrowLast)) emitted += 1;
  }
  if (emitted === 0) {
    report(ctx, cell.line, 'error', `Cell "${cell.id}" has no usable length, so it was skipped.`);
    return;
  }

  const text = edgeLabelText(ctx, cell, cells);
  if (!text) return;
  const mid = longestMid(pts);
  if (mid) emitLabel(ctx, text, mid.x, mid.y, paint);
}

function isParserError(doc: Document): boolean {
  return doc.getElementsByTagName('parsererror').length > 0;
}

function pageTitle(diagram: Element, index: number): string {
  return attr(diagram, 'name') ?? attr(diagram, 'id') ?? `page ${index + 1}`;
}

function modelOf(host: Element): Element | null {
  const direct = Array.from(host.children).find((c) => tagOf(c) === 'mxgraphmodel');
  if (direct) return direct;
  const nested = host.getElementsByTagName('mxGraphModel')[0];
  if (nested) return nested;
  const text = (host.textContent ?? '').trim();
  if (text.startsWith('<')) {
    const inner = new DOMParser().parseFromString(text, 'application/xml');
    if (!isParserError(inner)) {
      return inner.getElementsByTagName('mxGraphModel')[0] ?? (tagOf(inner.documentElement) === 'mxgraphmodel' ? inner.documentElement : null);
    }
  }
  return null;
}

function looksCompressed(diagram: Element): boolean {
  if (diagram.getElementsByTagName('mxGraphModel').length > 0) return false;
  // Inflated-but-not-a-graph payloads land as child elements (HTML, SVG) or
  // as plain text. Those are uncompressed — just not mxGraph. Only a
  // base64-looking blob is still a compressed page.
  if (diagram.children.length > 0) return false;
  const text = (diagram.textContent ?? '').trim();
  if (!text || text.startsWith('<')) return false;
  const compact = text.replace(/\s+/g, '');
  // Letters alone are a valid base64 alphabet — require a + / or = so
  // inflated English is not re-diagnosed as a compressed page.
  return compact.length > 16 && /^[A-Za-z0-9+/=]+$/.test(compact) && /[+/=]/.test(compact);
}

function collectCells(root: Element, ctx: Ctx): Cell[] {
  const cells: Cell[] = [];
  for (const child of Array.from(root.children)) {
    const tag = tagOf(child);
    const line = nextLine(ctx, tag);
    const rec = readCell(child, line);
    if (rec) cells.push(rec);
  }
  return cells;
}

/**
 * Never throws. A malformed document, a missing DOMParser or an unreadable
 * cell becomes a diagnostic plus whatever else could be understood, because
 * the caller is a canvas that has to keep working either way.
 */
export function transpileDrawio(source: string, options: TranspileDrawioOptions): TranspileDrawioResult {
  const ctx: Ctx = {
    nodes: [],
    diagnostics: [],
    groupId: options.groupId,
    origin: options.origin,
    measure: options.measureText ?? canvasMeasureText,
    tags: [],
    cursor: 0,
    overBudget: false,
  };

  try {
    if (typeof DOMParser === 'undefined') {
      report(ctx, 0, 'error', 'draw.io import needs DOMParser, which this environment does not provide.');
      return { nodes: [], diagnostics: ctx.diagnostics };
    }
    if (typeof source !== 'string' || !source.trim()) {
      report(ctx, 0, 'error', 'The draw.io source is empty.');
      return { nodes: [], diagnostics: ctx.diagnostics };
    }

    ctx.tags = scanTags(source);
    const doc = new DOMParser().parseFromString(source, 'application/xml');
    if (isParserError(doc)) {
      report(ctx, 0, 'error', 'The source is not well-formed XML, so nothing was drawn.');
      return { nodes: [], diagnostics: ctx.diagnostics };
    }

    const diagrams = Array.from(doc.getElementsByTagName('diagram'));
    let model: Element | null = null;

    if (diagrams.length > 0) {
      for (let i = 1; i < diagrams.length; i += 1) {
        const title = pageTitle(diagrams[i], i);
        report(ctx, 0, 'ignored', `page ${i + 1} '${title}' skipped — one frame holds one page`);
      }
      const first = diagrams[0];
      if (looksCompressed(first)) {
        report(
          ctx,
          0,
          'error',
          `Page '${pageTitle(first, 0)}' has no readable <mxGraphModel> — the payload is still compressed (base64+deflate) or is not valid deflate. Pass it through normalizeDrawioSource; if this persists the bytes are not a drawing.`,
        );
        return { nodes: [], diagnostics: ctx.diagnostics };
      }
      model = modelOf(first);
    } else {
      model =
        doc.getElementsByTagName('mxGraphModel')[0] ??
        (tagOf(doc.documentElement) === 'mxgraphmodel' ? doc.documentElement : null);
    }

    if (!model) {
      report(ctx, 0, 'error', 'No <mxGraphModel> was found in the source.');
      return { nodes: [], diagnostics: ctx.diagnostics };
    }

    const root =
      Array.from(model.children).find((c) => tagOf(c) === 'root') ??
      model.getElementsByTagName('root')[0] ??
      null;
    if (!root) {
      report(ctx, 0, 'error', 'The <mxGraphModel> has no <root>, so nothing was drawn.');
      return { nodes: [], diagnostics: ctx.diagnostics };
    }

    const cells = collectCells(root, ctx);
    const byId = new Map<string, Cell>();
    for (const cell of cells) byId.set(cell.id, cell);

    for (const cell of cells) {
      if (!cell.vertex || cell.edge) continue;
      const parent = cell.parentId ? byId.get(cell.parentId) : undefined;
      if (parent?.edge) continue;
      emitVertex(ctx, cell, byId);
    }
    for (const cell of cells) {
      if (!cell.edge) continue;
      emitEdge(ctx, cell, byId, cells);
    }

    if (ctx.nodes.length === 0 && ctx.diagnostics.length === 0) {
      report(ctx, 0, 'ignored', 'The draw.io file held nothing this transpiler could draw.');
    }
    return { nodes: ctx.nodes, diagnostics: ctx.diagnostics };
  } catch (err) {
    report(ctx, 0, 'error', `Could not read the draw.io file: ${err instanceof Error ? err.message : String(err)}`);
    return { nodes: ctx.nodes, diagnostics: ctx.diagnostics };
  }
}

// ── Compression ─────────────────────────────────────────────

/**
 * draw.io stores a page as URI-encoded XML, raw-deflated, then base64. The
 * inflated bytes are a mix of `%XX` for reserved ASCII and raw UTF-8 for
 * everything else, which is why `decodeURIComponent` runs after inflate.
 */
async function inflateRawBase64(payload: string): Promise<string | null> {
  try {
    const compact = payload.replace(/\s+/g, '');
    if (!compact) return null;
    if (typeof atob !== 'function' || typeof DecompressionStream === 'undefined') return null;
    const bin = atob(compact);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    const inflated = await new Response(stream).text();
    try {
      return decodeURIComponent(inflated);
    } catch {
      return inflated;
    }
  } catch {
    return null;
  }
}

function replaceDiagramPayload(doc: Document, diagram: Element, xml: string): void {
  while (diagram.firstChild) diagram.removeChild(diagram.firstChild);
  const inner = new DOMParser().parseFromString(xml, 'application/xml');
  if (isParserError(inner) || !inner.documentElement) {
    // Inflated but not XML. A text node would still look compressed
    // (letters are a valid base64 alphabet). An empty marker element
    // makes the page visibly uncompressed so transpile names the miss
    // as "no <mxGraphModel>" rather than "still compressed".
    diagram.appendChild(doc.createElement('unknown'));
    return;
  }
  diagram.appendChild(doc.importNode(inner.documentElement, true));
}

/**
 * If a `<diagram>` payload is base64+raw-deflate text, inflate it and return
 * the mxfile with that payload replaced by readable XML. Already-uncompressed
 * input is returned unchanged. Never throws.
 */
export async function normalizeDrawioSource(source: string): Promise<string> {
  try {
    if (typeof source !== 'string' || !source.trim()) return source;
    if (typeof DOMParser === 'undefined') return source;

    const doc = new DOMParser().parseFromString(source, 'application/xml');
    if (isParserError(doc)) return source;

    const diagrams = Array.from(doc.getElementsByTagName('diagram'));
    if (diagrams.length === 0) return source;

    let changed = false;
    for (const diagram of diagrams) {
      if (!looksCompressed(diagram)) continue;
      const payload = (diagram.textContent ?? '').trim();
      const xml = await inflateRawBase64(payload);
      if (xml == null) continue;
      replaceDiagramPayload(doc, diagram, xml);
      changed = true;
    }
    if (!changed) return source;
    return new XMLSerializer().serializeToString(doc);
  } catch {
    return source;
  }
}
