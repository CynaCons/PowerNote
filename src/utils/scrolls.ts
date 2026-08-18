/**
 * Scroll records — identity for the column bands on a page (v0.31+).
 *
 * A scroll is a band, not a container: `ScrollRecord` stores an id, a title and
 * a column index, and membership is derived from geometry via `columnAt`.
 * Column operations (delete / reorder / move) use the group-aware helpers
 * below so a diagram is never torn across a band edge. Everything here is
 * pure so both the UI and the agent bridge resolve membership the same way.
 */

import type { CanvasNode, Page, ScrollRecord, Stroke } from '../types/data';
import { columnAt, columnLeft } from './pageLayout';
import { generateId } from './ids';

/**
 * Delete-time band membership (v0.53).
 *
 * A diagram belongs to the band containing its FRAME's origin. Every member
 * and every stroke carrying that groupId follows that verdict, regardless of
 * its own x — otherwise deleting a band that holds the frame leaves the
 * overhang as corpses, and deleting the neighbour band the overhang sits in
 * rips the drawing in half. Ungrouped nodes use their own x. Ungrouped
 * strokes use their first point.
 *
 * Distinct from fit-scroll's "own x OR frame x" rule: fit needs to measure
 * overhang; delete needs an all-or-nothing owner.
 */
export function countBandContent(
  scroll: ScrollRecord,
  scrolls: ScrollRecord[],
  nodes: CanvasNode[],
  strokes: Stroke[],
): { nodes: number; strokes: number } {
  return {
    nodes: nodes.filter((n) => contentBelongsToScroll(n, scroll, scrolls, nodes)).length,
    strokes: strokes.filter((s) => strokeBelongsToScrollBand(s, scroll, scrolls, nodes)).length,
  };
}

export function contentBelongsToScroll(
  node: CanvasNode,
  scroll: ScrollRecord,
  scrolls: ScrollRecord[],
  nodes: CanvasNode[],
): boolean {
  return columnAt(contentAnchorX(node, nodes), scrolls) === scroll.column;
}

/** First-point x for an ungrouped stroke; the frame origin for a grouped one. */
export function strokeBelongsToScrollBand(
  stroke: Stroke,
  scroll: ScrollRecord,
  scrolls: ScrollRecord[],
  nodes: CanvasNode[],
): boolean {
  return columnAt(strokeAnchorX(stroke, nodes), scrolls) === scroll.column;
}

function contentAnchorX(node: CanvasNode, nodes: CanvasNode[]): number {
  if (node.type === 'diagram') return node.x;
  if (node.groupId) {
    const frame = nodes.find((n) => n.id === node.groupId);
    if (frame) return frame.x;
  }
  return node.x;
}

function strokeAnchorX(stroke: Stroke, nodes: CanvasNode[]): number {
  if (stroke.groupId) {
    const frame = nodes.find((n) => n.id === stroke.groupId);
    if (frame) return frame.x;
  }
  return stroke.points[0] ?? 0;
}

/** Column bands that currently hold at least one node, ascending. */
export function columnsInUse(nodes: CanvasNode[], scrolls?: ScrollRecord[]): number[] {
  const columns = new Set<number>();
  for (const node of nodes) {
    columns.add(columnAt(node.x, scrolls));
  }
  return [...columns].sort((a, b) => a - b);
}

/**
 * A page packs as columns when it is in scroll guide style, or when any
 * scroll has a title. The default untitled scroll on a pages/grid/none
 * sheet is not a column — notes can sit beside each other there.
 */
export function pageUsesColumnFlow(
  backgroundMode: string | undefined,
  scrolls?: readonly ScrollRecord[],
): boolean {
  if (backgroundMode === 'scroll') return true;
  return (scrolls ?? []).some((s) => (s.title ?? '').trim() !== '');
}

/** The scroll a node sits in, or undefined if no record covers its band. */
export function scrollOf(
  node: CanvasNode,
  scrolls: ScrollRecord[] | undefined,
): ScrollRecord | undefined {
  if (!scrolls) return undefined;
  const column = columnAt(node.x, scrolls);
  return scrolls.find((s) => s.column === column);
}

/** Nodes belonging to a scroll, by band containment. */
export function nodesInScroll(nodes: CanvasNode[], scroll: ScrollRecord, scrolls?: ScrollRecord[]): CanvasNode[] {
  return nodes.filter((n) => columnAt(n.x, scrolls ?? [scroll]) === scroll.column);
}

export function scrollById(
  scrolls: ScrollRecord[] | undefined,
  scrollId: string,
): ScrollRecord | undefined {
  return scrolls?.find((s) => s.id === scrollId);
}

/** Lowest band index not already claimed by a record. */
export function nextFreeColumn(scrolls: ScrollRecord[]): number {
  const taken = new Set(scrolls.map((s) => s.column));
  let column = 0;
  while (taken.has(column)) column++;
  return column;
}

/**
 * Give a page scroll records if it has none.
 *
 * Runs once per page on load, so a notebook written before v0.31 gains stable
 * scroll ids that persist from that save onward. Backfilled scrolls are
 * deliberately UNTITLED: an existing notebook should look exactly as it did,
 * and an empty title draws no header. Naming one is an explicit act, by the
 * user or by an agent.
 */
