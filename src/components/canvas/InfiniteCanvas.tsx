import { useRef, useState, useCallback, useEffect } from 'react';
import { Stage, Layer } from 'react-konva';
import type Konva from 'konva';
import { useCanvasStore } from '../../stores/useCanvasStore';
import { useToolStore } from '../../stores/useToolStore';
import { CanvasNode } from './CanvasNode';
import { SelectionTransformer } from './SelectionTransformer';
import { SnapGuides, type SnapLine } from './SnapGuides';
import { TrashButton } from './TrashButton';
import { generateId } from '../../utils/ids';
import type { CanvasNode as CanvasNodeType } from '../../types/data';
import './InfiniteCanvas.css';

// Track the most recently placed node so it auto-enters edit mode
let autoEditNodeId: string | null = null;

const MIN_SCALE = 0.1;
const MAX_SCALE = 5.0;
const ZOOM_FACTOR = 1.05;

export function InfiniteCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);

  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [snapLines, setSnapLines] = useState<SnapLine[]>([]);

  const nodes = useCanvasStore((s) => s.nodes);
  const selectedNodeIds = useCanvasStore((s) => s.selectedNodeIds);
  const selectNode = useCanvasStore((s) => s.selectNode);
  const clearSelection = useCanvasStore((s) => s.clearSelection);
  const addNode = useCanvasStore((s) => s.addNode);
  const setViewport = useCanvasStore((s) => s.setViewport);

  const activeTool = useToolStore((s) => s.activeTool);
  const textOptions = useToolStore((s) => s.textOptions);

  // ── Resize observer ────────────────────────────────────────
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setDimensions({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });

    observer.observe(container);
    setDimensions({
      width: container.clientWidth,
      height: container.clientHeight,
    });

    return () => observer.disconnect();
  }, []);

  // ── Zoom (Ctrl + wheel) ───────────────────────────────────
  const handleWheel = useCallback(
    (e: Konva.KonvaEventObject<WheelEvent>) => {
      e.evt.preventDefault();
      const stage = stageRef.current;
      if (!stage) return;

      if (!e.evt.ctrlKey && !e.evt.metaKey) return;

      const oldScale = stage.scaleX();
      const pointer = stage.getPointerPosition();
      if (!pointer) return;

      const mousePointTo = {
        x: (pointer.x - stage.x()) / oldScale,
        y: (pointer.y - stage.y()) / oldScale,
      };

      const direction = e.evt.deltaY > 0 ? -1 : 1;
      const newScale = Math.min(
        MAX_SCALE,
        Math.max(MIN_SCALE, oldScale * ZOOM_FACTOR ** direction),
      );

      const newPos = {
        x: pointer.x - mousePointTo.x * newScale,
        y: pointer.y - mousePointTo.y * newScale,
      };

      stage.scale({ x: newScale, y: newScale });
      stage.position(newPos);

      setViewport({ x: newPos.x, y: newPos.y, scale: newScale });
    },
    [setViewport],
  );

  // ── Drag end (pan) ────────────────────────────────────────
  const handleDragEnd = useCallback(
    (e: Konva.KonvaEventObject<DragEvent>) => {
      if (e.target !== stageRef.current) return;
      const stage = stageRef.current;
      if (!stage) return;
      setViewport({ x: stage.x(), y: stage.y() });
    },
    [setViewport],
  );

  // ── Stage click (place text or deselect) ──────────────────
  const handleStageClick = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      if (e.target !== stageRef.current) return;

      const stage = stageRef.current;
      if (!stage) return;

      const pointer = stage.getPointerPosition();
      if (!pointer) return;

      const scale = stage.scaleX();
      const stageX = (pointer.x - stage.x()) / scale;
      const stageY = (pointer.y - stage.y()) / scale;

      if (activeTool === 'text') {
        const newNode: CanvasNodeType = {
          id: generateId(),
          type: 'text',
          x: stageX,
          y: stageY,
          width: 200,
          height: 30,
          data: {
            text: '',
            fontSize: textOptions.fontSize,
            fontFamily: textOptions.fontFamily,
            fontStyle: textOptions.fontStyle,
            fill: textOptions.fill,
          },
        };

        addNode(newNode);
        selectNode(newNode.id, false);
        autoEditNodeId = newNode.id;
        // Revert to select tool after placing — one-shot behavior
        useToolStore.getState().setTool('select');
      } else {
        clearSelection();
      }
    },
    [activeTool, textOptions, addNode, selectNode, clearSelection],
  );

  // ── Node selection handler (passed to CanvasNode) ─────────
  const handleNodeSelect = useCallback(
    (id: string, additive: boolean) => {
      selectNode(id, additive);
    },
    [selectNode],
  );

  // ── Keyboard shortcuts ──────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      // Delete / Backspace: delete selected nodes
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const store = useCanvasStore.getState();
        if (store.selectedNodeIds.length > 0) {
          e.preventDefault();
          store.deleteSelectedNodes();
        }
      }

      // Escape: clear selection
      if (e.key === 'Escape') {
        clearSelection();
      }

      // T: toggle text tool
      if (e.key === 't' || e.key === 'T') {
        const toolStore = useToolStore.getState();
        toolStore.setTool(toolStore.activeTool === 'text' ? 'select' : 'text');
      }

      // Ctrl+C: copy
      if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        const store = useCanvasStore.getState();
        if (store.selectedNodeIds.length > 0) {
          e.preventDefault();
          store.copySelectedNodes();
        }
      }

      // Ctrl+V: paste
      if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        e.preventDefault();
        useCanvasStore.getState().pasteNodes();
      }

      // Ctrl+A: select all
      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        e.preventDefault();
        const store = useCanvasStore.getState();
        const allIds = store.nodes.map((n) => n.id);
        // Select all by setting selectedNodeIds directly
        useCanvasStore.setState({ selectedNodeIds: allIds });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [clearSelection]);

  // Cursor style based on active tool
  const cursorClass =
    activeTool === 'text' ? 'infinite-canvas--crosshair' : '';

  // Get current stage scale for text editor positioning
  const currentScale = stageRef.current?.scaleX() ?? 1;

  return (
    <div ref={containerRef} className={`infinite-canvas ${cursorClass}`} data-testid="canvas-container">
      {dimensions.width > 0 && dimensions.height > 0 && (
        <Stage
          ref={stageRef}
          width={dimensions.width}
          height={dimensions.height}
          draggable
          onWheel={handleWheel}
          onDragEnd={handleDragEnd}
          onClick={handleStageClick}
          onTap={handleStageClick}
        >
          <Layer>
            {nodes.map((node) => {
              const isAutoEdit = autoEditNodeId === node.id;
              if (isAutoEdit) {
                autoEditNodeId = null;
              }
              return (
                <CanvasNode
                  key={node.id}
                  node={node}
                  isSelected={selectedNodeIds.includes(node.id)}
                  onSelect={handleNodeSelect}
                  stageScale={currentScale}
                  autoEdit={isAutoEdit}
                  onSnapChange={setSnapLines}
                />
              );
            })}
            <SelectionTransformer
              selectedNodeIds={selectedNodeIds}
              stageRef={stageRef}
            />
            <SnapGuides lines={snapLines} />
          </Layer>
        </Stage>
      )}
      {/* Floating trash button for selected nodes */}
      {selectedNodeIds.length > 0 && (
        <TrashButton />
      )}
    </div>
  );
}
