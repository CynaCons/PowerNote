/**
 * Scroll operations coordinated across the workspace and canvas stores.
 *
 * The workspace store owns scroll records, but the ACTIVE page's blocks live in
 * the canvas store — the workspace copy is stale until something flushes. Any
 * scroll op that moves blocks (delete, reorder) therefore has to bracket the
 * store call: push canvas → workspace first, then pull the rewritten nodes back
 * canvas ← workspace. Skipping either half loses the edit at the next flush.
 *
 * Rename and create touch no geometry, so they need neither.
 */

import { useWorkspaceStore } from '../stores/useWorkspaceStore';
import { useCanvasStore, undoBatchStartFull, undoBatchEnd } from '../stores/useCanvasStore';
import { useDrawStore } from '../stores/useDrawStore';
import type { CanvasNode, ScrollRecord, Stroke } from '../types/data';
import { columnAt, columnLeft, columnWidth } from './pageLayout';
import { FIT_SCROLL_PAD } from '../diagram/fitToScroll';

/** Push live canvas/draw state into the workspace. */
function flush(): void {
  const ws = useWorkspaceStore.getState();
  ws.savePageNodes(useCanvasStore.getState().nodes);
  ws.savePageStrokes(useDrawStore.getState().strokes);
}

function findPage(pageId: string) {
  const { workspace } = useWorkspaceStore.getState();
  for (const section of workspace.sections) {
    const page = section.pages.find((p) => p.id === pageId);
    if (page) return page;
  }
  return undefined;
}

/**
 * Pull rewritten nodes/strokes back onto the live canvas without
 * `loadPageNodes` — that would wipe the undo stack we just pushed.
 */
function applyLiveGeometry(pageId: string): void {
  const ws = useWorkspaceStore.getState();
  if (ws.activePageId !== pageId) return;
  const page = ws.getActivePage();
  useCanvasStore.setState({
    nodes: page?.nodes ?? [],
    selectedNodeIds: [],
  });
  useDrawStore.setState({
    strokes: page?.strokes ?? [],
    selectedStrokeIds: [],
  });
}

export function createScroll(pageId: string, title: string): ScrollRecord | null {
  return useWorkspaceStore.getState().createScroll(pageId, title);
}

export function renameScroll(pageId: string, scrollId: string, title: string): void {
  useWorkspaceStore.getState().renameScroll(pageId, scrollId, title);
}

export function deleteScroll(pageId: string, scrollId: string, withBlocks: boolean): void {
  flush();
  const ws = useWorkspaceStore.getState();
  const page = ws.workspace.sections
    .flatMap((s) => s.pages)
    .find((p) => p.id === pageId);
  const target = page?.scrolls?.find((s) => s.id === scrollId);
  if (!page || !target) return;
  // Match the store guard: last scroll is an append-target invariant.
  if ((page.scrolls ?? []).length <= 1) return;

  const isActive = ws.activePageId === pageId;
  if (isActive) {
    // One undo restores the band, its nodes, and its ink. Must snapshot
    // before the store write, and must not go through loadPageNodes —
    // that clears history.
    undoBatchStartFull({
      nodes: useCanvasStore.getState().nodes,
      scrolls: page.scrolls ?? [],
      strokes: useDrawStore.getState().strokes,
    });
  }

  ws.deleteScroll(pageId, scrollId, withBlocks);

  if (isActive) {
    const next = useWorkspaceStore.getState().getActivePage();
    useCanvasStore.setState({
      nodes: next?.nodes ?? [],
      selectedNodeIds: [],
    });
    useDrawStore.setState({
      strokes: next?.strokes ?? [],
      selectedStrokeIds: [],
    });
    undoBatchEnd();
  }
}

/**
 * Apply a column reorder with one undo entry on the active page.
 * Returns false when the scroll is missing or already at `toIndex`.
 */
function applyScrollReorder(pageId: string, scrollId: string, toIndex: number): boolean {
  flush();
  const ws = useWorkspaceStore.getState();
  const page = findPage(pageId);
  if (!page) return false;

  const ordered = [...(page.scrolls ?? [])].sort((a, b) => a.column - b.column);
  const from = ordered.findIndex((s) => s.id === scrollId);
  if (from < 0) return false;
  const clamped = Math.max(0, Math.min(toIndex, ordered.length - 1));
  if (clamped === from) return false;

  const isActive = ws.activePageId === pageId;
  if (isActive) {
    undoBatchStartFull({
      nodes: useCanvasStore.getState().nodes,
      scrolls: page.scrolls ?? [],
      strokes: useDrawStore.getState().strokes,
    });
  }

  ws.reorderScroll(pageId, scrollId, clamped);

  if (isActive) {
    applyLiveGeometry(pageId);
    undoBatchEnd();
  }
  return true;
}

export function reorderScroll(pageId: string, scrollId: string, toIndex: number): void {
  applyScrollReorder(pageId, scrollId, toIndex);
}

export type MoveScrollSpec = { direction: 'left' | 'right' } | { toColumn: number };

export type MoveScrollOk = {
  ok: true;
  scrollId: string;
  title: string;
  fromColumn: number;
  toColumn: number;
};

export type MoveScrollErr = {
  ok: false;
  code: 'NOT_FOUND' | 'PRECONDITION';
  message: string;
};

/**
 * Move a scroll to a neighbour band or an absolute column.
 *
 * Members, grouped ink and per-scroll width travel with the band
 * (`compactColumns`). One undo restores nodes, strokes, order and widths.
 */
