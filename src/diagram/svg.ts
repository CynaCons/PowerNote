/**
 * A documented subset of SVG, transpiled into ordinary canvas nodes.
 *
 * Same bargain as the PlantUML path in `materialize.ts`: every mark lands as a
 * plain ShapeNode or TextNode sharing a groupId, so an imported drawing can be
 * taken apart with the tools that already exist. Fidelity is the thing we trade
 * away for that, which is why `<path>` is refused instead of being flattened
 * into segments — a polyline standing in for a curve is a lie that survives
 * every later edit, and the user has no way to tell it was ever a lie.
 *
 * Understood: `<svg>` (viewBox / width / height), `<g transform>` with translate
 * and uniform scale, `<rect>` (incl. `rx`), `<circle>`, `<ellipse>`, `<line>`,
 * `<polyline>`, `<polygon>`, and `<text>` with `<tspan>`. Paint comes from
 * `fill`, `stroke`, `stroke-width` and `stroke-dasharray`, written either as
 * presentation attributes or inside a `style` attribute, and inherits down the
 * tree the way SVG says it should.
 *
 * Everything else is named in a diagnostic and dropped. Nothing here throws:
 * the caller is a canvas that has to keep working on input it did not author.
 */

import type { CanvasNode, ShapeNodeData, TextNodeData } from '../types/data';
import { generateId } from '../utils/ids';
import { MIN_TEXT_WIDTH } from '../utils/pageLayout';
import { MARKDOWN_PADDING } from '../utils/renderMarkdown';
import { canvasMeasureText } from './layout';
import { INK } from './tokens';
import type { Diagnostic, DiagnosticSeverity, MeasureText } from './types';

export interface TranspileSvgOptions {
  /** Shared by every node produced, so the drawing can be found again. */
  groupId: string;
  /** Page coordinates the drawing's viewBox origin lands on. */
  origin: { x: number; y: number };
  measureText?: MeasureText;
}

export interface TranspileSvgResult {
  nodes: CanvasNode[];
  diagnostics: Diagnostic[];
}

/** One font across the app, so an imported drawing does not arrive in Times. */
const FONT_FAMILY = 'Inter, system-ui, sans-serif';

/**
 * Shapes all share a layer because SVG paints in document order and the canvas
 * sorts by layer with a stable sort — equal layers keep insertion order, which
 * is document order. Text goes above, as it does everywhere else here.
 */
const LAYER_SHAPE = 3;
const LAYER_TEXT = 5;

/**
 * With line-height 1.4, half the leading (0.2em) sits above a roughly 0.8em
 * ascent, putting the baseline about one em below the top of the text box. SVG
 * positions text by that baseline and we position nodes by their top corner.
 */
const BASELINE_FROM_TOP = 1.0;

/** An import that wants more nodes than this is a mistake, not a diagram. */
const NODE_BUDGET = 4000;
/** Past this the list has stopped being a report and started being the payload. */
const DIAGNOSTIC_BUDGET = 200;

/** CSS absolute units, in px. Percentages resolve against nothing here. */
const UNIT_PX: Record<string, number> = {
  px: 1,
  pt: 96 / 72,
  pc: 16,
  mm: 96 / 25.4,
  cm: 96 / 2.54,
  in: 96,
};

/**
 * Elements we can only get wrong. Each message names the element and says what
 * to do instead, because "some of your drawing is missing" is not a diagnostic.
 *
 * Keys are lowercased: the XML parser preserves `linearGradient` but the HTML
 * fallback parser does not, and only one of the two can be matched on.
 */
