import { useRef } from 'react';
import { Group, Rect, Text } from 'react-konva';
import { Html } from 'react-konva-utils';
import type Konva from 'konva';
import type { CanvasNode, DiagramNodeData } from '../../types/data';
import { useCanvasStore } from '../../stores/useCanvasStore';
import { useToolStore } from '../../stores/useToolStore';
import { useGroupStore } from '../../stores/useGroupStore';
import { useDrawStore } from '../../stores/useDrawStore';
import { useDiagramStore } from '../../stores/useDiagramStore';
import { isNodeInteractive } from '../../utils/toolConfig';
import { multiDragStart, multiDragMove, multiDragEnd } from '../../utils/multiDrag';
import { FRAME_TITLE_H } from '../../diagram/canvasOps';
import { sniffFormat } from '../../diagram';
import { FORMAT_LABEL } from '../../diagram/formatLabels';
import type { SnapLine } from './SnapGuides';
import './DiagramNode.css';

interface DiagramNodeProps {
  node: CanvasNode;
  isSelected: boolean;
  onSelect: (id: string, additive: boolean) => void;
  stageScale: number;
  onSnapChange: (lines: SnapLine[]) => void;
}

/**
 * A diagram is a canvas object, like an image: selectable, draggable, deletable.
 * What makes it a diagram is that its contents are generated — ordinary shape
 * and text nodes carrying this node's id as their groupId, so they keep moving
 * with the frame through the existing group machinery while staying editable
 * one by one under double-click isolation.
 *
 * The source lives on the node, so it travels with the diagram through copy,
 * save and load without a side table to keep in step.
 */
export function DiagramNode({ node, isSelected, onSelect, stageScale, onSnapChange }: DiagramNodeProps) {
  const data = node.data as DiagramNodeData;
  const groupRef = useRef<Konva.Group>(null);

  const activeTool = useToolStore((s) => s.activeTool);
  const isInteractive = isNodeInteractive(activeTool);

  // Read from the source, not stored on the node: the source editor lets you
  // paste a different language over the old one, so a remembered format would
  // go stale the moment it mattered.
  const format = sniffFormat(data.source ?? '');
  const formatLabel = FORMAT_LABEL[format];

  const handleClick = (e: Konva.KonvaEventObject<MouseEvent>) => {
    e.cancelBubble = true;
    if (activeTool === 'select' || activeTool === 'text' || activeTool === 'image') {
      onSelect(node.id, e.evt.ctrlKey || e.evt.metaKey);
    }
  };

  const handleDblClick = (e: Konva.KonvaEventObject<MouseEvent>) => {
    e.cancelBubble = true;
    useGroupStore.getState().enterIsolation(node.id);
    useCanvasStore.setState({ selectedNodeIds: [node.id] });
    useDrawStore.getState().selectStrokes([]);
  };


  return (
    <>
      <Group
        ref={groupRef}
        x={node.x}
        y={node.y}
        width={node.width}
        height={node.height}
        draggable={isInteractive}
        listening={isInteractive}
        onDragStart={(e) => multiDragStart(node.id, e.target.x(), e.target.y())}
        onDragMove={(e) => {
          multiDragMove(node.id, e.target.x(), e.target.y(), e.target.getStage());
          onSnapChange([]);
        }}
        onDragEnd={(e) => multiDragEnd(node.id, e.target.x(), e.target.y())}
        onClick={handleClick}
        onTap={handleClick}
        onDblClick={handleDblClick}
        onDblTap={handleDblClick}
      >
        {/* Frame. Paper with a hairline so the tinted contents stay the figure.
            The id is what the right-click walk looks for — without it a diagram
            had no context menu at all, and so no way to change its layer. */}
        <Rect
          id={node.id}
          width={node.width}
          height={node.height}
          fill="#FFFFFF"
          stroke={isSelected ? '#2563eb' : '#C3CBC9'}
          strokeWidth={isSelected ? 2 / stageScale : 1}
          cornerRadius={8}
        />
        {/* Title band */}
        <Rect width={node.width} height={FRAME_TITLE_H} fill="#F3F5F4" cornerRadius={[8, 8, 0, 0]} />
        <Rect y={FRAME_TITLE_H} width={node.width} height={1} fill="#DCE1E0" />
        <Text
          x={14}
          y={FRAME_TITLE_H / 2 - 7}
          text={data.title || 'Diagram'}
          fontSize={13}
          fontStyle="600"
          fontFamily="Inter, system-ui, sans-serif"
          fill="#14181A"
        />

        {/* The one control on the frame: the source behind it, named for the
            language it is actually written in. This used to read "plantuml" on
            every diagram, so an SVG or Mermaid frame said out loud that it was
            something it was not. */}
        {isInteractive && (
          <Html
            divProps={{ style: { pointerEvents: 'auto' } }}
            groupProps={{ x: node.width - (formatLabel.length * 7 + 30), y: 7 }}
          >
            <button
              type="button"
              className="diagram-node__src"
              data-testid={`diagram-source-btn-${node.id}`}
              data-format={format}
              title={`Show the ${formatLabel} this diagram was built from`}
              onClick={(e) => {
                e.stopPropagation();
                useDiagramStore.getState().openSource(node.id);
              }}
            >
              {formatLabel}
            </button>
          </Html>
        )}
      </Group>

    </>
  );
}
