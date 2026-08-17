/**
 * Placement-time fit of a materialized diagram into the scroll band its
 * frame origin sits in.
 *
 * Not a layout-engine concern and not a stored property: the caller scales
 * the nodes it is about to commit. A later manual resize or move is left
 * alone. The band test is `columnAt` — the same one membership and the
 * page guides use — so a diagram cannot be fitted against a different
 * column than the one it will belong to.
 */

import type { CanvasNode, ScrollRecord, TextNodeData } from '../types/data';
import { columnAt, columnWidth } from '../utils/pageLayout';

/** Inset kept between the fitted frame and the band's right edge. */
export const FIT_SCROLL_PAD = 16;
/** Smallest scale applied. Below this we place at the floor and warn. */
export const FIT_SCROLL_FLOOR = 0.45;

export interface FitToScrollResult {
  members: CanvasNode[];
  frame: { width: number; height: number };
  scale: number;
  warning?: string;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

function formatScale(scale: number): string {
  return String(Math.round(scale * 100) / 100);
}

function scaleNode(node: CanvasNode, originX: number, originY: number, scale: number): CanvasNode {
  const data = { ...node.data };
  if (node.type === 'text') {
    const text = data as TextNodeData;
    if (typeof text.fontSize === 'number') text.fontSize = text.fontSize * scale;
  }
  return {
    ...node,
    x: originX + (node.x - originX) * scale,
    y: originY + (node.y - originY) * scale,
    width: node.width * scale,
    height: node.height * scale,
    data,
  };
}

/**
 * Scale `members` and the frame size about the frame origin so the diagram
 * fits in the band under `frame.x`. Stroke weight is left alone (legibility,
 * not geometry). Returns the input unchanged when the origin is outside
 * every scroll record.
 */
export function fitDiagramToScroll(
  frame: { x: number; y: number; width: number; height: number },
  members: CanvasNode[],
  scrolls: ScrollRecord[] | undefined,
): FitToScrollResult {
  const identity: FitToScrollResult = {
    members,
    frame: { width: frame.width, height: frame.height },
    scale: 1,
  };
  if (!scrolls || scrolls.length === 0 || members.length === 0) return identity;

  const column = columnAt(frame.x, scrolls);
  const band = scrolls.find((s) => s.column === column);
  if (!band) return identity;

  const available = columnWidth(band.column, scrolls) - FIT_SCROLL_PAD;
  const name = band.title || 'untitled';
  // A band narrower than the padding has no positive target width. Place
  // unscaled (we cannot invent a fit) but name the scroll — silent identity
  // looked like the diagram was happy in a 10px column.
  if (!(available > 0)) {
    return {
      ...identity,
      warning: `scroll '${name}' is too narrow to fit a diagram`,
    };
  }
  if (frame.width <= available) return identity;

  const requested = available / frame.width;
  const scale = clamp(requested, FIT_SCROLL_FLOOR, 1);
  if (scale >= 1) return identity;

  const warning =
    requested < FIT_SCROLL_FLOOR
      ? `scaled to ${formatScale(scale)}× to fit scroll '${name}' (requested width ${Math.round(frame.width)}px)`
      : `scaled to ${formatScale(scale)}× to fit scroll '${name}'`;

  return {
    members: members.map((m) => scaleNode(m, frame.x, frame.y, scale)),
    frame: { width: frame.width * scale, height: frame.height * scale },
    scale,
    warning,
  };
}
