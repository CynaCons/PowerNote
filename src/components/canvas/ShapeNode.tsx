import { useRef } from 'react';
import { Group, Rect, Ellipse, Line, Arrow } from 'react-konva';
import type Konva from 'konva';
import type { CanvasNode, ShapeNodeData } from '../../types/data';
import { useCanvasStore } from '../../stores/useCanvasStore';
import { calculateSnap, type SnapLine } from './SnapGuides';

interface ShapeNodeProps {
  node: CanvasNode;
  isSelected: boolean;
  onSelect: (id: string, additive: boolean) => void;
  stageScale: number;
  onSnapChange: (lines: SnapLine[]) => void;
}

export function ShapeNode({ node, isSelected, onSelect, stageScale, onSnapChange }: ShapeNodeProps) {
  const data = node.data as ShapeNodeData;
  const groupRef = useRef<Konva.Group>(null);
  const updateNode = useCanvasStore((s) => s.updateNode);

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
    onSelect(node.id, e.evt.ctrlKey || e.evt.metaKey);
  };

  const fill = data.fill === 'transparent' ? undefined : data.fill;
  const stroke = data.stroke;
  const strokeWidth = data.strokeWidth;
  const dash = data.strokeDash.length > 0 ? data.strokeDash : undefined;
  const w = node.width;
  const h = node.height;

  return (
    <Group
      ref={groupRef}
      x={node.x}
      y={node.y}
      draggable
      onDragMove={handleDragMove}
      onDragEnd={handleDragEnd}
      onClick={handleClick}
      onTap={handleClick}
    >
      {/* Invisible hit area for easier selection */}
      <Rect
        width={w}
        height={h}
        fill="transparent"
        listening={true}
      />

      {/* Render shape based on type */}
      {data.shapeType === 'rect' && (
        <Rect
          width={w}
          height={h}
          fill={fill}
          stroke={stroke}
          strokeWidth={strokeWidth}
          dash={dash}
          cornerRadius={0}
          listening={false}
        />
      )}

      {data.shapeType === 'circle' && (
        <Ellipse
          x={w / 2}
          y={h / 2}
          radiusX={w / 2}
          radiusY={h / 2}
          fill={fill}
          stroke={stroke}
          strokeWidth={strokeWidth}
          dash={dash}
          listening={false}
        />
      )}

      {data.shapeType === 'triangle' && (
        <Line
          points={[w / 2, 0, w, h, 0, h]}
          closed
          fill={fill}
          stroke={stroke}
          strokeWidth={strokeWidth}
          dash={dash}
          listening={false}
        />
      )}

      {data.shapeType === 'arrow' && (
        <Arrow
          points={[0, 0, w, h]}
          stroke={stroke}
          strokeWidth={strokeWidth}
          dash={dash}
          fill={stroke}
          pointerLength={Math.max(8, strokeWidth * 3)}
          pointerWidth={Math.max(6, strokeWidth * 2.5)}
          listening={false}
        />
      )}

      {data.shapeType === 'line' && (
        <Line
          points={[0, 0, w, h]}
          stroke={stroke}
          strokeWidth={strokeWidth}
          dash={dash}
          lineCap="round"
          listening={false}
        />
      )}

      {/* Selection highlight */}
      {isSelected && (
        <Rect
          width={w}
          height={h}
          fill="transparent"
          stroke="#2563eb"
          strokeWidth={2 / stageScale}
          dash={[6 / stageScale, 4 / stageScale]}
          listening={false}
        />
      )}
    </Group>
  );
}
