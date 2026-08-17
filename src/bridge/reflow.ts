/**
 * Vertical within-column displacement for agent block insert/move (v0.55).
 *
 * This is not a document-flow engine and it is not the descoped frame reflow
 * (PLAN v0.34.0 / SRS_DIAGRAM "Not built", 2026-08-13). Only free-standing
 * content blocks in the target column move. Diagram frames, their members,
 * shapes, images and strokes keep their y — an inserted block that lands on
 * a diagram overlaps it, the same as an append that happened to collide.
 *
 * Addressing: prefer `after` (a block id). Ids survive reordering; a numeric
 * index is a snapshot of reading order and goes stale the moment anything
 * above it moves. That is the same reason `resolveColumn` prefers scrollId
 * over a raw column integer.
 */

import type { CanvasNode, ScrollRecord } from '../types/data';
import { MIN_TEXT_HEIGHT } from '../utils/pageLayout';
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

function contentBlocksInColumn(
  nodes: readonly CanvasNode[],
  column: number,
  scrolls?: readonly ScrollRecord[],
): CanvasNode[] {
  const diagrams = diagramFrameIds(nodes as CanvasNode[]);
  return nodes
    .filter((n) => isContentBlock(n, diagrams) && columnOf(n, scrolls) === column)
    .sort((a, b) => {
      // Same 20px band as orderedTextNodes / compareReadingOrder so `index`
      // matches what read_page reports for the column.
      if (Math.abs(a.y - b.y) > 20) return a.y - b.y;
      return a.x - b.x;
    });
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
  const byId = new Map<string, number>();
  for (const d of displaced) {
    byId.set(d.id, (byId.get(d.id) ?? 0) + d.dy);
  }
  return nodes.map((n) => {
    const dy = byId.get(n.id);
    if (dy === undefined || dy === 0) return n;
    return { ...n, y: n.y + dy };
  });
}

function displaceContentBelow(
  nodes: readonly CanvasNode[],
  column: number,
  scrolls: readonly ScrollRecord[] | undefined,
  fromY: number,
  dy: number,
  opts: { exceptId?: string; exclusive?: boolean } = {},
): Displacement[] {
  if (dy === 0) return [];
  const diagrams = diagramFrameIds(nodes as CanvasNode[]);
  const out: Displacement[] = [];
  for (const n of nodes) {
    if (opts.exceptId && n.id === opts.exceptId) continue;
    if (!isContentBlock(n, diagrams)) continue;
    if (columnOf(n, scrolls) !== column) continue;
    if (opts.exclusive ? n.y <= fromY : n.y < fromY) continue;
    out.push({ id: n.id, dy });
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
  const columnBlocks = contentBlocksInColumn(page.nodes, column, page.scrolls);
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
    if (!isContentBlock(anchor, diagrams) || columnOf(anchor, page.scrolls) !== column) {
      return {
        ok: false,
        code: 'BAD_PARAMS',
        message: mismatchMessage(afterId, scrollId, anchor, page),
      };
    }
    y = blockBottom(anchor) + BLOCK_GAP;
  }

  const displaced = displaceContentBelow(page.nodes, column, page.scrolls, y, dy);
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
  if (!isContentBlock(node, diagrams)) {
    return {
      ok: false,
      code: 'UNSUPPORTED',
      message: `"${blockId}" is not a free-standing content block`,
    };
  }
  const column = columnOf(node, page.scrolls);
  const dy = -openingDy(node);
  const displaced = displaceContentBelow(page.nodes, column, page.scrolls, node.y, dy, {
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
  if (!isContentBlock(node, diagrams)) {
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
  const without = afterClose.filter((n) => n.id !== blockId);
  const insert = insertBlockAt(
    { nodes: without, scrolls: page.scrolls },
    targetScrollId,
    anchor.anchor,
    node,
    ceiling,
  );
  if (!insert.ok) return insert;

  const afterOpen = applyDisplacements(afterClose, insert.displaced);
  const nextNodes = afterOpen.map((n) =>
    n.id === blockId ? { ...n, x: insert.x, y: insert.y } : n,
  );

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
  };
}
