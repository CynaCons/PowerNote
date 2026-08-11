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
import { useCanvasStore } from '../stores/useCanvasStore';
import { useDrawStore } from '../stores/useDrawStore';
import type { ScrollRecord } from '../types/data';

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
