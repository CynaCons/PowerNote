/**
 * Scroll records — identity for the column bands on a page (v0.31+).
 *
 * A scroll is a band, not a container: `ScrollRecord` stores an id, a title and
 * a column index, and membership is derived from block geometry via
 * `columnAt`. Everything here is pure so both the UI and the agent bridge can
 * resolve "which scroll is this?" the same way.
 */

import type { CanvasNode, Page, ScrollRecord } from '../types/data';
import { columnAt, columnLeft } from './pageLayout';
import { generateId } from './ids';

/** Column bands that currently hold at least one node, ascending. */
export function columnsInUse(nodes: CanvasNode[], scrolls?: ScrollRecord[]): number[] {
  const columns = new Set<number>();
  for (const node of nodes) {
    columns.add(columnAt(node.x, scrolls));
  }
  return [...columns].sort((a, b) => a - b);
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
 * Shift every node in `column` horizontally to `toColumn`.
 *
 * Band membership is positional, so moving a scroll means moving its blocks in
 * the same breath. Returns a new node array; callers apply it atomically with
 * the record change so the two never disagree, even for one render.
 */
export function shiftNodesBetweenColumns(
  nodes: CanvasNode[],
  column: number,
  toColumn: number,
  scrolls?: ScrollRecord[],
): CanvasNode[] {
  if (column === toColumn) return nodes;
  const delta = columnLeft(toColumn, scrolls) - columnLeft(column, scrolls);
  return nodes.map((n) => (columnAt(n.x, scrolls) === column ? { ...n, x: n.x + delta } : n));
}

/**
 * Renumber records to occupy bands 0..n-1, returning the records and the node
 * moves needed to match.
 *
 * ARRAY ORDER IS THE INSTRUCTION: `ordered[i]` becomes column `i`. Callers that
 * mean "close the gaps, keep left-to-right order" must sort by column first;
 * callers reordering scrolls pass their new order directly. Sorting internally
 * would silently undo a reorder.
 */
export function compactColumns(
  ordered: ScrollRecord[],
  nodes: CanvasNode[],
): { scrolls: ScrollRecord[]; nodes: CanvasNode[] } {
  // Target band per ORIGINAL band, so every lookup below is against the layout
  // as it stands now. Rewriting x as we go would make later nodes resolve
  // against already-moved neighbours and shift twice.
  const targetOf = new Map(ordered.map((s, index) => [s.column, index]));
  const next = ordered.map((s, index) => (s.column === index ? s : { ...s, column: index }));

  const movedNodes = nodes.map((node) => {
    const from = columnAt(node.x, ordered);
    const to = targetOf.get(from);
    // Nodes outside every record's band (dragged off to the side) stay put —
    // moving them would be a surprise edit the user never asked for.
    if (to === undefined || to === from) return node;
    return { ...node, x: node.x + (columnLeft(to, next) - columnLeft(from, ordered)) };
  });

  return {
    scrolls: next,
    nodes: movedNodes,
  };
}