const REFUSED: Record<string, string> = {
  path: '<path> is refused rather than approximated — flattening its curves into segments would produce a drawing that is subtly wrong forever. Redraw it with <line>, <polyline>, <rect>, <circle> or <ellipse>.',
  image: '<image> is refused — an embedded raster is not a canvas node. Import the picture as an image block instead.',
  use: '<use> is refused — instancing a definition would need a full SVG renderer. Inline the referenced shapes and re-import.',
  symbol: '<symbol> is refused — it is a template for <use>, which is not supported.',
  marker: '<marker> is refused as drawn content. A marker-end on a <line> becomes a canvas arrowhead; nothing else about the marker survives.',
  mask: '<mask> is refused — canvas nodes cannot be masked, and dropping the mask silently would draw shapes the author meant to hide.',
  clippath: '<clipPath> is refused — canvas nodes cannot be clipped, and ignoring the clip would draw past the intended edge.',
  filter: '<filter> is refused — blurs, shadows and colour matrices have no canvas equivalent.',
  lineargradient: '<linearGradient> is refused — a shape node carries one flat fill, and picking a stop colour would misrepresent the drawing.',
  radialgradient: '<radialGradient> is refused — a shape node carries one flat fill, and picking a stop colour would misrepresent the drawing.',
  pattern: '<pattern> is refused — a shape node carries one flat fill.',
  foreignobject: '<foreignObject> is refused — its content is HTML, not SVG.',
  textpath: '<textPath> is refused — text on a path needs the path, which is itself refused.',
  style: '<style> is refused — CSS rules are not applied, so honouring the elements they style would draw them with the wrong paint. Move the styling onto presentation or style attributes.',
  script: '<script> is refused — imported drawings do not run code.',
  switch: '<switch> is refused — choosing a branch needs feature evaluation this transpiler does not do.',
  animate: '<animate> is refused — canvas nodes are static.',
  animatetransform: '<animateTransform> is refused — canvas nodes are static.',
  animatemotion: '<animateMotion> is refused — canvas nodes are static.',
  set: '<set> is refused — canvas nodes are static.',
  svg: 'A nested <svg> is refused — it opens a second viewport with its own scaling, and flattening it would move everything inside.',
};

/** Metadata: dropped on purpose, and saying so every time would be noise. */
const SILENT = new Set(['title', 'desc', 'metadata']);

type TextAnchor = 'start' | 'middle' | 'end';

/** Resolved presentation state, inherited down the tree as SVG specifies. */
interface Paint {
  fill: string;
  stroke: string;
  strokeWidth: number;
  dash: number[];
  fontSize: number;
  fontWeight: number;
  italic: boolean;
  anchor: TextAnchor;
}

/** User space to canvas: translate by (dx, dy) after scaling by s. */
interface Frame {
  dx: number;
  dy: number;
  s: number;
  paint: Paint;
}

interface TagRef {
  tag: string;
  line: number;
}

interface Ctx {
  nodes: CanvasNode[];
  diagnostics: Diagnostic[];
  groupId: string;
  measure: MeasureText;
  tags: TagRef[];
  cursor: number;
  overBudget: boolean;
}

const ROOT_PAINT: Paint = {
  // SVG's initial fill is black and its initial stroke is none. INK is this
  // project's black, so an unstyled drawing still belongs to the same system.
  fill: INK,
  stroke: 'transparent',
  strokeWidth: 1,
  dash: [],
  fontSize: 16,
  fontWeight: 400,
  italic: false,
  anchor: 'start',
};

// ── Source line lookup ──────────────────────────────────────

/**
 * DOMParser hands back a tree with no source positions, so diagnostics would
 * have to say "line 0" for everything. Scanning the raw text for open tags in
 * order gives a line per tag, and since DOM order is document order the two
 * lists walk together. A `<` inside a CDATA block can shift them, which is why
 * `nextLine` searches forward for the tag it expects rather than trusting the
 * cursor, and why nothing but a diagnostic's line number depends on this.
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

/** Lookahead is bounded so a desync costs a wrong line, never a hang. */
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

// ── Attribute reading ───────────────────────────────────────

function tagOf(el: Element): string {
  return (el.localName || el.tagName || '').toLowerCase();
}

/**
 * Case-insensitive fallback: the XML parser keeps whatever case the author
 * wrote, so `viewbox` and `viewBox` are different attributes to `getAttribute`
 * but the same intent to a person.
 */
function attr(el: Element, name: string): string | null {
  const direct = el.getAttribute(name);
  if (direct !== null) return direct;
  const lower = name.toLowerCase();
  for (const a of Array.from(el.attributes)) {
    if (a.name.toLowerCase() === lower) return a.value;
  }
  return null;
}

