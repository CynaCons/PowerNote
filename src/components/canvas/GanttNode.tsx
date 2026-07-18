import { useMemo } from 'react';
import { Group, Rect } from 'react-konva';
import type Konva from 'konva';
import { Html } from 'react-konva-utils';
import type { CanvasNode as CanvasNodeType, GanttNodeData } from '../../types/data';
import { GanttRenderer, blankDocument, validateDocument } from '../../vendor/powerplanner/embed';
import type { GanttDocument } from '../../vendor/powerplanner/embed';
import { useCanvasStore } from '../../stores/useCanvasStore';
import type { SnapLine } from './SnapGuides';

interface GanttNodeProps {
  node: CanvasNodeType;
  isSelected: boolean;
  onSelect: (id: string, additive: boolean) => void;
  stageScale: number;
  onSnapChange: (lines: SnapLine[]) => void;
}

/**
 * Renders a PowerPlanner Gantt chart inside a PowerNote canvas node.
 *
 * The chart document lives in `node.data.doc` and is rendered by the
 * vendored read-only renderer. Konva handles selection, drag, and resize;
 * we just render into an Html portal sized to the node's bounding box.
 */
export function GanttNode({ node, isSelected, onSelect, onSnapChange }: GanttNodeProps) {
  const updateNode = useCanvasStore((s) => s.updateNode);
  const data = node.data as GanttNodeData;

  // Validate (or fall back to blank) once per doc reference change.
  const doc = useMemo<GanttDocument>(() => {
    try {
      return validateDocument(data.doc);
    } catch {
      // If the payload is missing or malformed, render a blank chart.
      return blankDocument('Untitled chart');
    }
  }, [data.doc]);

  const handleClick = (e: Konva.KonvaEventObject<Event>) => {
    const evt = e.evt as MouseEvent;
    onSelect(node.id, evt.shiftKey || evt.metaKey || evt.ctrlKey);
  };

  const handleDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
    updateNode(node.id, { x: e.target.x(), y: e.target.y() });
    onSnapChange([]);
  };

  return (
    <Group
      x={node.x}
      y={node.y}
      draggable
      onDragEnd={handleDragEnd}
      onClick={handleClick}
      onTap={handleClick}
    >
      {/* Konva hit area + selection chrome */}
      <Rect
        id={node.id}
        x={0}
        y={0}
        width={node.width}
        height={node.height}
        fill="transparent"
        stroke={isSelected ? '#818cf8' : 'transparent'}
        strokeWidth={isSelected ? 1.5 : 0}
        cornerRadius={8}
      />
      {/* Embedded Gantt renderer */}
      <Html
        groupProps={{ x: 0, y: 0 }}
        divProps={{
          style: {
            pointerEvents: 'none',
            width: node.width,
            height: node.height,
            overflow: 'hidden',
            borderRadius: 8,
            background: '#0b0c0f',
          },
        }}
      >
        <div style={{ width: node.width, height: node.height, pointerEvents: 'none' }}>
          <GanttRenderer
            document={doc}
            width={node.width}
            height={node.height}
            options={{
              showCriticalPath: data.showCriticalPath ?? false,
              themeOverride: data.theme && data.theme !== 'auto' ? data.theme : 'dark',
            }}
          />
        </div>
      </Html>
    </Group>
  );
}
