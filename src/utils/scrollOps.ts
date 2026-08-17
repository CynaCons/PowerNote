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

/** Reload the canvas from the workspace, if `pageId` is the page on screen. */
function reloadIfActive(pageId: string): void {
  const ws = useWorkspaceStore.getState();
  if (ws.activePageId !== pageId) return;

  const section = ws.workspace.sections.find((s) => s.id === ws.activeSectionId);
  const page = section?.pages.find((p) => p.id === pageId);
  if (!page) return;
  useCanvasStore.getState().loadPageNodes(page.nodes);
}

export function createScroll(pageId: string, title: string): ScrollRecord | null {
  return useWorkspaceStore.getState().createScroll(pageId, title);
}

export function renameScroll(pageId: string, scrollId: string, title: string): void {
  useWorkspaceStore.getState().renameScroll(pageId, scrollId, title);
}

export function deleteScroll(pageId: string, scrollId: string, withBlocks: boolean): void {
  flush();
  useWorkspaceStore.getState().deleteScroll(pageId, scrollId, withBlocks);
  reloadIfActive(pageId);
}

export function reorderScroll(pageId: string, scrollId: string, toIndex: number): void {
  flush();
  useWorkspaceStore.getState().reorderScroll(pageId, scrollId, toIndex);
  reloadIfActive(pageId);
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