/** A CSS length in px. `em` needs a basis; without one it is unresolvable. */
function length(value: string | null | undefined, em = 0): number | null {
  if (value === null || value === undefined) return null;
  const m = /^\s*([+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)\s*(px|pt|pc|mm|cm|in|em)?\s*$/i.exec(value);
  if (!m) return null;
  const n = Number.parseFloat(m[1]);
  if (!Number.isFinite(n)) return null;
  const unit = (m[2] ?? 'px').toLowerCase();
  if (unit === 'em') return em > 0 ? n * em : null;
  return n * (UNIT_PX[unit] ?? 1);
}

function parseStyleAttr(raw: string | null): Map<string, string> {
  const out = new Map<string, string>();
  if (!raw) return out;
  for (const decl of raw.split(';')) {
    const colon = decl.indexOf(':');
    if (colon < 0) continue;
    const key = decl.slice(0, colon).trim().toLowerCase();
    const value = decl.slice(colon + 1).trim();
    if (key) out.set(key, value);
  }
  return out;
}

/** null means "this paint cannot be represented" — the caller drops the element. */
function colour(raw: string, inherited: string): string | null {
  const v = raw.trim();
  if (!v) return inherited;
  const low = v.toLowerCase();
  if (low === 'none' || low === 'transparent') return 'transparent';
  if (low === 'inherit') return inherited;
  // There is no colour cascade to read `currentColor` from, and black is the
  // CSS initial value for `color`.
  if (low === 'currentcolor') return INK;
  if (low.startsWith('url(')) return null;
  return v;
}

function dashes(raw: string, em: number): number[] {
  if (/^\s*(none|inherit)\s*$/i.test(raw)) return [];
  const parts: number[] = [];
  for (const piece of raw.split(/[\s,]+/)) {
    if (!piece) continue;
    const n = length(piece, em);
    if (n === null || n < 0) return [];
    parts.push(n);
  }
  return parts;
}

function weightOf(raw: string, inherited: number): number {
  const low = raw.trim().toLowerCase();
  if (low === 'bold' || low === 'bolder') return 700;
  if (low === 'normal' || low === 'lighter') return 400;
  const n = Number.parseInt(low, 10);
  return Number.isFinite(n) ? n : inherited;
}

/**
 * Merges an element's own presentation onto what it inherits. Returns null when
 * the element asks for something with no canvas equivalent, which is a refusal
 * of the element rather than of the property: drawing a gradient-filled shape
 * in one flat colour is exactly the kind of quiet wrongness this file avoids.
 */
function readPaint(el: Element, base: Paint, ctx: Ctx, line: number, tag: string): Paint | null {
  const styles = parseStyleAttr(attr(el, 'style'));
  const get = (name: string): string | null => styles.get(name) ?? attr(el, name);

  for (const prop of ['filter', 'mask', 'clip-path']) {
    const v = get(prop);
    if (v && v.trim().toLowerCase() !== 'none') {
      report(
        ctx,
        line,
        'error',
        `<${tag}> carries ${prop}="${v.trim()}", which has no canvas equivalent — the element was skipped rather than drawn without it.`,
      );
      return null;
    }
  }

  const next: Paint = { ...base };

  const rawFill = get('fill');
  if (rawFill !== null) {
    const c = colour(rawFill, base.fill);
    if (c === null) {
      report(
        ctx,
        line,
        'error',
        `<${tag}> is painted with fill="${rawFill.trim()}", a gradient or pattern reference. A shape node holds one flat colour, so the element was skipped rather than recoloured.`,
      );
      return null;
    }
    next.fill = c;
  }

  const rawStroke = get('stroke');
  if (rawStroke !== null) {
    const c = colour(rawStroke, base.stroke);
    if (c === null) {
      report(
        ctx,
        line,
        'error',
        `<${tag}> is stroked with stroke="${rawStroke.trim()}", a gradient or pattern reference, so the element was skipped rather than recoloured.`,
      );
      return null;
    }
    next.stroke = c;
  }

  const fontSize = length(get('font-size'), base.fontSize);
  if (fontSize !== null && fontSize > 0) next.fontSize = fontSize;

  const strokeWidth = length(get('stroke-width'), next.fontSize);
  if (strokeWidth !== null && strokeWidth >= 0) next.strokeWidth = strokeWidth;

  const dash = get('stroke-dasharray');
  if (dash !== null) next.dash = dashes(dash, next.fontSize);

  const fontWeight = get('font-weight');
  if (fontWeight !== null) next.fontWeight = weightOf(fontWeight, base.fontWeight);

  const fontStyle = get('font-style');
  if (fontStyle !== null) next.italic = /italic|oblique/i.test(fontStyle);

  const anchor = get('text-anchor');
  if (anchor === 'start' || anchor === 'middle' || anchor === 'end') next.anchor = anchor;

  for (const prop of ['opacity', 'fill-opacity', 'stroke-opacity']) {
    const v = get(prop);
    const n = v === null ? null : Number.parseFloat(v);
    if (n !== null && Number.isFinite(n) && n < 1) {
      report(
        ctx,
        line,
        'ignored',
        `${prop}="${v?.trim()}" on <${tag}> was dropped — a canvas node has no opacity, so the mark is drawn at full strength.`,
      );
    }
  }

  return next;
}

/**
 * Only translate and uniform scale survive. A rotation would have to become the
 * node's `rotation`, which Konva takes about the node's own top-left rather than
 * the user-space origin SVG rotates about, so anything not at the origin would
 * land somewhere else entirely. Refusing beats moving the drawing.
 */
function pushTransform(raw: string | null, f: Frame, ctx: Ctx, line: number, tag: string): Frame | null {
  if (!raw || !raw.trim()) return f;
  let out = f;
  const re = /([A-Za-z]+)\s*\(([^)]*)\)/g;
  let match: RegExpExecArray | null;
  let seen = false;
  while ((match = re.exec(raw)) !== null) {
    seen = true;
    const name = match[1].toLowerCase();
    const args = match[2]
      .split(/[\s,]+/)
      .filter(Boolean)
      .map(Number);
    if (args.some((n) => !Number.isFinite(n))) {
      report(ctx, line, 'error', `transform="${raw.trim()}" on <${tag}> could not be read, so the element was skipped.`);
      return null;
    }
    if (name === 'translate') {
      out = { ...out, dx: out.dx + (args[0] ?? 0) * out.s, dy: out.dy + (args[1] ?? 0) * out.s };
    } else if (name === 'scale') {
      const sx = args[0] ?? 1;
      const sy = args.length > 1 ? args[1] : sx;
      if (sx !== sy || sx <= 0) {
        report(
          ctx,
          line,
          'error',
          `transform="scale(${args.join(', ')})" on <${tag}> is not a positive uniform scale — stroke widths and text would have to stretch by different amounts per axis, so the element was skipped.`,
        );
        return null;
      }
      out = { ...out, s: out.s * sx };
    } else {
      report(
        ctx,
        line,
        'error',
        `transform="${name}(…)" on <${tag}> is not supported — only translate and uniform scale map onto canvas nodes, so the element and everything inside it was skipped.`,
      );
      return null;
    }
  }
  if (!seen) {
    report(ctx, line, 'error', `transform="${raw.trim()}" on <${tag}> could not be read, so the element was skipped.`);
    return null;
  }
  return out;
}

