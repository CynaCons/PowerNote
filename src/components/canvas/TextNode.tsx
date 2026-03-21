import { useRef, useState, useEffect, useMemo } from 'react';
import { Group, Rect } from 'react-konva';
import { Html } from 'react-konva-utils';
import type Konva from 'konva';
import type { CanvasNode, TextNodeData } from '../../types/data';
import { useCanvasStore } from '../../stores/useCanvasStore';
import { TextEditor } from './TextEditor';
import { calculateSnap, type SnapLine } from './SnapGuides';
import { marked } from 'marked';

// Configure marked for GFM + task lists
marked.setOptions({
  breaks: true,
  gfm: true,
});

// Toggle a checkbox in raw markdown text by its index
function toggleCheckbox(text: string, checkboxIndex: number): string {
  let count = 0;
  return text.replace(/- \[([ x])\]/g, (match, state) => {
    if (count === checkboxIndex) {
      count++;
      return state === 'x' ? '- [ ]' : '- [x]';
    }
    count++;
    return match;
  });
}

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
  const updateNodeSilent = useCanvasStore((s) => s.updateNodeSilent);
  const [isEditing, setIsEditing] = useState(!!autoEdit);

  // Parse markdown to HTML
  const renderedHtml = useMemo(() => {
    if (!data.text) return '';
    return marked.parse(data.text) as string;
  }, [data.text]);

  // Measure the HTML content dimensions and sync back to store (silent — no undo push)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!htmlRef.current) return;
      const w = Math.max(60, htmlRef.current.scrollWidth + 8); // +8 for padding
      const h = Math.max(24, htmlRef.current.offsetHeight);
      if (Math.abs(w - node.width) > 2 || Math.abs(h - node.height) > 2) {
        updateNodeSilent(node.id, { width: w, height: h });
      }
    }, 60);
    return () => clearTimeout(timer);
  }, [renderedHtml, node.id, node.width, node.height, updateNodeSilent]);

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
          onClick={(e) => {
            // Handle checkbox clicks
            const target = e.target as HTMLElement;
            if (target.tagName === 'INPUT' && target.getAttribute('type') === 'checkbox') {
              e.stopPropagation();
              const checkboxes = htmlRef.current?.querySelectorAll('input[type="checkbox"]');
              if (checkboxes) {
                const idx = Array.from(checkboxes).indexOf(target as HTMLInputElement);
                if (idx >= 0) {
                  const newText = toggleCheckbox(data.text, idx);
                  updateNode(node.id, { data: { ...data, text: newText } });
                }
              }
            }
          }}
          style={{
            minWidth: 60,
            maxWidth: 800,
            width: 'max-content',
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
