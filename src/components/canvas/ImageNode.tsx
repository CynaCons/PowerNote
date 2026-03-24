import { useRef, useEffect, useState } from 'react';
import { Group, Rect, Image as KonvaImage } from 'react-konva';
import type Konva from 'konva';
import type { CanvasNode, ImageNodeData } from '../../types/data';
import { useCanvasStore } from '../../stores/useCanvasStore';
import { useToolStore } from '../../stores/useToolStore';
import { calculateSnap, type SnapLine } from './SnapGuides';

interface ImageNodeProps {
  node: CanvasNode;
  isSelected: boolean;
  onSelect: (id: string, additive: boolean) => void;
  stageScale: number;
  onSnapChange: (lines: SnapLine[]) => void;
}

export function ImageNode({ node, isSelected, onSelect, stageScale: _stageScale, onSnapChange }: ImageNodeProps) {
  const data = node.data as ImageNodeData;
  const groupRef = useRef<Konva.Group>(null);
  const updateNode = useCanvasStore((s) => s.updateNode);
  const [image, setImage] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    const img = new window.Image();
    img.onload = () => setImage(img);
    img.onerror = () => setImage(null);
    img.src = data.src;
  }, [data.src]);

  const handleDragMove = (e: Konva.KonvaEventObject<DragEvent>) => {
    if (!e.evt.shiftKey) {
      onSnapChange([]);
      return;
    }
    const allNodes = useCanvasStore.getState().nodes;
    const draggedBounds = {
      id: node.id,
      x: e.target.x(),
      y: e.target.y(),
      width: node.width,
      height: node.height,
    };
    const snap = calculateSnap(draggedBounds, allNodes);
    onSnapChange(snap.lines);
    e.target.x(snap.x);
    e.target.y(snap.y);
  };

  const handleDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
    onSnapChange([]);
    updateNode(node.id, {
      x: e.target.x(),
      y: e.target.y(),
    });
  };

  const handleClick = (e: Konva.KonvaEventObject<MouseEvent>) => {
    e.cancelBubble = true;
    const tool = useToolStore.getState().activeTool;
    if (tool === 'select' || tool === 'text' || tool === 'shape') {
      const additive = e.evt.ctrlKey || e.evt.metaKey;
      onSelect(node.id, additive);
    }
  };

  const handleMouseDown = (e: Konva.KonvaEventObject<MouseEvent>) => {
    e.cancelBubble = true;
  };

  // Calculate crop parameters for Konva
  const crop = data.crop;
  const cropConfig = crop && image ? {
    crop: {
      x: crop.x * data.naturalWidth,
      y: crop.y * data.naturalHeight,
      width: crop.width * data.naturalWidth,
      height: crop.height * data.naturalHeight,
    },
  } : {};

  return (
    <Group
      ref={groupRef}
      x={node.x}
      y={node.y}
      draggable
      onDragMove={handleDragMove}
      onDragEnd={handleDragEnd}
      onMouseDown={handleMouseDown}
    >
      {/* Hit area */}
      <Rect
        id={node.id}
        x={0}
        y={0}
        width={node.width}
        height={node.height}
        fill="transparent"
        onClick={handleClick}
        onTap={handleClick}
      />

      {/* The actual image with optional crop */}
      {image && (
        <KonvaImage
          image={image}
          x={0}
          y={0}
          width={node.width}
          height={node.height}
          {...cropConfig}
          listening={false}
        />
      )}

      {/* Placeholder while loading */}
      {!image && (
        <Rect
          x={0}
          y={0}
          width={node.width}
          height={node.height}
          fill="#f3f4f6"
          stroke="#d1d5db"
          strokeWidth={1}
          dash={[4, 4]}
          cornerRadius={4}
          listening={false}
        />
      )}

      {/* Selection border + resize handles */}
      {isSelected && (
        <>
          <Rect
            x={-2}
            y={-2}
            width={node.width + 4}
            height={node.height + 4}
            stroke="#2563eb"
            strokeWidth={1.5}
            fill="transparent"
            dash={[6, 3]}
            listening={false}
          />
          {/* Corner resize handles */}
          {[
            { cx: 0, cy: 0, cursor: 'nw-resize', anchor: 'tl' },
            { cx: node.width, cy: 0, cursor: 'ne-resize', anchor: 'tr' },
            { cx: 0, cy: node.height, cursor: 'sw-resize', anchor: 'bl' },
            { cx: node.width, cy: node.height, cursor: 'se-resize', anchor: 'br' },
          ].map(({ cx, cy, cursor, anchor }) => (
            <Rect
              key={anchor}
              x={cx - 5}
              y={cy - 5}
              width={10}
              height={10}
              fill="#ffffff"
              stroke="#2563eb"
              strokeWidth={1}
              cornerRadius={2}
              onMouseEnter={(e) => { e.target.getStage()!.container().style.cursor = cursor; }}
              onMouseLeave={(e) => { e.target.getStage()!.container().style.cursor = 'default'; }}
              draggable
              onDragMove={(e) => {
                e.cancelBubble = true;
                const handle = e.target;
                const hx = handle.x() + 5;
                const hy = handle.y() + 5;

                let newW = node.width;
                let newH = node.height;
                let newX = node.x;
                let newY = node.y;

                if (anchor === 'br') {
                  newW = Math.max(30, hx);
                  newH = Math.max(30, hy);
                } else if (anchor === 'bl') {
                  const dx = hx;
                  newW = Math.max(30, node.width - dx);
                  newX = node.x + (node.width - newW);
                  newH = Math.max(30, hy);
                } else if (anchor === 'tr') {
                  newW = Math.max(30, hx);
                  const dy = hy;
                  newH = Math.max(30, node.height - dy);
                  newY = node.y + (node.height - newH);
                } else if (anchor === 'tl') {
                  const dx = hx;
                  const dy = hy;
                  newW = Math.max(30, node.width - dx);
                  newH = Math.max(30, node.height - dy);
                  newX = node.x + (node.width - newW);
                  newY = node.y + (node.height - newH);
                }

                // Keep aspect ratio
                const aspect = node.width / node.height;
                if (newW / newH > aspect) {
                  newW = newH * aspect;
                } else {
                  newH = newW / aspect;
                }

                updateNode(node.id, { x: newX, y: newY, width: newW, height: newH });

                // Reset handle to corner position (it will re-render)
                handle.x(anchor.includes('r') ? newW - 5 : -5);
                handle.y(anchor.includes('b') ? newH - 5 : -5);
              }}
              onDragEnd={(e) => { e.cancelBubble = true; }}
            />
          ))}
        </>
      )}
    </Group>
  );
}