// ── Emitting ────────────────────────────────────────────────

function shapeData(
  paint: Paint,
  s: number,
  shapeType: ShapeNodeData['shapeType'],
  extra?: Partial<ShapeNodeData>,
): ShapeNodeData {
  return {
    shapeType,
    fill: paint.fill,
    stroke: paint.stroke,
    strokeWidth: Math.max(0, paint.strokeWidth * s),
    strokeDash: paint.dash.map((d) => d * s),
    ...extra,
  };
}

function pushShape(
  ctx: Ctx,
  f: Frame,
  x: number,
  y: number,
  width: number,
  height: number,
  data: ShapeNodeData,
): void {
  ctx.nodes.push({
    id: generateId(),
    type: 'shape',
    x: f.dx + x * f.s,
    y: f.dy + y * f.s,
    width: width * f.s,
    height: height * f.s,
    layer: LAYER_SHAPE,
    groupId: ctx.groupId,
    data,
  });
}

function emitRect(el: Element, ctx: Ctx, f: Frame, line: number): void {
  const width = length(attr(el, 'width'), f.paint.fontSize);
  const height = length(attr(el, 'height'), f.paint.fontSize);
  if (width === null || height === null) {
    report(ctx, line, 'error', '<rect> has no usable width and height (percentages are not resolvable here), so it was skipped.');
    return;
  }
  if (width <= 0 || height <= 0) return; // SVG: a zero dimension disables rendering.

  const x = length(attr(el, 'x')) ?? 0;
  const y = length(attr(el, 'y')) ?? 0;
  const rx = length(attr(el, 'rx'));
  const ry = length(attr(el, 'ry'));
  if (rx !== null && ry !== null && rx !== ry) {
    report(ctx, line, 'ignored', `<rect> has elliptical corners (rx=${rx}, ry=${ry}); a canvas rect has one corner radius, so rx was used for both.`);
  }
  const radius = Math.max(0, Math.min(rx ?? ry ?? 0, Math.min(width, height) / 2));

  pushShape(ctx, f, x, y, width, height, shapeData(f.paint, f.s, 'rect', { cornerRadius: radius * f.s }));
}

