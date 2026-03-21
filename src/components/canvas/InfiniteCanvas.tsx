import { useRef, useState, useCallback, useEffect } from 'react';
import { Stage, Layer } from 'react-konva';
import type Konva from 'konva';
import { useCanvasStore } from '../../stores/useCanvasStore';
import { useToolStore } from '../../stores/useToolStore';
import { CanvasNode } from './CanvasNode';
import { SelectionTransformer } from './SelectionTransformer';
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

  const nodes = useCanvasStore((s) => s.nodes);
  const selectedNodeId = useCanvasStore((s) => s.selectedNodeId);
  const setSelectedNodeId = useCanvasStore((s) => s.setSelectedNodeId);
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
      // Only handle clicks on the stage background (not on shapes)
      if (e.target !== stageRef.current) return;

      if (activeTool === 'text') {
        const stage = stageRef.current;
        if (!stage) return;

        const pointer = stage.getPointerPosition();
        if (!pointer) return;

        // Convert screen coords to stage coords (accounting for pan/zoom)
        const scale = stage.scaleX();
        const stageX = (pointer.x - stage.x()) / scale;
        const stageY = (pointer.y - stage.y()) / scale;

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
            width: 200,
          },
        };

        addNode(newNode);
        setSelectedNodeId(newNode.id);
        autoEditNodeId = newNode.id;
      } else {
        // Deselect on background click
        setSelectedNodeId(null);
      }
    },
    [activeTool, textOptions, addNode, setSelectedNodeId],
  );

  // ── Keyboard shortcuts ──────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't capture when typing in an input/textarea
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedNodeId) {
          e.preventDefault();
          useCanvasStore.getState().deleteNode(selectedNodeId);
        }
      }

      if (e.key === 'Escape') {
        setSelectedNodeId(null);
      }

      if (e.key === 't' || e.key === 'T') {
        const toolStore = useToolStore.getState();
        toolStore.setTool(toolStore.activeTool === 'text' ? 'select' : 'text');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedNodeId, setSelectedNodeId]);

  // Cursor style based on active tool
  const cursorClass =
    activeTool === 'text' ? 'infinite-canvas--crosshair' : '';

  // Get current stage scale for text editor positioning
  const currentScale = stageRef.current?.scaleX() ?? 1;

  return (
    <div ref={containerRef} className={`infinite-canvas ${cursorClass}`}>
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
                autoEditNodeId = null; // consume once
              }
              return (
                <CanvasNode
                  key={node.id}
                  node={node}
                  isSelected={selectedNodeId === node.id}
                  onSelect={setSelectedNodeId}
                  stageScale={currentScale}
                  autoEdit={isAutoEdit}
                />
              );
            })}
            <SelectionTransformer
              selectedNodeId={selectedNodeId}
              stageRef={stageRef}
            />
          </Layer>
        </Stage>
      )}
    </div>
  );
}