export function moveScroll(
  pageId: string,
  scrollId: string,
  spec: MoveScrollSpec,
): MoveScrollOk | MoveScrollErr {
  const page = findPage(pageId);
  const ordered = [...(page?.scrolls ?? [])].sort((a, b) => a.column - b.column);
  const from = ordered.findIndex((s) => s.id === scrollId);
  if (!page || from < 0) {
    return {
      ok: false,
      code: 'NOT_FOUND',
      message: `No scroll with id "${scrollId}" in this notebook. Call list_scrolls to refresh.`,
    };
  }

  const scroll = ordered[from];
  const label = scroll.title || scrollId;
  const last = ordered.length - 1;
  let to: number;
  if ('direction' in spec) {
    to = spec.direction === 'left' ? from - 1 : from + 1;
    if (to < 0) {
      return {
        ok: false,
        code: 'PRECONDITION',
        message: `"${label}" is already at the left edge.`,
      };
    }
    if (to > last) {
      return {
        ok: false,
        code: 'PRECONDITION',
        message: `"${label}" is already at the right edge.`,
      };
    }
  } else {
    to = spec.toColumn;
    if (to === from) {
      const edge = from === 0 ? 'left' : from === last ? 'right' : 'same';
      return {
        ok: false,
        code: 'PRECONDITION',
        message:
          edge === 'same'
            ? `"${label}" is already at column ${from}.`
            : `"${label}" is already at the ${edge} edge.`,
      };
    }
    if (to < 0) {
      return {
        ok: false,
        code: 'PRECONDITION',
        message: `"${label}" cannot move past the left edge (column 0).`,
      };
    }
    if (to > last) {
      return {
        ok: false,
        code: 'PRECONDITION',
        message: `"${label}" cannot move past the right edge (column ${last}).`,
      };
    }
  }

  applyScrollReorder(pageId, scrollId, to);
  return {
    ok: true,
    scrollId,
    title: scroll.title,
    fromColumn: from,
    toColumn: to,
  };
}

function nodeBelongsToScroll(
  node: CanvasNode,
  scroll: ScrollRecord,
  scrolls: ScrollRecord[],
  nodes: CanvasNode[],
): boolean {
  if (columnAt(node.x, scrolls) === scroll.column) return true;
  if (!node.groupId) return false;
  const frame = nodes.find((n) => n.id === node.groupId);
  return !!frame && columnAt(frame.x, scrolls) === scroll.column;
}

function strokeAnchorX(stroke: Stroke): number {
  return stroke.points[0] ?? 0;
}

function strokeBelongsToScroll(
  stroke: Stroke,
  scroll: ScrollRecord,
  scrolls: ScrollRecord[],
  nodes: CanvasNode[],
): boolean {
  if (stroke.groupId) {
    const frame = nodes.find((n) => n.id === stroke.groupId);
    if (frame && columnAt(frame.x, scrolls) === scroll.column) return true;
  }
  return columnAt(strokeAnchorX(stroke), scrolls) === scroll.column;
}

function isRightOfScroll(
  columnOfOrigin: number,
  belongsHere: boolean,
  scrollColumn: number,
): boolean {
  if (belongsHere) return false;
  return columnOfOrigin > scrollColumn;
}

/**
 * Widen this scroll to its widest member + padding and shift every scroll
 * to its right (and their members) by the delta. Explicit, never automatic.
 * One undo restores the band width and the shifted members.
 *
 * Runs against the active page — the header that offers the action is only
 * drawn there, and the canvas/draw stores are the live copies.
 */
export function fitScrollToContent(pageId: string, scrollId: string): { delta: number; width: number } | null {
  flush();
  const ws = useWorkspaceStore.getState();
  if (ws.activePageId !== pageId) return null;
  const page = ws.getActivePage();
  const scrolls = page?.scrolls;
  const scroll = scrolls?.find((s) => s.id === scrollId);
  if (!page || !scrolls || !scroll) return null;

  const nodes = useCanvasStore.getState().nodes;
  const strokes = useDrawStore.getState().strokes;

  const left = columnLeft(scroll.column, scrolls);
  const currentWidth = columnWidth(scroll.column, scrolls);

  let maxRight = left;
  for (const node of nodes) {
    if (!nodeBelongsToScroll(node, scroll, scrolls, nodes)) continue;
    maxRight = Math.max(maxRight, node.x + Math.abs(node.width || 0));
  }
  for (const stroke of strokes) {
    if (!strokeBelongsToScroll(stroke, scroll, scrolls, nodes)) continue;
    for (let i = 0; i < stroke.points.length; i += 2) {
      maxRight = Math.max(maxRight, stroke.points[i]);
    }
  }

  const needed = Math.max(currentWidth, maxRight - left + FIT_SCROLL_PAD);
  const delta = needed - currentWidth;
  if (delta <= 0.5) return null;

  undoBatchStartFull({ nodes, scrolls, strokes });

  const nextNodes = nodes.map((node) => {
    if (!isRightOfScroll(columnAt(node.x, scrolls), nodeBelongsToScroll(node, scroll, scrolls, nodes), scroll.column)) {
      return node;
    }
    return { ...node, x: node.x + delta };
  });
  const nextStrokes = strokes.map((stroke) => {
    if (
      !isRightOfScroll(
        columnAt(strokeAnchorX(stroke), scrolls),
        strokeBelongsToScroll(stroke, scroll, scrolls, nodes),
        scroll.column,
      )
    ) {
      return stroke;
    }
    return {
      ...stroke,
      points: stroke.points.map((v, i) => (i % 2 === 0 ? v + delta : v)),
    };
  });
  const nextScrolls = scrolls.map((s) => (s.id === scroll.id ? { ...s, width: needed } : s));

  useCanvasStore.setState({ nodes: nextNodes });
  useDrawStore.setState({ strokes: nextStrokes });
  ws.replacePageScrolls(pageId, nextScrolls);
  undoBatchEnd();
  return { delta, width: needed };
}
