import { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { Group, Rect } from 'react-konva';
import { Html } from 'react-konva-utils';
import type Konva from 'konva';
import type { CanvasNode, TextNodeData } from '../../types/data';
import { useCanvasStore } from '../../stores/useCanvasStore';
import { TextEditor } from './TextEditor';
import { calculateSnap, type SnapLine } from './SnapGuides';
import { marked } from 'marked';

// Configure marked for inline rendering
marked.setOptions({
  breaks: true,
  gfm: true,
});

interface TextNodeProps {
  node: CanvasNode;
  isSelected: boolean;
  onSelect: (id: string, additive: boolean) => void;
  stageScale: number;
  autoEdit?: boolean;
  onSnapChange: (lines: SnapLine[]) => void;
}

export function TextNode({ node, isSelected, onSelect, stageScale, autoEdit, onSnapChange }: TextNodeProps) {
  const data = node.data as TextNodeData;
  const groupRef = useRef<Konva.Group>(null);
  const htmlRef = useRef<HTMLDivElement>(null);
  const updateNode = useCanvasStore((s) => s.updateNode);
  const [isEditing, setIsEditing] = useState(!!autoEdit);

  // Parse markdown to HTML
  const renderedHtml = useMemo(() => {
    if (!data.text) return '';
    return marked.parse(data.text) as string;
  }, [data.text]);

  // Measure the HTML content height and sync back to store
  const syncHeight = useCallback(() => {
    if (htmlRef.current) {
      const h = htmlRef.current.offsetHeight;
      if (h > 0 && Math.abs(h - node.height) > 2) {
        updateNode(node.id, { height: h });
      }
    }
  }, [node.id, node.height, updateNode]);

  useEffect(() => {
    // Delay measurement to let the DOM render
    const timer = setTimeout(syncHeight, 50);
    return () => clearTimeout(timer);
  }, [renderedHtml, node.width, syncHeight]);

  const handleDragMove = (e: Konva.KonvaEventObject<DragEvent>) => {
    // Only snap when Shift is held
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
      height: node.height || 30,
    };

    const snap = calculateSnap(draggedBounds, allNodes);
    onSnapChange(snap.lines);

    // Apply snap position
    e.target.x(snap.x);
    e.target.y(snap.y);
  };

  const handleDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
    onSnapChange([]); // Clear guides
    updateNode(node.id, {
      x: e.target.x(),
      y: e.target.y(),
    });
  };

  const handleMouseDown = (e: Konva.KonvaEventObject<MouseEvent>) => {
    e.cancelBubble = true;
  };

  const handleClick = (e: Konva.KonvaEventObject<MouseEvent>) => {
    e.cancelBubble = true;
    const additive = e.evt.ctrlKey || e.evt.metaKey;
    onSelect(node.id, additive);
  };

  const handleDblClick = (e: Konva.KonvaEventObject<MouseEvent>) => {
    e.cancelBubble = true;
    onSelect(node.id, false);
    setIsEditing(true);
  };

  const handleFinishEdit = (newText: string) => {
    setIsEditing(false);
    updateNode(node.id, {
      data: { ...data, text: newText },
    });
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <TextEditor
        node={node}
        stageScale={stageScale}
        onFinish={handleFinishEdit}
        onCancel={handleCancelEdit}
      />
    );
  }

  const hasContent = data.text && data.text.trim().length > 0;

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
      {/* Selection highlight background */}
      {isSelected && (
        <Rect
          x={-2}
          y={-2}
          width={node.width + 4}
          height={(node.height || 30) + 4}
          fill="#eff6ff"
          stroke="#2563eb"
          strokeWidth={1}
          cornerRadius={3}
          listening={false}
        />
      )}

      {/* Invisible hit area for click/dblclick detection */}
      <Rect
        id={node.id}
        x={0}
        y={0}
        width={node.width}
        height={node.height || 30}
        fill="transparent"
        onClick={handleClick}
        onTap={handleClick}
        onDblClick={handleDblClick}
        onDblTap={handleDblClick}
      />

      {/* Markdown-rendered HTML overlay */}
      <Html
        groupProps={{ x: 0, y: 0 }}
        divProps={{
          style: { pointerEvents: 'none' },
        }}
      >
        <div
          ref={htmlRef}
          className="powernote-markdown"
          style={{
            width: node.width,
            fontSize: data.fontSize,
            fontFamily: data.fontFamily,
            color: hasContent ? data.fill : '#999999',
            padding: 4,
            lineHeight: '1.4',
            wordWrap: 'break-word',
            overflowWrap: 'break-word',
            pointerEvents: 'none',
            userSelect: 'none',
          }}
          dangerouslySetInnerHTML={{
            __html: hasContent ? renderedHtml : '<p>Double-click to edit</p>',
          }}
        />
      </Html>
    </Group>
  );
}
