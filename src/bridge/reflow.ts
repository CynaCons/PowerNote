/**
 * Vertical within-column displacement for insert/move/height-change.
 *
 * A scroll is a stack. Every top-level occupant of the target band moves —
 * text, frames, images, shapes, ungrouped ink. Frame members and group ink
 * ride the frame by the same dy. Guide style is visual; it does not gate
 * reflow (v0.61, field: insert/move were overlapping diagrams on default
 * pages notebooks). Human drag never reflows.
 *
 * Addressing: prefer `after` (an id). Ids survive reordering; a numeric
 * index is a snapshot of reading order and goes stale the moment anything
 * above it moves.
 */

import type { CanvasNode, ScrollRecord, Stroke } from '../types/data';
import { MIN_TEXT_HEIGHT, columnAt } from '../utils/pageLayout';
import { clampCanvasY } from '../utils/scrollCeiling';
import { scrollById } from '../utils/scrolls';
import {
  BLOCK_GAP,
  BLOCK_TOP_INSET,
  columnOf,
  columnX,
  diagramFrameIds,
  isContentBlock,
} from './blocks';

export type PageLike = {
  nodes: readonly CanvasNode[];
  scrolls?: readonly ScrollRecord[];
  strokes?: readonly Stroke[];
  /** When true, the band packs every occupant. Always set by livePageLike. */
  columnFlow?: boolean;
};

export type Displacement = { id: string; dy: number };

export type ReflowError = {
  ok: false;
  code: 'NOT_FOUND' | 'BAD_PARAMS' | 'UNSUPPORTED';
  message: string;
};

export type InsertBlockPlan = {
  ok: true;
  x: number;
  y: number;
  column: number;
  /** Opening shift applied to every content block at or below `y`. */
  dy: number;
  displaced: Displacement[];
};

export type RemoveBlockPlan = {
  ok: true;
  /** Closing shift (negative): −(height + BLOCK_GAP). */
  dy: number;
  column: number;
  displaced: Displacement[];
};

export type MoveBlockPlan = {
  ok: true;
  x: number;
  y: number;
  column: number;
  fromColumn: number;
  /** Net dy per content block other than the one being moved. */
  displaced: Displacement[];
  nextNodes: CanvasNode[];
  nextStrokes: Stroke[];
};

function blockHeightOf(node: { height?: number }): number {
  return node.height || MIN_TEXT_HEIGHT;
}

function blockBottom(node: CanvasNode): number {
  return node.y + blockHeightOf(node);
}

function openingDy(node: { height?: number }): number {
  return blockHeightOf(node) + BLOCK_GAP;
}

/** Top-level occupant: not a diagram label / mark. The frame itself is top-level. */
export function isTopLevelOccupant(node: CanvasNode, diagramIds: Set<string>): boolean {
  if (node.type === 'diagram') return true;
  if (node.groupId && diagramIds.has(node.groupId)) return false;
  return true;
}

/**
 * What insert/move may address and what a height change shoves.
 * Column-flow (the live path): every top-level occupant. The text-only
 * branch is kept for tests that pass `columnFlow: false` into the planner.
 */
export function isFlowItem(
  node: CanvasNode,
  diagramIds: Set<string>,
  columnFlow: boolean,
): boolean {
  if (columnFlow) return isTopLevelOccupant(node, diagramIds);
  return isContentBlock(node, diagramIds);
}

function contentBlocksInColumn(
  nodes: readonly CanvasNode[],
  column: number,
  scrolls: readonly ScrollRecord[] | undefined,
  columnFlow: boolean,
): CanvasNode[] {
  const diagrams = diagramFrameIds(nodes as CanvasNode[]);
  return nodes
    .filter((n) => isFlowItem(n, diagrams, columnFlow) && columnOf(n, scrolls) === column)
    .sort((a, b) => {
      // Same 20px band as orderedTextNodes / compareReadingOrder so `index`
      // matches what read_page reports for the column.
      if (Math.abs(a.y - b.y) > 20) return a.y - b.y;
      return a.x - b.x;
    });
}

function strokeMinY(stroke: Stroke): number {
  let min = Infinity;
  for (let i = 1; i < stroke.points.length; i += 2) {
    if (stroke.points[i] < min) min = stroke.points[i];
  }
  return min === Infinity ? 0 : min;
}

function accumulateDy(displaced: readonly Displacement[]): Map<string, number> {
  const byId = new Map<string, number>();
  for (const d of displaced) {
    byId.set(d.id, (byId.get(d.id) ?? 0) + d.dy);
  }
  return byId;
}

function dyFor(id: string, groupId: string | null | undefined, byId: Map<string, number>): number {
  // Frames store groupId === their own id. That must not count twice.
  const viaGroup = groupId && groupId !== id && byId.has(groupId) ? (byId.get(groupId) ?? 0) : 0;
  return (byId.get(id) ?? 0) + viaGroup;
}

