import { useRef, useState, useCallback, useEffect } from 'react';
import { Stage, Layer, Rect as KonvaRect, Ellipse, Line as KonvaLine } from 'react-konva';
import type Konva from 'konva';
import { useCanvasStore } from '../../stores/useCanvasStore';
import { useToolStore } from '../../stores/useToolStore';
import { getToolConfig } from '../../utils/toolConfig';
import { useDrawStore } from '../../stores/useDrawStore';
import { CanvasNode } from './CanvasNode';
import { SelectionTransformer } from './SelectionTransformer';
import { ContextMenu } from './ContextMenu';
import { SnapGuides, type SnapLine } from './SnapGuides';
import { PageGuides, type BackgroundMode } from './PageGuides';
import { DrawingLayer } from './DrawingLayer';
import { TrashButton } from './TrashButton';
import { useShapeCreation } from '../../hooks/useShapeCreation';
import { useTextPlacement, consumeAutoEditNodeId } from '../../hooks/useTextPlacement';
import { useCanvasKeyboard } from '../../hooks/useCanvasKeyboard';
import { useContextMenu } from '../../hooks/useContextMenu';
import { useCanvasDragDrop } from '../../hooks/useCanvasDragDrop';
import './InfiniteCanvas.css';

const MIN_SCALE = 0.1;
const MAX_SCALE = 5.0;
const ZOOM_FACTOR = 1.05;

export type CanvasBgColor = '#ffffff' | '#f5f5f5' | '#e5e5e5' | 'paper';

interface InfiniteCanvasProps {
  backgroundMode?: BackgroundMode;
  bgColor?: CanvasBgColor;
}