export function ensurePageScrolls(page: Page): Page {
  if (page.scrolls && page.scrolls.length > 0) return page;

  const columns = columnsInUse(page.nodes);
  // Every page has at least the leftmost scroll, even when empty — otherwise a
  // blank page would have nothing for an agent to append to.
  if (!columns.includes(0)) columns.unshift(0);

  return {
    ...page,
    scrolls: columns.map((column) => ({ id: generateId(), title: '', column })),
  };
}

/**
 * Band a node belongs to for column operations (delete / reorder / move).
 *
 * A diagram or grouped member is owned by the FRAME's origin — never by the
 * member's own x — so a straddling drawing cannot be torn in half. Ungrouped
 * nodes use their own x.
 */
export function contentColumn(
  node: CanvasNode,
  nodes: CanvasNode[],
  scrolls?: ScrollRecord[],
): number {
  return columnAt(contentAnchorX(node, nodes), scrolls);
}

/**
 * Band a stroke belongs to for column operations.
 *
 * Grouped ink follows the frame origin; ungrouped ink follows its first point.
 */
export function strokeContentColumn(
  stroke: Stroke,
  nodes: CanvasNode[],
  scrolls?: ScrollRecord[],
): number {
  return columnAt(strokeAnchorX(stroke, nodes), scrolls);
}

/**
 * Apply a per-band horizontal delta to every node and stroke that belongs
 * to that band. Membership is the group-aware test above: groups never split,
 * ungrouped strokes travel with the band their first point falls in.
 *
 * `deltaForColumn` returns undefined (or 0) for bands that stay put — content
 * outside every record (dragged off to the side) is left alone.
 */
export function shiftBandContents(
  nodes: CanvasNode[],
  strokes: Stroke[],
  deltaForColumn: (column: number) => number | undefined,
  scrolls?: ScrollRecord[],
): { nodes: CanvasNode[]; strokes: Stroke[] } {
  const nextNodes = nodes.map((node) => {
    const delta = deltaForColumn(contentColumn(node, nodes, scrolls));
    if (delta === undefined || delta === 0) return node;
    return { ...node, x: node.x + delta };
  });
  const nextStrokes = strokes.map((stroke) => {
    const delta = deltaForColumn(strokeContentColumn(stroke, nodes, scrolls));
    if (delta === undefined || delta === 0) return stroke;
    return {
      ...stroke,
      points: stroke.points.map((v, i) => (i % 2 === 0 ? v + delta : v)),
    };
  });
  return { nodes: nextNodes, strokes: nextStrokes };
}

/**
 * Shift every member of `column` horizontally to `toColumn`.
 *
 * Same membership as compactColumns — groups travel whole, ungrouped strokes
 * follow their first point. Callers apply the result atomically with the
 * record change so the two never disagree, even for one render.
 */
export function shiftNodesBetweenColumns(
  nodes: CanvasNode[],
  column: number,
  toColumn: number,
  scrolls?: ScrollRecord[],
  strokes: Stroke[] = [],
): { nodes: CanvasNode[]; strokes: Stroke[] } {
  if (column === toColumn) return { nodes, strokes };
  const delta = columnLeft(toColumn, scrolls) - columnLeft(column, scrolls);
  return shiftBandContents(nodes, strokes, (from) => (from === column ? delta : undefined), scrolls);
}

/**
 * Renumber records to occupy bands 0..n-1, returning the records and the
 * node/stroke moves needed to match.
 *
 * ARRAY ORDER IS THE INSTRUCTION: `ordered[i]` becomes column `i`. Callers that
 * mean "close the gaps, keep left-to-right order" must sort by column first;
 * callers reordering scrolls pass their new order directly. Sorting internally
 * would silently undo a reorder.
 *
 * Per-scroll `width` travels with the record (only `column` is rewritten);
 * cumulative left edges are then read off the new order, so a widened band
 * carries its extra width to its new slot.
 */
export function compactColumns(
  ordered: ScrollRecord[],
  nodes: CanvasNode[],
  strokes: Stroke[] = [],
): { scrolls: ScrollRecord[]; nodes: CanvasNode[]; strokes: Stroke[] } {
  // Target band per ORIGINAL band, so every lookup below is against the layout
  // as it stands now. Rewriting x as we go would make later nodes resolve
  // against already-moved neighbours and shift twice.
  const targetOf = new Map(ordered.map((s, index) => [s.column, index]));
  const next = ordered.map((s, index) => (s.column === index ? s : { ...s, column: index }));

  const shifted = shiftBandContents(
    nodes,
    strokes,
    (from) => {
      const to = targetOf.get(from);
      // Content outside every remaining record's band stays put — moving it
      // would be a surprise edit the user never asked for (delete-keep of
      // the band that owned it is the usual case).
      if (to === undefined || to === from) return undefined;
      return columnLeft(to, next) - columnLeft(from, ordered);
    },
    ordered,
  );

  return {
    scrolls: next,
    nodes: shifted.nodes,
    strokes: shifted.strokes,
  };
}