function knownScrollsMessage(page: PageLike): string {
  const known = (page.scrolls ?? [])
    .map((s) => `"${s.id}"${s.title ? ` (${s.title})` : ''}`)
    .join(', ');
  return known ? `Known scrolls: ${known}.` : 'This page has no scrolls.';
}

function resolveScroll(
  page: PageLike,
  scrollId: string,
): { ok: true; scroll: ScrollRecord } | ReflowError {
  const scroll = scrollById(page.scrolls as ScrollRecord[] | undefined, scrollId);
  if (!scroll) {
    return {
      ok: false,
      code: 'NOT_FOUND',
      message:
        `No scroll with id "${scrollId}" on this page. ` +
        knownScrollsMessage(page) +
        ' Call list_scrolls to refresh.',
    };
  }
  return { ok: true, scroll };
}

/**
 * Column top for index 0: the current top of column *content* (minimum y
 * among content blocks), or BLOCK_TOP_INSET when the column is empty.
 * When a page ceiling is armed (a titled scroll), the result is clamped so
 * the new block cannot land above it.
 */
export function columnTopY(
  columnBlocks: readonly CanvasNode[],
  ceiling: number | null,
): number {
  const natural =
    columnBlocks.length > 0
      ? Math.min(...columnBlocks.map((b) => b.y))
      : BLOCK_TOP_INSET;
  return clampCanvasY(natural, ceiling);
}

export function applyDisplacements(
  nodes: readonly CanvasNode[],
  displaced: readonly Displacement[],
): CanvasNode[] {
  if (displaced.length === 0) return nodes.slice();
  const byId = accumulateDy(displaced);
  return nodes.map((n) => {
    const dy = dyFor(n.id, n.groupId, byId);
    if (dy === 0) return n;
    return { ...n, y: n.y + dy };
  });
}

/** Shift ungrouped-stroke flow items and any ink whose frame moved. */
export function applyStrokeDisplacements(
  strokes: readonly Stroke[],
  displaced: readonly Displacement[],
): Stroke[] {
  if (displaced.length === 0) return strokes.slice();
  const byId = accumulateDy(displaced);
  return strokes.map((s) => {
    const dy = dyFor(s.id, s.groupId, byId);
    if (dy === 0) return s;
    const points = s.points.map((v, i) => (i % 2 === 1 ? v + dy : v));
    return { ...s, points };
  });
}

function displaceContentBelow(
  page: PageLike,
  column: number,
  fromY: number,
  dy: number,
  opts: { exceptId?: string; exclusive?: boolean } = {},
): Displacement[] {
  if (dy === 0) return [];
  const columnFlow = !!page.columnFlow;
  const diagrams = diagramFrameIds(page.nodes as CanvasNode[]);
  const out: Displacement[] = [];
  for (const n of page.nodes) {
    if (opts.exceptId && n.id === opts.exceptId) continue;
    if (!isFlowItem(n, diagrams, columnFlow)) continue;
    if (columnOf(n, page.scrolls) !== column) continue;
    if (opts.exclusive ? n.y <= fromY : n.y < fromY) continue;
    out.push({ id: n.id, dy });
  }
  if (columnFlow) {
    for (const s of page.strokes ?? []) {
      if (s.groupId && diagrams.has(s.groupId)) continue;
      if (columnAt(s.points[0] ?? 0, page.scrolls) !== column) continue;
      const y = strokeMinY(s);
      if (opts.exclusive ? y <= fromY : y < fromY) continue;
      out.push({ id: s.id, dy });
    }
  }
  return out;
}

function mismatchMessage(
  afterId: string,
  scrollId: string,
  node: CanvasNode,
  page: PageLike,
): string {
  const column = columnOf(node, page.scrolls);
  const owner = page.scrolls?.find((s) => s.column === column);
  const where = owner
    ? `scroll "${owner.id}"${owner.title ? ` (${owner.title})` : ''}`
    : `column ${column}`;
  return (
    `"after" block "${afterId}" is not in scroll "${scrollId}" ` +
    `(it sits in ${where}). Pass a block from that scroll, or use index.`
  );
}

/**
 * Target y for an insert, plus the opening shift of content blocks below it.
 *
 * `afterBlockIdOrIndex` is a block id (preferred) or a 0-based index into
 * the column's content-block reading order. Index 0 is the column top.
 * Index === length appends after the last content block (no displacement).
 */
