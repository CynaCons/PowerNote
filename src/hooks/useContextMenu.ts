import { useState, useCallback, useRef } from 'react';
import type Konva from 'konva';
import { useCanvasStore } from '../stores/useCanvasStore';
import { useToolStore } from '../stores/useToolStore';

export interface ContextMenuState {
  x: number;
  y: number;
  nodeId: string;
}

/**
 * ~500ms of stillness is the common OS long-press timing (Android/iOS both
 * land near here) — long enough that a fast tap never trips it.
 */
const LONG_PRESS_MS = 500;
/** Movement past this many px reads as a drag/pan starting, not a hold. */
const LONG_PRESS_MOVE_CANCEL_PX = 10;

/**
 * Walk up from a Konva event target to the nearest ancestor carrying a
 * canvas node id — every node type renders an invisible Rect with `id` set
 * to the node id as its hit area. Shared by the right-click and long-press
 * paths so they agree on what "the node under the pointer" means.
 */
function findNodeIdFromTarget(
  target: Konva.Node,
  stageRef: React.RefObject<Konva.Stage | null>,
): string | null {
  let current: Konva.Node | null = target;
  while (current && current !== stageRef.current) {
    const rect = (current as any).findOne?.('Rect');
    const nodeId = rect?.id?.();
    if (nodeId) {
      const storeNode = useCanvasStore.getState().nodes.find((n) => n.id === nodeId);
      if (storeNode) return nodeId;
    }
    current = current.parent;
  }
  return null;
}

/**
 * Hook for the right-click context menu AND the touch long-press that opens
 * the same menu (REQ-CANVAS-028): a ~500ms still press on a node selects it
 * and opens the menu at the press point. Touch has no hover and no
 * right-click, so without this a touch user could never reach layer
 * controls, group/ungroup, etc.
 *
 * Konva does not synthesize a native 'contextmenu' from a touch hold here —
 * verified experimentally, not assumed — because the canvas container sets
 * touch-action: none (so panning/drawing gestures stay ours to interpret),
 * and that also suppresses the platform's own long-press-to-contextmenu
 * conversion. So this hook runs its own timer instead of listening for one.
 *
 * A long press on EMPTY canvas deliberately does nothing, mirroring what a
 * right-click on empty canvas already does (closes/no-ops below) — it keeps
 * one mental model for "pressed-and-held with nothing under the finger"
 * instead of inventing a background-only menu nothing else in the app has.
 */
export function useContextMenu(
  stageRef: React.RefObject<Konva.Stage | null>,
) {
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  const openMenuAt = useCallback((nodeId: string, clientX: number, clientY: number) => {
    const container = stageRef.current?.container();
    if (!container) return;
    const box = container.getBoundingClientRect();
    setContextMenu({ x: clientX - box.left, y: clientY - box.top, nodeId });
  }, [stageRef]);

  const handleContextMenu = useCallback((e: Konva.KonvaEventObject<PointerEvent>) => {
    e.evt.preventDefault();
    if (e.target === stageRef.current) {
      setContextMenu(null);
      return;
    }
    const nodeId = findNodeIdFromTarget(e.target, stageRef);
    if (!nodeId) {
      setContextMenu(null);
      return;
    }
    openMenuAt(nodeId, e.evt.clientX, e.evt.clientY);
  }, [stageRef, openMenuAt]);

  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  // ── Touch long-press (REQ-CANVAS-028) ──────────────────────
  const longPressTimer = useRef<number | null>(null);
  const longPressStart = useRef<{
    x: number;
    y: number;
    pointerId: number;
    nodeId: string | null;
  } | null>(null);

  const clearLongPress = useCallback(() => {
    if (longPressTimer.current !== null) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    longPressStart.current = null;
  }, []);

  const handleLongPressPointerDown = useCallback((e: Konva.KonvaEventObject<PointerEvent>) => {
    const evt = e.evt;
    // Touch only, and only while the select tool owns the gesture — draw,
    // shape and lasso already claim touch for drawing/panning
    // (useShapeCreation), so this never competes with them.
    if (evt.pointerType !== 'touch') return;
    if (useToolStore.getState().activeTool !== 'select') return;

    // A second finger landing while a press is already pending (e.g. a pinch
    // starting under the other hand) must not orphan the first timer — left
    // running, it fires ~500ms after the FIRST finger's contact but reads
    // whatever longPressStart now holds, i.e. the second finger's data.
    clearLongPress();

    const nodeId = e.target === stageRef.current ? null : findNodeIdFromTarget(e.target, stageRef);
    longPressStart.current = { x: evt.clientX, y: evt.clientY, pointerId: evt.pointerId, nodeId };
    longPressTimer.current = window.setTimeout(() => {
      const start = longPressStart.current;
      longPressTimer.current = null;
      longPressStart.current = null;
      if (!start || !start.nodeId) return; // empty canvas: no-op, see hook doc
      useCanvasStore.getState().selectNode(start.nodeId, false);
      openMenuAt(start.nodeId, start.x, start.y);
    }, LONG_PRESS_MS);
  }, [stageRef, openMenuAt, clearLongPress]);

  const handleLongPressPointerMove = useCallback((e: Konva.KonvaEventObject<PointerEvent>) => {
    const start = longPressStart.current;
    if (!start || longPressTimer.current === null) return;
    if (e.evt.pointerId !== start.pointerId) return;
    const dx = e.evt.clientX - start.x;
    const dy = e.evt.clientY - start.y;
    if (dx * dx + dy * dy > LONG_PRESS_MOVE_CANCEL_PX * LONG_PRESS_MOVE_CANCEL_PX) {
      clearLongPress();
    }
  }, [clearLongPress]);

  // Guarded by pointerId like pointerMove above: a second finger's lift or
  // cancel (e.g. a pinch gesture ending) must not cancel the FIRST finger's
  // still-pending long press just because some pointerup/pointercancel fired.
  const handleLongPressPointerUp = useCallback((e: Konva.KonvaEventObject<PointerEvent>) => {
    if (longPressStart.current && e.evt.pointerId !== longPressStart.current.pointerId) return;
    clearLongPress();
  }, [clearLongPress]);

  const handleLongPressPointerCancel = useCallback((e: Konva.KonvaEventObject<PointerEvent>) => {
    if (longPressStart.current && e.evt.pointerId !== longPressStart.current.pointerId) return;
    clearLongPress();
  }, [clearLongPress]);

  return {
    contextMenu,
    handleContextMenu,
    closeContextMenu,
    handleLongPressPointerDown,
    handleLongPressPointerMove,
    handleLongPressPointerUp,
    handleLongPressPointerCancel,
  };
}
