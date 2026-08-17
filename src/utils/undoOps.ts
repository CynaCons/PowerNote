/**
 * Undo/redo routed to whichever history the active tool is writing to.
 *
 * There are two independent stacks — nodes in the canvas store, strokes in the
 * draw store — and which one an action landed in depends on the tool that was
 * active. Ctrl+Z has always picked between them; this exists so the toolbar
 * button picks the same way, from one definition rather than a second copy of
 * the rule that can quietly drift out of step with the first.
 */

import { useCanvasStore } from '../stores/useCanvasStore';
import { useDrawStore } from '../stores/useDrawStore';
import { useToolStore } from '../stores/useToolStore';

/** True while the tools that write strokes rather than nodes are active. */
function drawingActive(): boolean {
  const tool = useToolStore.getState().activeTool;
  return tool === 'draw' || tool === 'lasso';
}

export function undoActive(): void {
  if (drawingActive()) useDrawStore.getState().undo();
  else useCanvasStore.getState().undo();
}

export function redoActive(): void {
  if (drawingActive()) useDrawStore.getState().redo();
  else useCanvasStore.getState().redo();
}

export function canUndoActive(): boolean {
  return drawingActive()
    ? useDrawStore.getState().canUndo()
    : useCanvasStore.getState().canUndo();
}

export function canRedoActive(): boolean {
  return drawingActive()
    ? useDrawStore.getState().canRedo()
    : useCanvasStore.getState().canRedo();
}
