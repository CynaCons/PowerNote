import { useRef, useState } from 'react';
import { Group, Rect, Ellipse, Line, Arrow, Circle } from 'react-konva';
import type Konva from 'konva';
import type { CanvasNode, ShapeNodeData } from '../../types/data';
import { useCanvasStore } from '../../stores/useCanvasStore';
import { useToolStore } from '../../stores/useToolStore';
import { isNodeInteractive } from '../../utils/toolConfig';
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
  const updateNodeSilent = useCanvasStore((s) => s.updateNodeSilent);
  const [hovered, setHovered] = useState(false);

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
    // Only allow selection in select/shape/text modes, not in draw/lasso
    if (tool === 'select' || tool === 'text' || tool === 'image') {
      onSelect(node.id, e.evt.ctrlKey || e.evt.metaKey);
    }
  };

  const fill = data.fill === 'transparent' ? undefined : data.fill;
  const stroke = data.stroke;
  const strokeWidth = data.strokeWidth;
  const dash = data.strokeDash.length > 0 ? data.strokeDash : undefined;
  const w = node.width;
  const h = node.height;

  // For arrows/lines: w and h are signed (direction vector).
  // Compute bounding box for hit area and highlight overlays.
  const isLinear = data.shapeType === 'arrow' || data.shapeType === 'line';
  const hitX = isLinear ? Math.min(0, w) : 0;
  const hitY = isLinear ? Math.min(0, h) : 0;
  const hitW = isLinear ? Math.abs(w) : w;
  const hitH = isLinear ? Math.abs(h) : h;
  // Pad linear hit area so thin lines are clickable
  const hitPad = isLinear ? Math.max(10, strokeWidth * 3) : 0;

  // Only allow drag/hover in interactive modes (not draw or lasso)
  const activeTool = useToolStore((s) => s.activeTool);
  const isInteractive = isNodeInteractive(activeTool);

  return (
    <Group
      ref={groupRef}
      x={node.x}
      y={node.y}
      width={isLinear ? hitW : w}
      height={isLinear ? hitH : h}
      draggable={isInteractive}
      listening={isInteractive}
      onDragMove={handleDragMove}
      onDragEnd={handleDragEnd}
      onClick={handleClick}
      onTap={handleClick}
      onMouseEnter={(e) => {
        if (!isInteractive) return;
        setHovered(true);
        const stage = e.target.getStage();
        if (stage) stage.container().style.cursor = 'pointer';
      }}
      onMouseLeave={(e) => {
        if (!isInteractive) return;
        setHovered(false);
        const stage = e.target.getStage();
        if (stage) stage.container().style.cursor = 'default';
      }}
    >
      {/* Invisible hit area — padded for lines/arrows */}
      <Rect
        id={node.id}
        x={hitX - hitPad}
        y={hitY - hitPad}
        width={hitW + hitPad * 2}
        height={hitH + hitPad * 2}
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

      {/* Hover highlight */}
      {hovered && !isSelected && !isLinear && (
        <Rect
          x={hitX}
          y={hitY}
          width={hitW}
          height={hitH}
          fill="transparent"
          stroke="#93c5fd"
          strokeWidth={1.5 / stageScale}
          listening={false}
        />
      )}
      {hovered && !isSelected && isLinear && (
        <Line
          points={[0, 0, w, h]}
          stroke="#93c5fd"
          strokeWidth={Math.max(strokeWidth + 4, 6) / stageScale}
          lineCap="round"
          listening={false}
        />
      )}

      {/* Selection highlight */}
      {isSelected && !isLinear && (
        <Rect
          x={hitX}
          y={hitY}
          width={hitW}
          height={hitH}
          fill="transparent"
          stroke="#2563eb"
          strokeWidth={2 / stageScale}
          dash={[6 / stageScale, 4 / stageScale]}
          listening={false}
        />
      )}

      {/* Vertex handles for arrows/lines — replaces standard Transformer */}
      {isSelected && isLinear && isInteractive && (
        <>
          {/* Start vertex handle (at 0,0 relative to Group) */}
          <Circle
            x={0}
            y={0}
            radius={6 / stageScale}
            fill="#ffffff"
            stroke="#2563eb"
            strokeWidth={2 / stageScale}
            draggable
            onMouseEnter={(e) => {
              const stage = e.target.getStage();
              if (stage) stage.container().style.cursor = 'grab';
            }}
            onMouseLeave={(e) => {
              const stage = e.target.getStage();
              if (stage) stage.container().style.cursor = 'default';
            }}
            onDragMove={(e) => {
              e.cancelBubble = true;
              const dx = e.target.x();
              const dy = e.target.y();
              e.target.x(0);
              e.target.y(0);
              // Live update: move start point, adjust direction vector
              updateNodeSilent(node.id, {
                x: node.x + dx,
                y: node.y + dy,
                width: node.width - dx,
                height: node.height - dy,
              });
            }}
            onDragEnd={(e) => {
              e.cancelBubble = true;
              e.target.x(0);
              e.target.y(0);
              // Final update with undo entry (already moved via onDragMove)
              updateNode(node.id, { x: node.x, y: node.y, width: node.width, height: node.height });
            }}
          />

          {/* End vertex handle (at w,h relative to Group) */}
          <Circle
            x={w}
            y={h}
            radius={6 / stageScale}
            fill="#ffffff"
            stroke="#2563eb"
            strokeWidth={2 / stageScale}
            draggable
            onMouseEnter={(e) => {
              const stage = e.target.getStage();
              if (stage) stage.container().style.cursor = 'grab';
            }}
            onMouseLeave={(e) => {
              const stage = e.target.getStage();
              if (stage) stage.container().style.cursor = 'default';
            }}
            onDragMove={(e) => {
              e.cancelBubble = true;
              // Live update: end point changes direction vector
              updateNodeSilent(node.id, {
                width: e.target.x(),
                height: e.target.y(),
              });
            }}
            onDragEnd={(e) => {
              e.cancelBubble = true;
              // Final update with undo entry
              updateNode(node.id, { width: e.target.x(), height: e.target.y() });
              e.target.x(node.width);
              e.target.y(node.height);
            }}
          />
        </>
      )}
    </Group>
  );
}
