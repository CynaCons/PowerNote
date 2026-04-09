import { useRef, useState, useEffect, useMemo } from 'react';
import { Group, Rect } from 'react-konva';
import { Html } from 'react-konva-utils';
import type Konva from 'konva';
import type { CanvasNode, TextNodeData } from '../../types/data';
import { undoBatchEnd } from '../../stores/useCanvasStore';
import { useCanvasStore } from '../../stores/useCanvasStore';
import { useWorkspaceStore } from '../../stores/useWorkspaceStore';
import { useDrawStore } from '../../stores/useDrawStore';
import { useToolStore } from '../../stores/useToolStore';
import { isNodeInteractive } from '../../utils/toolConfig';
import { TextEditor } from './TextEditor';
import { calculateSnap, type SnapLine } from './SnapGuides';
import { marked } from 'marked';

// Handle powernote:// internal links
function handleInternalLink(href: string) {
  // Format: powernote://section-id/page-id
  const match = href.match(/^powernote:\/\/([^/]+)\/(.+)$/);
  if (!match) return;
  const [, sectionId, pageId] = match;
  const ws = useWorkspaceStore.getState();
  const canvas = useCanvasStore.getState();

  // Save current page nodes + strokes before navigating
  ws.savePageNodes(canvas.nodes);
  ws.savePageStrokes(useDrawStore.getState().strokes);
  ws.setActivePage(sectionId, pageId);

  const section = ws.workspace.sections.find((s) => s.id === sectionId);
  const page = section?.pages.find((p) => p.id === pageId);
  canvas.loadPageNodes(page?.nodes ?? []);
  useDrawStore.getState().loadPageStrokes(page?.strokes ?? []);
}

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
  const [hovered, setHovered] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

  // Only allow drag/hover in interactive modes (not draw or lasso)
  const activeTool = useToolStore((s) => s.activeTool);
  const isInteractive = isNodeInteractive(activeTool);

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
    const tool = useToolStore.getState().activeTool;
    if (tool === 'select' || tool === 'text' || tool === 'image') {
      const additive = e.evt.ctrlKey || e.evt.metaKey;
      onSelect(node.id, additive);
    }
  };

  const handleDblClick = (e: Konva.KonvaEventObject<MouseEvent>) => {
    e.cancelBubble = true;
    const tool = useToolStore.getState().activeTool;
    if (tool === 'select' || tool === 'text' || tool === 'image') {
      onSelect(node.id, false);
      setIsEditing(true);
    }
  };

  const handleFinishEdit = (newText: string) => {
    setIsEditing(false);
    updateNode(node.id, {
      data: { ...data, text: newText },
    });
    undoBatchEnd(); // End batch started on text placement (if any)
  };

  const handleCancelEdit = () => {
    undoBatchEnd(); // End batch even on cancel
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
      draggable={isInteractive}
      listening={isInteractive}
      onDragMove={handleDragMove}
      onDragEnd={handleDragEnd}
      onMouseDown={handleMouseDown}
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
      {/* Invisible hit area for click/dblclick — sized generously to catch clicks */}
      <Rect
        id={node.id}
        x={-4}
        y={-4}
        width={Math.max(node.width, 120) + 8}
        height={Math.max(node.height || 30, 24) + 8}
        fill="transparent"
        onClick={handleClick}
        onTap={handleClick}
        onDblClick={handleDblClick}
        onDblTap={handleDblClick}
      />

      {/* Markdown-rendered HTML overlay — selection highlight applied via CSS */}
      <Html
        groupProps={{ x: 0, y: 0 }}
        divProps={{
          style: { pointerEvents: 'none' },
          className: 'powernote-html-overlay',
        }}
      >
        <div
          ref={htmlRef}
          className={`powernote-markdown ${isSelected ? 'powernote-markdown--selected' : ''} ${hovered && !isSelected ? 'powernote-markdown--hovered' : ''}`}
          onClick={(e) => {
            const target = e.target as HTMLElement;
            // Handle checkbox clicks
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
            // Handle link clicks
            if (target.tagName === 'A') {
              e.stopPropagation();
              e.preventDefault();
              const href = target.getAttribute('href') || '';
              if (href.startsWith('powernote://')) {
                handleInternalLink(href);
              } else if (href.startsWith('http://') || href.startsWith('https://')) {
                window.open(href, '_blank', 'noopener');
              }
            }
          }}
          onContextMenu={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setContextMenu({ x: e.clientX, y: e.clientY });
          }}
          style={{
            minWidth: 60,
            maxWidth: 800,
            width: 'max-content',
            fontSize: data.fontSize,
            fontFamily: data.fontFamily,
            fontWeight: data.fontStyle?.includes('bold') ? 'bold' : 'normal',
            fontStyle: data.fontStyle?.includes('italic') ? 'italic' : 'normal',
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
        {/* Context menu for inserting links */}
        {contextMenu && (
          <LinkContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            onInsertLink={(sectionId, pageId, pageTitle) => {
              const link = `[${pageTitle}](powernote://${sectionId}/${pageId})`;
              updateNode(node.id, {
                data: { ...data, text: data.text + '\n' + link },
              });
              setContextMenu(null);
            }}
            onClose={() => setContextMenu(null)}
          />
        )}
      </Html>
    </Group>
  );
}

function LinkContextMenu({
  x,
  y,
  onInsertLink,
  onClose,
}: {
  x: number;
  y: number;
  onInsertLink: (sectionId: string, pageId: string, pageTitle: string) => void;
  onClose: () => void;
}) {
  const workspace = useWorkspaceStore((s) => s.workspace);
  const [showPages, setShowPages] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  return (
    <div
      ref={menuRef}
      data-testid="link-context-menu"
      style={{
        position: 'fixed',
        left: x,
        top: y,
        background: '#fff',
        border: '1px solid #ddd',
        borderRadius: 6,
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        zIndex: 9999,
        minWidth: 180,
        padding: '4px 0',
        fontSize: 13,
        pointerEvents: 'auto',
      }}
    >
      {!showPages ? (
        <div
          style={{ padding: '6px 12px', cursor: 'pointer' }}
          onClick={() => setShowPages(true)}
          onMouseOver={(e) => ((e.target as HTMLElement).style.background = '#f0f0f0')}
          onMouseOut={(e) => ((e.target as HTMLElement).style.background = 'transparent')}
        >
          Insert Link to Page...
        </div>
      ) : (
        <div style={{ maxHeight: 200, overflowY: 'auto' }}>
          {workspace.sections.map((section) =>
            section.pages.map((page) => (
              <div
                key={page.id}
                style={{ padding: '4px 12px', cursor: 'pointer' }}
                onClick={() => onInsertLink(section.id, page.id, page.title)}
                onMouseOver={(e) => ((e.target as HTMLElement).style.background = '#f0f0f0')}
                onMouseOut={(e) => ((e.target as HTMLElement).style.background = 'transparent')}
              >
                {section.title} / {page.title}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
