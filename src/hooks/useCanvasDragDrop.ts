import { useEffect } from 'react';
import type Konva from 'konva';
import { useCanvasStore } from '../stores/useCanvasStore';
import { generateId } from '../utils/ids';
import type { CanvasNode as CanvasNodeType, ImageNodeData } from '../types/data';

/** Read a File (image) as a base64 data URI, then add it to the canvas */
function addImageFromFile(file: File, x: number, y: number) {
  if (!file.type.startsWith('image/')) return;
  const reader = new FileReader();
  reader.onload = () => {
    const src = reader.result as string;
    const img = new Image();
    img.onload = () => {
      // Scale down if too large (max 600px wide)
      const maxW = 600;
      let w = img.naturalWidth;
      let h = img.naturalHeight;
      if (w > maxW) {
        h = h * (maxW / w);
        w = maxW;
      }
      const node: CanvasNodeType = {
        id: generateId(),
        type: 'image',
        x, y,
        width: w,
        height: h,
        layer: 3,
        data: {
          src,
          alt: file.name || 'image',
          naturalWidth: img.naturalWidth,
          naturalHeight: img.naturalHeight,
        } as ImageNodeData,
      };
      useCanvasStore.getState().addNode(node);
    };
    img.src = src;
  };
  reader.readAsDataURL(file);
}

/**
 * Hook for image drag-and-drop onto canvas and clipboard paste handlers.
 * Handles:
 * - Ctrl+V paste for images from clipboard
 * - Drag-drop image files onto the canvas container
 */
export function useCanvasDragDrop(
  containerRef: React.RefObject<HTMLDivElement | null>,
  stageRef: React.RefObject<Konva.Stage | null>,
  dimensions: { width: number; height: number },
) {
  // ── Clipboard paste (Ctrl+V for images) ─────────────────
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of Array.from(items)) {
        if (item.type.startsWith('image/')) {
          e.preventDefault();
          const file = item.getAsFile();
          if (file) {
            // Place at center of visible canvas
            const stage = stageRef.current;
            const cx = stage ? (dimensions.width / 2 - stage.x()) / stage.scaleX() : 200;
            const cy = stage ? (dimensions.height / 2 - stage.y()) / stage.scaleY() : 200;
            addImageFromFile(file, cx, cy);
          }
          return;
        }
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [stageRef, dimensions]);

  // ── Drag-drop files onto canvas ─────────────────────────
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
      e.dataTransfer!.dropEffect = 'copy';
    };

    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      const files = e.dataTransfer?.files;
      if (!files) return;

      const stage = stageRef.current;
      const rect = container.getBoundingClientRect();

      for (const file of Array.from(files)) {
        if (file.type.startsWith('image/')) {
          // Convert drop position to canvas coordinates
          const dropX = stage
            ? (e.clientX - rect.left - stage.x()) / stage.scaleX()
            : e.clientX - rect.left;
          const dropY = stage
            ? (e.clientY - rect.top - stage.y()) / stage.scaleY()
            : e.clientY - rect.top;
          addImageFromFile(file, dropX, dropY);
        }
      }
    };

    container.addEventListener('dragover', handleDragOver);
    container.addEventListener('drop', handleDrop);
    return () => {
      container.removeEventListener('dragover', handleDragOver);
      container.removeEventListener('drop', handleDrop);
    };
  }, [containerRef, stageRef]);
}
