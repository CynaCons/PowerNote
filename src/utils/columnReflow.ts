/**
 * Apply column-flow height changes from the UI (text measure, diagram fit/redraw).
 * Planning stays in bridge/reflow.ts; this is the store-touching wrapper.
 */

import { useCanvasStore, undoBatchStartFull, undoBatchEnd } from '../stores/useCanvasStore';
import { useDrawStore } from '../stores/useDrawStore';
import { useWorkspaceStore } from '../stores/useWorkspaceStore';
import { resolvePageSettings } from './pageSettings';
import { pageUsesColumnFlow } from './scrolls';
import { planHeightChange, type PageLike } from '../bridge/reflow';

export function liveColumnFlow(): boolean {
  const ws = useWorkspaceStore.getState();
  const page = ws.getActivePage();
  const settings = resolvePageSettings(page, ws.workspace);
  return pageUsesColumnFlow(settings.backgroundMode, page?.scrolls);
}

export function livePageLike(): PageLike {
  const ws = useWorkspaceStore.getState();
  const page = ws.getActivePage();
  const settings = resolvePageSettings(page, ws.workspace);
  return {
    nodes: useCanvasStore.getState().nodes,
    scrolls: page?.scrolls,
    strokes: useDrawStore.getState().strokes,
    columnFlow: pageUsesColumnFlow(settings.backgroundMode, page?.scrolls),
  };
}

/**
 * If this page packs as a column, shove everything below `nodeId` by the
 * height delta. Returns false when the page is freeform or the delta is a no-op.
 */
export function reflowAfterHeightChange(nodeId: string, newHeight: number, opts?: { undo?: boolean }): boolean {
  const page = livePageLike();
  if (!page.columnFlow) return false;
  const plan = planHeightChange(page, nodeId, newHeight);
  if (!plan.ok || plan.dy === 0) {
    if (plan.ok && plan.dy === 0) {
      // Still write the new height if it changed by <2px — caller may have.
    }
    return false;
  }
  if (opts?.undo) {
    const scrolls = useWorkspaceStore.getState().getActivePage()?.scrolls ?? [];
    undoBatchStartFull({
      nodes: useCanvasStore.getState().nodes,
      scrolls,
      strokes: useDrawStore.getState().strokes,
    });
  }
  useCanvasStore.setState({ nodes: plan.nextNodes });
  useDrawStore.setState({ strokes: plan.nextStrokes });
  useWorkspaceStore.getState().markDirty();
  if (opts?.undo) undoBatchEnd();
  return true;
}
