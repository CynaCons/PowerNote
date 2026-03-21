import { useRef, useState, useEffect } from 'react';
import { Text, Group } from 'react-konva';
import type Konva from 'konva';
import type { CanvasNode } from '../../types/data';
import { useCanvasStore } from '../../stores/useCanvasStore';
import { TextEditor } from './TextEditor';

interface TextNodeProps {
  node: CanvasNode;
  isSelected: boolean;
  onSelect: (id: string) => void;
  stageScale: number;
  autoEdit?: boolean;
}

export function TextNode({ node, isSelected: _isSelected, onSelect, stageScale, autoEdit }: TextNodeProps) {
  // _isSelected kept for future use (e.g., visual feedback beyond Transformer)
  const textRef = useRef<Konva.Text>(null);
  const updateNode = useCanvasStore((s) => s.updateNode);
  const [isEditing, setIsEditing] = useState(false);

  // Auto-enter edit mode for newly placed text blocks
  useEffect(() => {
    if (autoEdit) {
      setIsEditing(true);
    }
  }, [autoEdit]);

  const handleDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
    updateNode(node.id, {
      x: e.target.x(),
      y: e.target.y(),
    });
  };

  const handleClick = (e: Konva.KonvaEventObject<MouseEvent>) => {
    e.cancelBubble = true; // Prevent stage click from firing
    onSelect(node.id);
  };

  const handleDblClick = () => {
    setIsEditing(true);
  };

  const handleFinishEdit = (newText: string) => {
    setIsEditing(false);
    updateNode(node.id, {
      data: { ...node.data, text: newText },
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
    <Group>
      <Text
        ref={textRef}
        id={node.id}
        x={node.x}
        y={node.y}
        width={node.width}
        text={node.data.text || 'Double-click to edit'}
        fontSize={node.data.fontSize}
        fontFamily={node.data.fontFamily}
        fontStyle={node.data.fontStyle}
        fill={node.data.text ? node.data.fill : '#999999'}
        draggable
        onDragEnd={handleDragEnd}
        onClick={handleClick}
        onTap={handleClick}
        onDblClick={handleDblClick}
        onDblTap={handleDblClick}
        padding={4}
      />
    </Group>
  );
}
