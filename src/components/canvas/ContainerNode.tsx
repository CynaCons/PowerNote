import { useState, useRef, useEffect } from 'react';
import { Group, Rect, Text } from 'react-konva';
import type Konva from 'konva';
import type { CanvasNode, ContainerNodeData } from '../../types/data';
import { useCanvasStore } from '../../stores/useCanvasStore';
import { Html } from 'react-konva-utils';

interface ContainerNodeProps {
  node: CanvasNode;
  isSelected: boolean;
  onSelect: (id: string) => void;
  stageScale: number;
}

export function ContainerNode({ node, isSelected, onSelect, stageScale }: ContainerNodeProps) {
  const data = node.data as ContainerNodeData;
  const updateNode = useCanvasStore((s) => s.updateNode);
  const toggleCollapse = useCanvasStore((s) => s.toggleContainerCollapse);
  const nodes = useCanvasStore((s) => s.nodes);

  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const children = nodes.filter((n) => n.parentContainerId === node.id);

  useEffect(() => {
    if (isEditingTitle && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditingTitle]);

  const handleDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
    const dx = e.target.x() - node.x;
    const dy = e.target.y() - node.y;

    // Move the container itself
    updateNode(node.id, {
      x: e.target.x(),
      y: e.target.y(),
    });

    // Move all children by the same delta
    children.forEach((child) => {
      useCanvasStore.getState().updateNode(child.id, {
        x: child.x + dx,
        y: child.y + dy,
      });
    });
  };

  const handleClick = (e: Konva.KonvaEventObject<MouseEvent>) => {
    e.cancelBubble = true;
    onSelect(node.id);
  };

  const handleCollapseToggle = (e: Konva.KonvaEventObject<MouseEvent>) => {
    e.cancelBubble = true;
    toggleCollapse(node.id);
  };

  const handleTitleDblClick = (e: Konva.KonvaEventObject<MouseEvent>) => {
    e.cancelBubble = true;
    setIsEditingTitle(true);
  };

  const commitTitle = () => {
    const val = inputRef.current?.value.trim();
    if (val && val !== data.title) {
      updateNode(node.id, {
        data: { ...data, title: val },
      });
    }
    setIsEditingTitle(false);
  };

  return (
    <Group
      draggable
      onDragEnd={handleDragEnd}
      onClick={handleClick}
      onTap={handleClick}
    >
      {/* Container body (only when expanded) */}
      {!data.isCollapsed && (
        <Rect
          x={node.x}
          y={node.y + data.headerHeight}
          width={node.width}
          height={node.height - data.headerHeight}
          fill={data.fill}
          stroke={isSelected ? '#2563eb' : data.borderColor}
          strokeWidth={isSelected ? 2 : 1}
          cornerRadius={[0, 0, 6, 6]}
        />
      )}

      {/* Header bar */}
      <Rect
        x={node.x}
        y={node.y}
        width={node.width}
        height={data.headerHeight}
        fill="#f5f5f5"
        stroke={isSelected ? '#2563eb' : data.borderColor}
        strokeWidth={isSelected ? 2 : 1}
        cornerRadius={data.isCollapsed ? 6 : [6, 6, 0, 0]}
      />

      {/* Collapse/expand triangle */}
      <Text
        x={node.x + 8}
        y={node.y + (data.headerHeight - 10) / 2}
        text={data.isCollapsed ? '\u25B6' : '\u25BC'}
        fontSize={10}
        fill="#737373"
        onClick={handleCollapseToggle}
        onTap={handleCollapseToggle}
      />

      {/* Title text */}
      {!isEditingTitle && (
        <Text
          x={node.x + 24}
          y={node.y + 8}
          width={node.width - 32}
          text={data.title}
          fontSize={13}
          fontStyle="bold"
          fill="#1a1a1a"
          onDblClick={handleTitleDblClick}
          onDblTap={handleTitleDblClick}
          listening={!isEditingTitle}
        />
      )}

      {/* Inline title editor */}
      {isEditingTitle && (
        <Html
          groupProps={{ x: node.x + 24, y: node.y + 4 }}
          divProps={{ style: {} }}
        >
          <input
            ref={inputRef}
            defaultValue={data.title}
            onBlur={commitTitle}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitTitle();
              if (e.key === 'Escape') setIsEditingTitle(false);
              e.stopPropagation();
            }}
            style={{
              width: (node.width - 32) * stageScale,
              fontSize: 13 * stageScale,
              fontWeight: 'bold',
              border: '1px solid #2563eb',
              borderRadius: 3,
              padding: '2px 4px',
              outline: 'none',
              background: 'white',
              transform: `scale(${1 / stageScale})`,
              transformOrigin: 'top left',
            }}
          />
        </Html>
      )}

      {/* Child count badge when collapsed */}
      {data.isCollapsed && children.length > 0 && (
        <Text
          x={node.x + node.width - 40}
          y={node.y + 8}
          text={`(${children.length})`}
          fontSize={12}
          fill="#737373"
          listening={false}
        />
      )}
    </Group>
  );
}