function emitCircle(el: Element, ctx: Ctx, f: Frame, line: number): void {
  const r = length(attr(el, 'r'));
  if (r === null) {
    report(ctx, line, 'error', '<circle> has no usable r, so it was skipped.');
    return;
  }
  if (r <= 0) return;
  const cx = length(attr(el, 'cx')) ?? 0;
  const cy = length(attr(el, 'cy')) ?? 0;
  pushShape(ctx, f, cx - r, cy - r, r * 2, r * 2, shapeData(f.paint, f.s, 'circle'));
}

function emitEllipse(el: Element, ctx: Ctx, f: Frame, line: number): void {
  const rx = length(attr(el, 'rx'));
  const ry = length(attr(el, 'ry'));
  if (rx === null || ry === null) {
    report(ctx, line, 'error', '<ellipse> has no usable rx and ry, so it was skipped.');
    return;
  }
  if (rx <= 0 || ry <= 0) return;
  const cx = length(attr(el, 'cx')) ?? 0;
  const cy = length(attr(el, 'cy')) ?? 0;
  // The `circle` shape renders as a Konva Ellipse filling the node box, so an
  // ellipse is the same node type with a box that is not square.
  pushShape(ctx, f, cx - rx, cy - ry, rx * 2, ry * 2, shapeData(f.paint, f.s, 'circle'));
}

/** Linear nodes store a signed direction vector in width/height, not a box. */
function pushSegment(
  ctx: Ctx,
  f: Frame,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  arrow: boolean,
  stroke: string,
): void {
  ctx.nodes.push({
    id: generateId(),
    type: 'shape',
    x: f.dx + x1 * f.s,
    y: f.dy + y1 * f.s,
    width: (x2 - x1) * f.s,
    height: (y2 - y1) * f.s,
    layer: LAYER_SHAPE,
    groupId: ctx.groupId,
    data: {
      shapeType: arrow ? 'arrow' : 'line',
      fill: 'transparent',
      stroke,
      strokeWidth: Math.max(0.5, f.paint.strokeWidth * f.s),
      strokeDash: f.paint.dash.map((d) => d * f.s),
    },
  });
}

function emitLine(el: Element, ctx: Ctx, f: Frame, line: number): void {
  if (f.paint.stroke === 'transparent') {
    // A line is painted only by its stroke, so SVG draws nothing here either.
    report(ctx, line, 'ignored', '<line> has no stroke, so SVG draws nothing for it and neither does PowerScroll.');
    return;
  }
  const x1 = length(attr(el, 'x1')) ?? 0;
  const y1 = length(attr(el, 'y1')) ?? 0;
  const x2 = length(attr(el, 'x2')) ?? 0;
  const y2 = length(attr(el, 'y2')) ?? 0;
  // The <marker> itself is refused, but the fact that a line ends in one is the
  // author saying "arrow", and the canvas has an arrow.
  const marker = attr(el, 'marker-end');
  pushSegment(ctx, f, x1, y1, x2, y2, !!marker && marker.trim().toLowerCase() !== 'none', f.paint.stroke);
}

/** All or nothing: dropping one bad number would re-pair every point after it. */
function parsePoints(raw: string | null): number[] {
  if (!raw) return [];
  const nums = raw
    .split(/[\s,]+/)
    .filter(Boolean)
    .map(Number);
  return nums.some((n) => !Number.isFinite(n)) ? [] : nums;
}

