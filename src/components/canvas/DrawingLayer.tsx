import { Line, Circle, Rect } from 'react-konva';
import type { Stroke } from '../../types/data';

interface DrawingLayerProps {
  strokes: Stroke[];
  selectedStrokeIds: string[];
  inProgressPoints: number[] | null;
  inProgressColor: string;
  inProgressWidth: number;
  eraserPos: { x: number; y: number; radius: number } | null;
  penCursorPos: { x: number; y: number } | null;
  penColor: string;
  penWidth: number;
  lassoRect: { x: number; y: number; w: number; h: number } | null;
}

export function DrawingLayer({
  strokes,
  selectedStrokeIds,
  inProgressPoints,
  inProgressColor,
  inProgressWidth,
  eraserPos,
  penCursorPos,
  penColor,
  penWidth,
  lassoRect,
}: DrawingLayerProps) {
  const selectedSet = new Set(selectedStrokeIds);

  return (
    <>
      {/* Committed strokes */}
      {strokes.map((stroke) => (
        <Line
          key={stroke.id}
          points={stroke.points}
          stroke={stroke.color}
          strokeWidth={stroke.strokeWidth}
          tension={0.3}
          lineCap="round"
          lineJoin="round"
          globalCompositeOperation="source-over"
          listening={false}
        />
      ))}

      {/* Selected stroke highlights */}
      {strokes
        .filter((s) => selectedSet.has(s.id))
        .map((stroke) => (
          <Line
            key={`sel-${stroke.id}`}
            points={stroke.points}
            stroke="#2563eb"
            strokeWidth={stroke.strokeWidth + 4}
            tension={0.3}
            lineCap="round"
            lineJoin="round"
            opacity={0.3}
            listening={false}
          />
        ))}

      {/* In-progress stroke (while drawing) */}
      {inProgressPoints && inProgressPoints.length >= 4 && (
        <Line
          points={inProgressPoints}
          stroke={inProgressColor}
          strokeWidth={inProgressWidth}
          tension={0.3}
          lineCap="round"
          lineJoin="round"
          listening={false}
        />
      )}

      {/* Eraser cursor circle */}
      {eraserPos && (
        <Circle
          x={eraserPos.x}
          y={eraserPos.y}
          radius={eraserPos.radius}
          fill="rgba(255,255,255,0.5)"
          stroke="#94a3b8"
          strokeWidth={1}
          listening={false}
        />
      )}

      {/* Pen cursor dot — matches stroke size and color */}
      {penCursorPos && (
        <Circle
          x={penCursorPos.x}
          y={penCursorPos.y}
          radius={penWidth / 2}
          fill={penColor}
          opacity={0.7}
          listening={false}
        />
      )}

      {/* Lasso selection rectangle */}
      {lassoRect && (
        <Rect
          x={lassoRect.x}
          y={lassoRect.y}
          width={lassoRect.w}
          height={lassoRect.h}
          fill="rgba(37,99,235,0.08)"
          stroke="#2563eb"
          strokeWidth={1}
          dash={[6, 4]}
          listening={false}
        />
      )}
    </>
  );
}
