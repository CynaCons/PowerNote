import { useRef, useState, useEffect, useCallback } from 'react';
import { Text, Group, Rect } from 'react-konva';
import type Konva from 'konva';
import type { CanvasNode, TextNodeData } from '../../types/data';
import { useCanvasStore } from '../../stores/useCanvasStore';
import { TextEditor } from './TextEditor';

interface TextNodeProps {
  node: CanvasNode;
  isSelected: boolean;
  onSelect: (id: string) => void;
  stageScale: number;
  autoEdit?: boolean;
}

export function TextNode({ node, isSelected, onSelect, stageScale, autoEdit }: TextNodeProps) {
  const data = node.data as TextNodeData;
  const textRef = useRef<Konva.Text>(null);
  const updateNode = useCanvasStore((s) => s.updateNode);
  const [isEditing, setIsEditing] = useState(false);
  const [textHeight, setTextHeight] = useState(node.height);

  // Auto-enter edit mode for newly placed text blocks
  useEffect(() => {
    if (autoEdit) {
      setIsEditing(true);
    }
  }, [autoEdit]);

  // Track text height for the selection background
  const measureHeight = useCallback(() => {
    if (textRef.current) {
      setTextHeight(textRef.current.height());
    }
  }, []);

  useEffect(() => {
    measureHeight();
  }, [node.data, node.width, measureHeight]);

  const handleDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
    updateNode(node.id, {
      x: e.target.x(),
      y: e.target.y(),
    });
  };

  const handleClick = (e: Konva.KonvaEventObject<MouseEvent>) => {
    e.cancelBubble = true;
    onSelect(node.id);
  };

  const handleDblClick = () => {
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

  return (
    <Group
      draggable
      onDragEnd={handleDragEnd}
    >
      {/* Selection highlight background */}
      {isSelected && (
        <Rect
          x={node.x - 2}
          y={node.y - 2}
          width={node.width + 4}
          height={textHeight + 4}
          fill="#eff6ff"
          cornerRadius={3}
          listening={false}
        />
      )}
      <Text
        ref={textRef}
        id={node.id}
        x={node.x}
        y={node.y}
        width={node.width}
        text={data.text || 'Double-click to edit'}
        fontSize={data.fontSize}
        fontFamily={data.fontFamily}
        fontStyle={data.fontStyle}
        fill={data.text ? data.fill : '#999999'}
        onClick={handleClick}
        onTap={handleClick}
        onDblClick={handleDblClick}
        onDblTap={handleDblClick}
        padding={4}
      />
    </Group>
  );
}