function emitPolyline(el: Element, ctx: Ctx, f: Frame, line: number, closed: boolean): void {
  const tag = closed ? 'polygon' : 'polyline';
  const nums = parsePoints(attr(el, 'points'));
  if (nums.length < 4 || nums.length % 2 !== 0) {
    report(ctx, line, 'error', `<${tag}> has no usable points list, so it was skipped.`);
    return;
  }
  // A shape with no outline node can still be drawn edge by edge; the fill has
  // nowhere to go. When there is no stroke either, that fill colour draws the
  // outline, which is a substitution the diagnostic states out loud.
  const stroke = f.paint.stroke !== 'transparent' ? f.paint.stroke : f.paint.fill;
  if (f.paint.fill !== 'transparent') {
    report(
      ctx,
      line,
      'ignored',
      `<${tag}> was drawn as its outline only — there is no polygon node to pour fill="${f.paint.fill}" into.${
        f.paint.stroke === 'transparent' ? ' The outline is drawn in that fill colour so the shape is not lost.' : ''
      }`,
    );
  }
  if (stroke === 'transparent') return; // Nothing to paint with; SVG shows nothing either.

  // Each segment is exactly a line, so the decomposition is faithful; what is
  // lost is that the segments no longer know they belong to one outline.
  const count = nums.length / 2;
  const last = closed ? count : count - 1;
  for (let i = 0; i < last; i += 1) {
    const j = (i + 1) % count;
    pushSegment(ctx, f, nums[i * 2], nums[i * 2 + 1], nums[j * 2], nums[j * 2 + 1], false, stroke);
  }
}

interface Run {
  text: string;
  x: number;
  y: number;
  paint: Paint;
}

function normalise(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim();
}

function samePaint(a: Paint, b: Paint): boolean {
  return a.fill === b.fill && a.fontSize === b.fontSize && a.fontWeight === b.fontWeight && a.italic === b.italic;
}

function emitText(el: Element, ctx: Ctx, f: Frame): void {
  const runs: Run[] = [];
  let paint = f.paint;
  let pending = '';
  let cursorX = (length(attr(el, 'x'), paint.fontSize) ?? 0) + (length(attr(el, 'dx'), paint.fontSize) ?? 0);
  let cursorY = (length(attr(el, 'y'), paint.fontSize) ?? 0) + (length(attr(el, 'dy'), paint.fontSize) ?? 0);

  const flush = (): void => {
    const text = normalise(pending);
    pending = '';
    if (!text) return;
    runs.push({ text, x: cursorX, y: cursorY, paint });
    // Runs advance the current text position, as in SVG, so a bare string after
    // a positioned tspan does not stack on top of it.
    cursorX += ctx.measure(text, paint.fontSize, paint.fontWeight);
  };

  for (const child of Array.from(el.childNodes)) {
    if (child.nodeType === 3) {
      pending += child.nodeValue ?? '';
      continue;
    }
    if (child.nodeType !== 1) continue;
    const sub = child as Element;
    const tag = tagOf(sub);
    const subLine = nextLine(ctx, tag);
    if (tag !== 'tspan') {
      report(ctx, subLine, 'error', `<${tag}> inside <text> is not supported — only <tspan> is, so it was skipped.`);
      continue;
    }
    const subPaint = readPaint(sub, f.paint, ctx, subLine, tag);
    if (!subPaint) continue;

    const ax = length(attr(sub, 'x'), subPaint.fontSize);
    const ay = length(attr(sub, 'y'), subPaint.fontSize);
    const adx = length(attr(sub, 'dx'), subPaint.fontSize) ?? 0;
    const ady = length(attr(sub, 'dy'), subPaint.fontSize) ?? 0;

    if (ax === null && ay === null && adx === 0 && ady === 0) {
      // A tspan that only restyles has no position of its own, and inventing one
      // would be worse than losing the restyling.
      if (!samePaint(subPaint, f.paint)) {
        report(ctx, subLine, 'ignored', 'A <tspan> that only restyles part of a line was folded into that line — per-run styling inside <text> is not carried.');
      }
      pending += sub.textContent ?? '';
      continue;
    }

    flush();
    cursorX = (ax ?? cursorX) + adx;
    cursorY = (ay ?? cursorY) + ady;
    paint = subPaint;
    pending += sub.textContent ?? '';
    flush();
    paint = f.paint;
  }
  flush();

  for (const run of runs) {
    const fontSize = run.paint.fontSize * f.s;
    if (fontSize <= 0) continue;
    const measured = ctx.measure(run.text, fontSize, run.paint.fontWeight);
    // The markdown box is border-box with MARKDOWN_PADDING a side, so the usable
    // width is `width - 2 * padding`. Size to that or every label wraps.
    const width = Math.max(MIN_TEXT_WIDTH, Math.ceil(measured) + 2 * MARKDOWN_PADDING + 6);
    const height = Math.ceil(fontSize * 1.4) + 2 * MARKDOWN_PADDING;
    // Anchoring works off the measured run, not the node: the box is clamped to
    // MIN_TEXT_WIDTH and renders its text left-aligned inside, so a short label
    // centred by its box would sit off to one side.
    const shift = run.paint.anchor === 'middle' ? measured / 2 : run.paint.anchor === 'end' ? measured : 0;
    const data: TextNodeData = {
      text: run.text,
      fontSize,
      fontFamily: FONT_FAMILY,
      fontStyle: [run.paint.fontWeight >= 600 ? 'bold' : '', run.paint.italic ? 'italic' : ''].filter(Boolean).join(' ') || 'normal',
      fill: run.paint.fill,
    };
    ctx.nodes.push({
      id: generateId(),
      type: 'text',
      x: f.dx + run.x * f.s - shift - MARKDOWN_PADDING,
      y: f.dy + run.y * f.s - fontSize * BASELINE_FROM_TOP - MARKDOWN_PADDING,
      width,
      height,
      layer: LAYER_TEXT,
      groupId: ctx.groupId,
      data,
    });
  }
}

