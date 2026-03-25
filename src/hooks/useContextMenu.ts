import { useState, useCallback } from 'react';
import type Konva from 'konva';
import { useCanvasStore } from '../stores/useCanvasStore';

export interface ContextMenuState {
  x: number;
  y: number;
  nodeId: string;
}

/**
 * Hook for right-click context menu state and handlers.
 * Manages open/close state and finding which node was right-clicked.
 */
export function useContextMenu(
  stageRef: React.RefObject<Konva.Stage | null>,
) {
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  const handleContextMenu = useCallback((e: Konva.KonvaEventObject<PointerEvent>) => {
    e.evt.preventDefault();
    // Find if we right-clicked on a node
    const target = e.target;
    if (target === stageRef.current) {
      setContextMenu(null);
      return;
    }
    // Walk up to find a Group with an element that has a node ID
    let current: Konva.Node | null = target;
    while (current && current !== stageRef.current) {
      const rect = (current as any).findOne?.('Rect');
      const nodeId = rect?.id?.();
      if (nodeId) {
        const storeNode = useCanvasStore.getState().nodes.find((n) => n.id === nodeId);
        if (storeNode) {
          const stage = stageRef.current;
          const container = stage?.container();
          if (container) {
            const rect = container.getBoundingClientRect();
            setContextMenu({
              x: e.evt.clientX - rect.left,
              y: e.evt.clientY - rect.top,
              nodeId,
            });
          }
          return;
        }
      }
      current = current.parent;
    }
    setContextMenu(null);
  }, [stageRef]);

  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  return { contextMenu, handleContextMenu, closeContextMenu };
}