export function insertBlockAt(
  page: PageLike,
  scrollId: string,
  afterBlockIdOrIndex: string | number,
  node: { height: number },
  ceiling: number | null = null,
): InsertBlockPlan | ReflowError {
  const resolved = resolveScroll(page, scrollId);
  if (!resolved.ok) return resolved;
  const { scroll } = resolved;
  const column = scroll.column;
  const columnFlow = !!page.columnFlow;
  const columnBlocks = contentBlocksInColumn(page.nodes, column, page.scrolls, columnFlow);
  const dy = openingDy(node);

  let y: number;
  if (typeof afterBlockIdOrIndex === 'number') {
    const index = afterBlockIdOrIndex;
    if (!Number.isInteger(index) || index < 0) {
      return {
        ok: false,
        code: 'BAD_PARAMS',
        message: '"index" must be a non-negative integer',
      };
    }
    if (index > columnBlocks.length) {
      return {
        ok: false,
        code: 'BAD_PARAMS',
        message:
          `"index" ${index} is past the end of scroll "${scrollId}" ` +
          `(${columnBlocks.length} block${columnBlocks.length === 1 ? '' : 's'}). ` +
          `Pass 0..${columnBlocks.length}.`,
      };
    }
    if (index === 0) {
      y = columnTopY(columnBlocks, ceiling);
    } else {
      y = blockBottom(columnBlocks[index - 1]) + BLOCK_GAP;
    }
  } else {
    const afterId = afterBlockIdOrIndex;
    const anchor = page.nodes.find((n) => n.id === afterId);
    if (!anchor) {
      return {
        ok: false,
        code: 'NOT_FOUND',
        message: `No block with id "${afterId}"`,
      };
    }
    const diagrams = diagramFrameIds(page.nodes as CanvasNode[]);
    if (!isFlowItem(anchor, diagrams, columnFlow) || columnOf(anchor, page.scrolls) !== column) {
      return {
        ok: false,
        code: 'BAD_PARAMS',
        message: mismatchMessage(afterId, scrollId, anchor, page),
      };
    }
    y = blockBottom(anchor) + BLOCK_GAP;
  }

  const displaced = displaceContentBelow(page, column, y, dy);
  return {
    ok: true,
    x: columnX(column, page.scrolls),
    y,
    column,
    dy,
    displaced,
  };
}

/**
 * Closing shift: every content block below `blockId` in its column moves up
 * by the removed block's height + BLOCK_GAP. The block itself is not
 * included in `displaced` and is not removed from the page data — the store
 * mutation decides whether to delete or relocate it.
 */
export function removeBlockGap(
  page: PageLike,
  blockId: string,
): RemoveBlockPlan | ReflowError {
  const node = page.nodes.find((n) => n.id === blockId);
  if (!node) {
    return { ok: false, code: 'NOT_FOUND', message: `No block with id "${blockId}"` };
  }
  const diagrams = diagramFrameIds(page.nodes as CanvasNode[]);
  if (!isFlowItem(node, diagrams, !!page.columnFlow)) {
    return {
      ok: false,
      code: 'UNSUPPORTED',
      message: `"${blockId}" is not a free-standing content block`,
    };
  }
  const column = columnOf(node, page.scrolls);
  const dy = -openingDy(node);
  const displaced = displaceContentBelow(page, column, node.y, dy, {
    exceptId: blockId,
    exclusive: true,
  });
  return { ok: true, dy, column, displaced };
}

function parseMoveAnchor(
  dest: { after?: string; index?: number },
): { ok: true; anchor: string | number } | ReflowError {
  const hasAfter = dest.after !== undefined && dest.after !== null && dest.after !== '';
  const hasIndex = dest.index !== undefined && dest.index !== null;
  if (hasAfter && hasIndex) {
    return {
      ok: false,
      code: 'BAD_PARAMS',
      message:
        'Pass after (a block id) or index, not both. Prefer after: ids survive reordering, indices do not.',
    };
  }
  if (!hasAfter && !hasIndex) {
    return {
      ok: false,
      code: 'BAD_PARAMS',
      message: 'move_block needs exactly one of after (block id, preferred) or index.',
    };
  }
  if (hasAfter) return { ok: true, anchor: dest.after as string };
  if (typeof dest.index !== 'number' || !Number.isInteger(dest.index) || dest.index < 0) {
    return {
      ok: false,
      code: 'BAD_PARAMS',
      message: '"index" must be a non-negative integer',
    };
  }
  return { ok: true, anchor: dest.index };
}

/**
 * Close the source gap, open the target gap, place the block. Same-scroll
 * and cross-scroll. The moving block is excluded from both shifts and then
 * written at the computed (x, y).
 */