// ── Traversal ───────────────────────────────────────────────

function walkChildren(el: Element, ctx: Ctx, f: Frame): void {
  for (const child of Array.from(el.children)) walkElement(child, ctx, f);
}

function walkElement(el: Element, ctx: Ctx, parent: Frame): void {
  const tag = tagOf(el);
  const line = nextLine(ctx, tag);

  if (ctx.nodes.length >= NODE_BUDGET) {
    if (!ctx.overBudget) {
      ctx.overBudget = true;
      report(ctx, line, 'error', `The drawing needs more than ${NODE_BUDGET} canvas nodes; the rest was skipped. Simplify it or import it as an image.`);
    }
    return;
  }

  if (SILENT.has(tag)) return;
  if (tag === 'defs') {
    report(ctx, line, 'ignored', '<defs> was skipped — definitions are only drawn through <use>, gradients or markers, none of which are supported. A marker-end on a <line> still becomes an arrowhead.');
    return;
  }
  const refusal = REFUSED[tag];
  if (refusal) {
    report(ctx, line, 'error', refusal);
    return;
  }

  const framed = pushTransform(attr(el, 'transform'), parent, ctx, line, tag);
  if (!framed) return;
  const paint = readPaint(el, framed.paint, ctx, line, tag);
  if (!paint) return;
  const f: Frame = { ...framed, paint };

  switch (tag) {
    case 'g':
      walkChildren(el, ctx, f);
      return;
    case 'a':
      report(ctx, line, 'ignored', '<a> was drawn as a plain group — canvas nodes cannot carry a link target.');
      walkChildren(el, ctx, f);
      return;
    case 'rect':
      emitRect(el, ctx, f, line);
      return;
    case 'circle':
      emitCircle(el, ctx, f, line);
      return;
    case 'ellipse':
      emitEllipse(el, ctx, f, line);
      return;
    case 'line':
      emitLine(el, ctx, f, line);
      return;
    case 'polyline':
      emitPolyline(el, ctx, f, line, false);
      return;
    case 'polygon':
      emitPolyline(el, ctx, f, line, true);
      return;
    case 'text':
      emitText(el, ctx, f);
      return;
    default:
      report(ctx, line, 'error', `<${tag}> is not part of the SVG subset PowerScroll understands, so it was skipped.`);
  }
}

// ── Root ────────────────────────────────────────────────────

/** Elements we can still draw when the source is a bare fragment with no <svg>. */
const DRAWABLE_ROOTS = new Set(['g', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'text']);

function parseRoot(source: string, ctx: Ctx): Element | null {
  const parser = new DOMParser();
  let doc = parser.parseFromString(source, 'image/svg+xml');
  if (doc.getElementsByTagName('parsererror').length > 0) {
    report(
      ctx,
      0,
      'error',
      'The source is not well-formed XML. It was re-read with the lenient HTML parser, so anything after the fault may be missing or misnested.',
    );
    doc = parser.parseFromString(source, 'text/html');
  }

  const svg = doc.getElementsByTagName('svg')[0];
  if (svg) return svg;

  const root = doc.documentElement;
  const body = doc.getElementsByTagName('body')[0];
  const candidate = body?.children[0] ?? root;
  if (candidate && DRAWABLE_ROOTS.has(tagOf(candidate))) return candidate;

  report(ctx, 0, 'error', 'No <svg> element was found in the source.');
  return null;
}