export function InfiniteCanvas({ backgroundMode = 'pages', bgColor = '#ffffff' }: InfiniteCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);

  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [snapLines, setSnapLines] = useState<SnapLine[]>([]);

  const drawStrokes = useDrawStore((s) => s.strokes);
  const selectedStrokeIds = useDrawStore((s) => s.selectedStrokeIds);

  const nodes = useCanvasStore((s) => s.nodes);
  const selectedNodeIds = useCanvasStore((s) => s.selectedNodeIds);
  const selectNode = useCanvasStore((s) => s.selectNode);
  const clearSelection = useCanvasStore((s) => s.clearSelection);
  const addNode = useCanvasStore((s) => s.addNode);
  const setViewport = useCanvasStore((s) => s.setViewport);

  const activeTool = useToolStore((s) => s.activeTool);

  // ── Extracted hooks ─────────────────────────────────────────
  const {
    inProgressPoints,
    eraserPos,
    penCursorPos,
    lassoRect,
    shapePreview,
    handleDrawMouseDown,
    handleDrawMouseMove,
    handleDrawMouseUp,
  } = useShapeCreation(stageRef);

  const { handleStageClick } = useTextPlacement(stageRef, addNode, selectNode, clearSelection);

  useCanvasKeyboard(clearSelection);

  const { contextMenu, handleContextMenu, closeContextMenu } = useContextMenu(stageRef);

  useCanvasDragDrop(containerRef, stageRef, dimensions);

  // ── Register stage ref for zoom-to-fit ──────────────────────
  useEffect(() => {
    const timer = setTimeout(() => {
      if (stageRef.current) {
        useCanvasStore.getState().setStageRef(stageRef.current);
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [dimensions]);

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

  // ── Wheel: scroll (pan) + Ctrl+wheel (zoom) ─────────────
  const handleWheel = useCallback(
    (e: Konva.KonvaEventObject<WheelEvent>) => {
      e.evt.preventDefault();
      const stage = stageRef.current;
      if (!stage) return;

      // Ctrl/Meta + wheel = zoom
      if (e.evt.ctrlKey || e.evt.metaKey) {
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
        return;
      }

      // Shift + scroll = horizontal pan
      // Normal scroll = vertical pan
      // Two-finger swipe on trackpad sends deltaX/deltaY directly
      const dx = e.evt.shiftKey ? -e.evt.deltaY : -e.evt.deltaX;
      const dy = e.evt.shiftKey ? 0 : -e.evt.deltaY;

      const newPos = {
        x: stage.x() + dx,
        y: stage.y() + dy,
      };

      stage.position(newPos);
      setViewport({ x: newPos.x, y: newPos.y });
    },
    [setViewport],
  );

  // ── Pinch-to-zoom (touch) ─────────────────────────────────
  const lastPinchDist = useRef<number | null>(null);
  const lastPinchCenter = useRef<{ x: number; y: number } | null>(null);
  const isPinching = useRef(false);

  const handleTouchStart = useCallback(
    (e: Konva.KonvaEventObject<TouchEvent>) => {
      if (e.evt.touches.length >= 2) {
        isPinching.current = true;
        stageRef.current?.stopDrag();
      }
    },
    [],
  );

  const handleTouchMove = useCallback(
    (e: Konva.KonvaEventObject<TouchEvent>) => {
      const touches = e.evt.touches;
      if (touches.length !== 2) {
        lastPinchDist.current = null;
        lastPinchCenter.current = null;
        return;
      }

      e.evt.preventDefault();
      isPinching.current = true;
      const stage = stageRef.current;
      if (!stage) return;

      const t1 = { x: touches[0].clientX, y: touches[0].clientY };
      const t2 = { x: touches[1].clientX, y: touches[1].clientY };
      const dist = Math.sqrt((t2.x - t1.x) ** 2 + (t2.y - t1.y) ** 2);
      const center = { x: (t1.x + t2.x) / 2, y: (t1.y + t2.y) / 2 };

      if (lastPinchDist.current === null) {
        lastPinchDist.current = dist;
        lastPinchCenter.current = center;
        return;
      }

      const oldScale = stage.scaleX();
      const scaleFactor = dist / lastPinchDist.current;
      const newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, oldScale * scaleFactor));

      const stageBox = stage.container().getBoundingClientRect();
      const pointerOnStage = {
        x: center.x - stageBox.left,
        y: center.y - stageBox.top,
      };

      const mousePointTo = {
        x: (pointerOnStage.x - stage.x()) / oldScale,
        y: (pointerOnStage.y - stage.y()) / oldScale,
      };

      const newPos = {
        x: pointerOnStage.x - mousePointTo.x * newScale,
        y: pointerOnStage.y - mousePointTo.y * newScale,
      };

      stage.scale({ x: newScale, y: newScale });
      stage.position(newPos);

      setViewport({ x: newPos.x, y: newPos.y, scale: newScale });

      lastPinchDist.current = dist;
      lastPinchCenter.current = center;
    },
    [setViewport],
  );

  const handleTouchEnd = useCallback(() => {
    lastPinchDist.current = null;
    lastPinchCenter.current = null;
    isPinching.current = false;
  }, []);

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

  // ── Node selection handler (passed to CanvasNode) ─────────
  const handleNodeSelect = useCallback(
    (id: string, additive: boolean) => {
      selectNode(id, additive);
    },
    [selectNode],
  );

  // ── Tool config ────────────────────────────────
  const toolConfig = getToolConfig(activeTool);
  const isDrawTool = !toolConfig.allowNodeSelection || activeTool === 'shape';
  const cursorClass = toolConfig.cursorClass;

  // Get current stage scale for text editor positioning
  const currentScale = stageRef.current?.scaleX() ?? 1;

  return (
    <div
      ref={containerRef}
      className={`infinite-canvas ${cursorClass} ${bgColor === 'paper' ? 'infinite-canvas--paper' : ''}`}
      style={{ backgroundColor: bgColor === 'paper' ? '#f5f0e8' : bgColor }}
      data-testid="canvas-container"
    >
      {dimensions.width > 0 && dimensions.height > 0 && (
        <Stage
          ref={stageRef}
          width={dimensions.width}
          height={dimensions.height}
          draggable={!isDrawTool}
          onWheel={handleWheel}
          onDragEnd={handleDragEnd}
          onClick={(e) => { closeContextMenu(); handleStageClick(e); }}
          onTap={handleStageClick}
          onContextMenu={handleContextMenu}
          onMouseDown={isDrawTool ? handleDrawMouseDown : undefined}
          onMouseMove={isDrawTool ? handleDrawMouseMove : undefined}
          onMouseUp={isDrawTool ? handleDrawMouseUp : undefined}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <Layer>
            <PageGuides mode={backgroundMode} nodes={nodes} />
          </Layer>
          <Layer listening={false}>
            <DrawingLayer
              strokes={drawStrokes}
              selectedStrokeIds={selectedStrokeIds}
              inProgressPoints={inProgressPoints}
              inProgressColor={useToolStore.getState().drawOptions?.color ?? '#1a1a1a'}
              inProgressWidth={useToolStore.getState().drawOptions?.strokeWidth ?? 3}
              eraserPos={eraserPos}
              penCursorPos={penCursorPos}
              penColor={useToolStore.getState().drawOptions?.color ?? '#1a1a1a'}
              penWidth={useToolStore.getState().drawOptions?.strokeWidth ?? 3}
              lassoRect={lassoRect}
            />
          </Layer>
          <Layer>
            {/* Shape preview ghost while dragging — uses same coordinate system as ShapeNode */}
            {shapePreview && (Math.abs(shapePreview.w) > 2 || Math.abs(shapePreview.h) > 2) && (() => {
              const opts = useToolStore.getState().shapeOptions;
              const sp = shapePreview;
              const commonProps = {
                stroke: opts.stroke,
                strokeWidth: opts.strokeWidth,
                dash: opts.strokeDash.length > 0 ? opts.strokeDash : undefined,
                fill: opts.fill === 'transparent' ? 'rgba(37,99,235,0.05)' : opts.fill,
                opacity: 0.6,
                listening: false as const,
              };
              // Render at (sp.x, sp.y) with children at (0,0) — same as ShapeNode's Group pattern
              if (opts.shapeType === 'rect') return <KonvaRect x={sp.x} y={sp.y} width={sp.w} height={sp.h} {...commonProps} />;
              if (opts.shapeType === 'circle') return <Ellipse x={sp.x + sp.w / 2} y={sp.y + sp.h / 2} radiusX={Math.abs(sp.w) / 2} radiusY={Math.abs(sp.h) / 2} {...commonProps} />;
              if (opts.shapeType === 'triangle') return <KonvaLine points={[sp.x + sp.w / 2, sp.y, sp.x + sp.w, sp.y + sp.h, sp.x, sp.y + sp.h]} closed {...commonProps} />;
              // Arrow/line: start at (sp.x, sp.y), end at (sp.x+sp.w, sp.y+sp.h) — matches ShapeNode's [0,0,w,h] offset by Group position
              if (opts.shapeType === 'arrow') return <KonvaLine points={[sp.x, sp.y, sp.x + sp.w, sp.y + sp.h]} stroke={opts.stroke} strokeWidth={opts.strokeWidth} opacity={0.6} listening={false} />;
              if (opts.shapeType === 'line') return <KonvaLine points={[sp.x, sp.y, sp.x + sp.w, sp.y + sp.h]} stroke={opts.stroke} strokeWidth={opts.strokeWidth} lineCap="round" opacity={0.6} listening={false} />;
              return null;
            })()}

            {/* Sort nodes by layer for z-ordering */}
            {[...nodes].sort((a, b) => (a.layer ?? 3) - (b.layer ?? 3)).map((node) => {
              const isAutoEdit = consumeAutoEditNodeId(node.id);
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
            <SnapGuides lines={snapLines} />
            <SelectionTransformer selectedNodeIds={selectedNodeIds} stageRef={stageRef} />
          </Layer>
        </Stage>
      )}
      {/* Floating trash button for selected nodes */}
      {selectedNodeIds.length > 0 && (
        <TrashButton />
      )}
      {/* Right-click context menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          nodeId={contextMenu.nodeId}
          onClose={closeContextMenu}
        />
      )}
    </div>
  );
}
