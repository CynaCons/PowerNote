import { useRef, useEffect, useState } from 'react';
import { Group, Rect, Image as KonvaImage } from 'react-konva';
import type Konva from 'konva';
import type { CanvasNode, ImageNodeData } from '../../types/data';
import { useCanvasStore } from '../../stores/useCanvasStore';
import { calculateSnap, type SnapLine } from './SnapGuides';

interface ImageNodeProps {
  node: CanvasNode;
  isSelected: boolean;
  onSelect: (id: string, additive: boolean) => void;
  stageScale: number;
  onSnapChange: (lines: SnapLine[]) => void;
}

export function ImageNode({ node, isSelected, onSelect, stageScale, onSnapChange }: ImageNodeProps) {
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
    const additive = e.evt.ctrlKey || e.evt.metaKey;
    onSelect(node.id, additive);
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

      {/* Selection border */}
      {isSelected && (
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
      )}
    </Group>
  );
}