interface ViewBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

function readViewBox(el: Element, ctx: Ctx): ViewBox | null {
  const raw = attr(el, 'viewBox');
  if (!raw) return null;
  const nums = raw
    .split(/[\s,]+/)
    .filter(Boolean)
    .map(Number);
  if (nums.length !== 4 || nums.some((n) => !Number.isFinite(n)) || nums[2] <= 0 || nums[3] <= 0) {
    report(ctx, 0, 'error', `viewBox="${raw}" could not be read, so the drawing was placed at 1:1 scale.`);
    return null;
  }
  return { x: nums[0], y: nums[1], w: nums[2], h: nums[3] };
}

/**
 * Never throws. A malformed document, a missing DOMParser or an unreadable
 * element becomes a diagnostic plus whatever else could be understood, because
 * the caller is a canvas that has to keep working either way.
 */
export function transpileSvg(source: string, options: TranspileSvgOptions): TranspileSvgResult {
  const ctx: Ctx = {
    nodes: [],
    diagnostics: [],
    groupId: options.groupId,
    measure: options.measureText ?? canvasMeasureText,
    tags: [],
    cursor: 0,
    overBudget: false,
  };

  try {
    if (typeof DOMParser === 'undefined') {
      report(ctx, 0, 'error', 'SVG import needs DOMParser, which this environment does not provide.');
      return { nodes: [], diagnostics: ctx.diagnostics };
    }
    if (typeof source !== 'string' || !source.trim()) {
      report(ctx, 0, 'error', 'The SVG source is empty.');
      return { nodes: [], diagnostics: ctx.diagnostics };
    }

    ctx.tags = scanTags(source);
    const root = parseRoot(source, ctx);
    if (!root) return { nodes: [], diagnostics: ctx.diagnostics };

    if (tagOf(root) !== 'svg') {
      // A bare fragment has no viewport to reconcile: place it 1:1 at the origin.
      walkElement(root, ctx, { dx: options.origin.x, dy: options.origin.y, s: 1, paint: ROOT_PAINT });
      return { nodes: ctx.nodes, diagnostics: ctx.diagnostics };
    }

    nextLine(ctx, 'svg');
    const view = readViewBox(root, ctx);
    const wAttr = length(attr(root, 'width'));
    const hAttr = length(attr(root, 'height'));

    let scale = 1;
    if (view) {
      const sx = wAttr !== null && wAttr > 0 ? wAttr / view.w : null;
      const sy = hAttr !== null && hAttr > 0 ? hAttr / view.h : null;
      if (sx !== null && sy !== null && Math.abs(sx - sy) > 1e-6) {
        report(
          ctx,
          0,
          'ignored',
          'width and height do not match the viewBox aspect ratio; the drawing was scaled uniformly to fit, which is what preserveAspectRatio does by default.',
        );
      }
      // "meet" is the preserveAspectRatio default: the drawing fits inside the
      // box, so the smaller of the two scales wins.
      scale = sx !== null && sy !== null ? Math.min(sx, sy) : (sx ?? sy ?? 1);
    }
    if (!Number.isFinite(scale) || scale <= 0) scale = 1;

    const frame: Frame = {
      dx: options.origin.x - (view?.x ?? 0) * scale,
      dy: options.origin.y - (view?.y ?? 0) * scale,
      s: scale,
      paint: ROOT_PAINT,
    };
    walkChildren(root, ctx, frame);

    if (ctx.nodes.length === 0 && ctx.diagnostics.length === 0) {
      report(ctx, 0, 'ignored', 'The SVG held nothing this transpiler could draw.');
    }
    return { nodes: ctx.nodes, diagnostics: ctx.diagnostics };
  } catch (err) {
    report(ctx, 0, 'error', `Could not read the SVG: ${err instanceof Error ? err.message : String(err)}`);
    return { nodes: ctx.nodes, diagnostics: ctx.diagnostics };
  }
}