export function planMoveBlock(
  page: PageLike,
  blockId: string,
  dest: { scrollId?: string; after?: string; index?: number },
  ceiling: number | null = null,
): MoveBlockPlan | ReflowError {
  const node = page.nodes.find((n) => n.id === blockId);
  if (!node) {
    return { ok: false, code: 'NOT_FOUND', message: `No block with id "${blockId}"` };
  }
  const diagrams = diagramFrameIds(page.nodes as CanvasNode[]);
  if (!isFlowItem(node, diagrams, !!page.columnFlow)) {
    return {
      ok: false,
      code: 'UNSUPPORTED',
      message: `"${blockId}" is not a free-standing content block`,
    };
  }

  const fromColumn = columnOf(node, page.scrolls);
  const sourceScroll = page.scrolls?.find((s) => s.column === fromColumn);
  const targetScrollId = dest.scrollId ?? sourceScroll?.id;
  if (!targetScrollId) {
    return {
      ok: false,
      code: 'NOT_FOUND',
      message:
        'move_block needs a target scroll. This column has no scroll record — pass scrollId from list_scrolls.',
    };
  }

  if (dest.after === blockId) {
    return {
      ok: false,
      code: 'BAD_PARAMS',
      message: 'A block cannot be moved after itself. Pass a different after id, or use index.',
    };
  }

  const anchor = parseMoveAnchor(dest);
  if (!anchor.ok) return anchor;

  const closed = removeBlockGap(page, blockId);
  if (!closed.ok) return closed;

  const afterClose = applyDisplacements(page.nodes, closed.displaced);
  const strokesAfterClose = applyStrokeDisplacements(page.strokes ?? [], closed.displaced);
  // Drop the moving node AND its frame members. If the frame leaves the
  // list, members look like free-standing marks and get the opening
  // displacement — then the ride below applies frameDy again.
  const without = afterClose.filter((n) => {
    if (n.id === blockId) return false;
    if (node.type === 'diagram' && n.groupId === blockId) return false;
    return true;
  });
  const strokesWithout = strokesAfterClose.filter((s) => {
    if (node.type === 'diagram' && s.groupId === blockId) return false;
    return true;
  });
  const insert = insertBlockAt(
    {
      nodes: without,
      scrolls: page.scrolls,
      strokes: strokesWithout,
      columnFlow: page.columnFlow,
    },
    targetScrollId,
    anchor.anchor,
    node,
    ceiling,
  );
  if (!insert.ok) return insert;

  const afterOpen = applyDisplacements(afterClose, insert.displaced);
  const strokesAfterOpen = applyStrokeDisplacements(strokesAfterClose, insert.displaced);
  const dx = insert.x - node.x;
  const frameDy = insert.y - node.y;
  const nextNodes = afterOpen.map((n) => {
    if (n.id === blockId) return { ...n, x: insert.x, y: insert.y };
    if (node.type === 'diagram' && n.groupId === blockId) {
      return { ...n, x: n.x + dx, y: n.y + frameDy };
    }
    return n;
  });
  const nextStrokes = strokesAfterOpen.map((s) => {
    if (node.type === 'diagram' && s.groupId === blockId) {
      const points = s.points.map((v, i) => v + (i % 2 === 0 ? dx : frameDy));
      return { ...s, points };
    }
    return s;
  });

  const net = new Map<string, number>();
  for (const d of closed.displaced) net.set(d.id, (net.get(d.id) ?? 0) + d.dy);
  for (const d of insert.displaced) net.set(d.id, (net.get(d.id) ?? 0) + d.dy);
  const displaced: Displacement[] = [];
  for (const [id, dy] of net) {
    if (id === blockId || dy === 0) continue;
    displaced.push({ id, dy });
  }

  return {
    ok: true,
    x: insert.x,
    y: insert.y,
    column: insert.column,
    fromColumn,
    displaced,
    nextNodes,
    nextStrokes,
  };
}

export type HeightChangePlan = {
  ok: true;
  dy: number;
  displaced: Displacement[];
  nextNodes: CanvasNode[];
  nextStrokes: Stroke[];
};

/** Open or close the gap below a flow item whose height just changed. */
export function planHeightChange(
  page: PageLike,
  nodeId: string,
  newHeight: number,
): HeightChangePlan | ReflowError {
  const node = page.nodes.find((n) => n.id === nodeId);
  if (!node) {
    return { ok: false, code: 'NOT_FOUND', message: `No block with id "${nodeId}"` };
  }
  const dy = newHeight - blockHeightOf(node);
  if (Math.abs(dy) < 2) {
    return {
      ok: true,
      dy: 0,
      displaced: [],
      nextNodes: page.nodes.slice() as CanvasNode[],
      nextStrokes: (page.strokes ?? []).slice() as Stroke[],
    };
  }
  const column = columnOf(node, page.scrolls);
  const displaced = displaceContentBelow(page, column, node.y, dy, {
    exceptId: nodeId,
    exclusive: true,
  });
  const nextNodes = applyDisplacements(page.nodes, displaced).map((n) =>
    n.id === nodeId ? { ...n, height: newHeight } : n,
  );
  return {
    ok: true,
    dy,
    displaced,
    nextNodes,
    nextStrokes: applyStrokeDisplacements(page.strokes ?? [], displaced),
  };
}
