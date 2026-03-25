import { useCallback } from 'react';
import type Konva from 'konva';
import { useCanvasStore, undoBatchStart } from '../stores/useCanvasStore';
import { useToolStore } from '../stores/useToolStore';
import { generateId } from '../utils/ids';
import type { CanvasNode as CanvasNodeType } from '../types/data';

// Track the most recently placed node so it auto-enters edit mode
let autoEditNodeId: string | null = null;

/** Get the auto-edit node ID and clear it (one-shot read) */
export function consumeAutoEditNodeId(nodeId: string): boolean {
  if (autoEditNodeId === nodeId) {
    autoEditNodeId = null;
    return true;
  }
  return false;
}

/**
 * Hook for text tool click-to-place logic.
 * Returns a click handler that places a new text node when the text tool is active,
 * or clears selection otherwise. Implements one-shot behavior (reverts to select after placing).
 */
export function useTextPlacement(
  stageRef: React.RefObject<Konva.Stage | null>,
  addNode: (node: CanvasNodeType) => void,
  selectNode: (id: string, additive: boolean) => void,
  clearSelection: () => void,
) {
  const handleStageClick = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      // Allow clicks on the Stage itself AND on non-interactive background elements
      // (like PageGuide rects which have listening={false} or no node ID)
      const target = e.target;
      const isStage = target === stageRef.current;
      const isBackgroundElement = !isStage && !target.id();
      if (!isStage && !isBackgroundElement) return;

      const stage = stageRef.current;
      if (!stage) return;

      // Read tool state fresh (not from stale closure) to prevent accidental placement
      const currentTool = useToolStore.getState().activeTool;
      const currentTextOptions = useToolStore.getState().textOptions;

      if (currentTool === 'text') {
        const pointer = stage.getPointerPosition();
        if (!pointer) return;

        const scale = stage.scaleX();
        const stageX = (pointer.x - stage.x()) / scale;
        const stageY = (pointer.y - stage.y()) / scale;

        const newNode: CanvasNodeType = {
          id: generateId(),
          type: 'text',
          x: stageX,
          y: stageY,
          width: 120,
          height: 30,
          layer: 4,
          data: {
            text: '',
            fontSize: currentTextOptions.fontSize,
            fontFamily: currentTextOptions.fontFamily,
            fontStyle: currentTextOptions.fontStyle,
            fill: currentTextOptions.fill,
          },
        };

        // Batch: addNode + first updateNode (blur commit) = single undo entry
        undoBatchStart(useCanvasStore.getState().nodes);
        useToolStore.getState().setTool('select');
        addNode(newNode);
        selectNode(newNode.id, false);
        autoEditNodeId = newNode.id;
      } else {
        clearSelection();
      }
    },
    [stageRef, addNode, selectNode, clearSelection],
  );

  return { handleStageClick };
}
