import { useRef, useState, useCallback, useEffect } from 'react';
import { Stage, Layer } from 'react-konva';
import type Konva from 'konva';
import { useCanvasStore, undoBatchStart } from '../../stores/useCanvasStore';
import { useToolStore } from '../../stores/useToolStore';
import { useDrawStore } from '../../stores/useDrawStore';
import { CanvasNode } from './CanvasNode';
import { SnapGuides, type SnapLine } from './SnapGuides';
import { PageGuides, type BackgroundMode } from './PageGuides';
import { DrawingLayer } from './DrawingLayer';
import { TrashButton } from './TrashButton';
import { generateId } from '../../utils/ids';
import type { CanvasNode as CanvasNodeType, ImageNodeData } from '../../types/data';
import './InfiniteCanvas.css';

// Track the most recently placed node so it auto-enters edit mode
let autoEditNodeId: string | null = null;

/** Read a File (image) as a base64 data URI, then add it to the canvas */
function addImageFromFile(file: File, x: number, y: number) {
  if (!file.type.startsWith('image/')) return;
  const reader = new FileReader();
  reader.onload = () => {
    const src = reader.result as string;
    const img = new Image();
    img.onload = () => {
      // Scale down if too large (max 600px wide)
      const maxW = 600;
      let w = img.naturalWidth;
      let h = img.naturalHeight;
      if (w > maxW) {
        h = h * (maxW / w);
        w = maxW;
      }
      const node: CanvasNodeType = {
        id: generateId(),
        type: 'image',
        x, y,
        width: w,
        height: h,
        data: {
          src,
          alt: file.name || 'image',
          naturalWidth: img.naturalWidth,
          naturalHeight: img.naturalHeight,
        } as ImageNodeData,
      };
      useCanvasStore.getState().addNode(node);
    };
    img.src = src;
  };
  reader.readAsDataURL(file);
}

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

  // Drawing state
  const [inProgressPoints, setInProgressPoints] = useState<number[] | null>(null);
  const [eraserPos, setEraserPos] = useState<{ x: number; y: number; radius: number } | null>(null);
  const [penCursorPos, setPenCursorPos] = useState<{ x: number; y: number } | null>(null);
  const [lassoRect, setLassoRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const isDrawing = useRef(false);
  const lassoStart = useRef<{ x: number; y: number } | null>(null);
  const eraserState = useRef({ prevDir: null as { x: number; y: number } | null, shakeScore: 0, lastTime: 0 });

  const drawStrokes = useDrawStore((s) => s.strokes);
  const selectedStrokeIds = useDrawStore((s) => s.selectedStrokeIds);

  const nodes = useCanvasStore((s) => s.nodes);
  const selectedNodeIds = useCanvasStore((s) => s.selectedNodeIds);
  const selectNode = useCanvasStore((s) => s.selectNode);
  const clearSelection = useCanvasStore((s) => s.clearSelection);
  const addNode = useCanvasStore((s) => s.addNode);
  const setViewport = useCanvasStore((s) => s.setViewport);

  const activeTool = useToolStore((s) => s.activeTool);

  // Register stage ref for zoom-to-fit and external viewport control
  useEffect(() => {
    // Small delay to ensure Stage has mounted and ref is populated
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

  // ── Clipboard paste (Ctrl+V for images) ─────────────────
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of Array.from(items)) {
        if (item.type.startsWith('image/')) {
          e.preventDefault();
          const file = item.getAsFile();
          if (file) {
            // Place at center of visible canvas
            const stage = stageRef.current;
            const cx = stage ? (dimensions.width / 2 - stage.x()) / stage.scaleX() : 200;
            const cy = stage ? (dimensions.height / 2 - stage.y()) / stage.scaleY() : 200;
            addImageFromFile(file, cx, cy);
          }
          return;
        }
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [dimensions]);

  // ── Drag-drop files onto canvas ─────────────────────────
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
      e.dataTransfer!.dropEffect = 'copy';
    };

    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      const files = e.dataTransfer?.files;
      if (!files) return;

      const stage = stageRef.current;
      const rect = container.getBoundingClientRect();

      for (const file of Array.from(files)) {
        if (file.type.startsWith('image/')) {
          // Convert drop position to canvas coordinates
          const dropX = stage
            ? (e.clientX - rect.left - stage.x()) / stage.scaleX()
            : e.clientX - rect.left;
          const dropY = stage
            ? (e.clientY - rect.top - stage.y()) / stage.scaleY()
            : e.clientY - rect.top;
          addImageFromFile(file, dropX, dropY);
        }
      }
    };

    container.addEventListener('dragover', handleDragOver);
    container.addEventListener('drop', handleDrop);
    return () => {
      container.removeEventListener('dragover', handleDragOver);
      container.removeEventListener('drop', handleDrop);
    };
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

  // ── Pinch-to-zoom (touch) ─────────────────────────────────
  const lastPinchDist = useRef<number | null>(null);
  const lastPinchCenter = useRef<{ x: number; y: number } | null>(null);
  const isPinching = useRef(false);

  // Detect multi-touch start to disable Stage dragging during pinch
  const handleTouchStart = useCallback(
    (e: Konva.KonvaEventObject<TouchEvent>) => {
      if (e.evt.touches.length >= 2) {
        isPinching.current = true;
        // Stop Konva's built-in drag so it doesn't conflict with pinch
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

  // ── Stage click (place text or deselect) ──────────────────
  const handleStageClick = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      if (e.target !== stageRef.current) return;

      const stage = stageRef.current;
      if (!stage) return;

      // Read tool state fresh (not from stale closure) to prevent accidental placement
      const currentTool = useToolStore.getState().activeTool;
      const currentTextOptions = useToolStore.getState().textOptions;

      if (currentTool === 'text') {
        const pointer = stage.getPointerPosition();
        if (!pointer) return;

        const scale = stage.scaleX();
        const stageX = (pointer.x - stage.x()) / scale;
        const stageY = (pointer.y - stage.y()) / scale;

        const newNode: CanvasNodeType = {
          id: generateId(),
          type: 'text',
          x: stageX,
          y: stageY,
          width: 120,
          height: 30,
          data: {
            text: '',
            fontSize: currentTextOptions.fontSize,
            fontFamily: currentTextOptions.fontFamily,
            fontStyle: currentTextOptions.fontStyle,
            fill: currentTextOptions.fill,
          },
        };

        // Batch: addNode + first updateNode (blur commit) = single undo entry
        undoBatchStart(useCanvasStore.getState().nodes);
        useToolStore.getState().setTool('select');
        addNode(newNode);
        selectNode(newNode.id, false);
        autoEditNodeId = newNode.id;
      } else {
        clearSelection();
      }
    },
    [addNode, selectNode, clearSelection],
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

      // D: toggle draw tool
      if (e.key === 'd' || e.key === 'D') {
        const toolStore = useToolStore.getState();
        toolStore.setTool(toolStore.activeTool === 'draw' ? 'select' : 'draw');
      }

      // E: toggle eraser
      if (e.key === 'e' || e.key === 'E') {
        const toolStore = useToolStore.getState();
        toolStore.setTool(toolStore.activeTool === 'erase' ? 'select' : 'erase');
      }

      // L: toggle lasso
      if (e.key === 'l' || e.key === 'L') {
        const toolStore = useToolStore.getState();
        toolStore.setTool(toolStore.activeTool === 'lasso' ? 'select' : 'lasso');
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
        useCanvasStore.setState({ selectedNodeIds: allIds });
      }

      // Ctrl+Z: undo (route to draw store if drawing tools active)
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        const tool = useToolStore.getState().activeTool;
        if (tool === 'draw' || tool === 'erase' || tool === 'lasso') {
          useDrawStore.getState().undo();
        } else {
          useCanvasStore.getState().undo();
        }
      }

      // Ctrl+Shift+Z / Ctrl+Y: redo
      if ((e.ctrlKey || e.metaKey) && ((e.key === 'z' && e.shiftKey) || e.key === 'y')) {
        e.preventDefault();
        const tool = useToolStore.getState().activeTool;
        if (tool === 'draw' || tool === 'erase' || tool === 'lasso') {
          useDrawStore.getState().redo();
        } else {
          useCanvasStore.getState().redo();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [clearSelection]);

  // ── Drawing tool event handlers ──────────────────────────
  const isDrawTool = activeTool === 'draw' || activeTool === 'erase' || activeTool === 'lasso';

  const getCanvasPoint = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
    const stage = stageRef.current;
    if (!stage) return { x: 0, y: 0 };
    const pos = stage.getPointerPosition();
    if (!pos) return { x: 0, y: 0 };
    return {
      x: (pos.x - stage.x()) / stage.scaleX(),
      y: (pos.y - stage.y()) / stage.scaleY(),
    };
  }, []);

  const handleDrawMouseDown = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
    if (e.target !== stageRef.current) return;
    const tool = useToolStore.getState().activeTool;
    const pt = getCanvasPoint(e);

    if (tool === 'draw') {
      isDrawing.current = true;
      setInProgressPoints([pt.x, pt.y]);
    } else if (tool === 'erase') {
      isDrawing.current = true;
      eraserState.current = { prevDir: null, shakeScore: 0, lastTime: Date.now() };
      // Erase at initial position
      const radius = 8;
      setEraserPos({ ...pt, radius });
      eraseAt(pt.x, pt.y, radius);
    } else if (tool === 'lasso') {
      lassoStart.current = pt;
      setLassoRect({ x: pt.x, y: pt.y, w: 0, h: 0 });
    }
  }, [getCanvasPoint]);

  const handleDrawMouseMove = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
    const tool = useToolStore.getState().activeTool;
    const pt = getCanvasPoint(e);

    // Always track pen cursor when draw tool is active
    if (tool === 'draw') {
      setPenCursorPos({ x: pt.x, y: pt.y });
    } else {
      setPenCursorPos(null);
    }

    if (tool === 'draw' && isDrawing.current) {
      setInProgressPoints((prev) => prev ? [...prev, pt.x, pt.y] : null);
    } else if (tool === 'erase' && isDrawing.current) {
      // Shake detection
      const now = Date.now();
      const es = eraserState.current;
      const dx = pt.x - (eraserPos?.x ?? pt.x);
      const dy = pt.y - (eraserPos?.y ?? pt.y);
      const dt = now - es.lastTime;

      es.shakeScore *= Math.exp(-dt / 200);
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len > 2 && es.prevDir) {
        const nx = dx / len, ny = dy / len;
        const dot = nx * es.prevDir.x + ny * es.prevDir.y;
        if (dot < 0) es.shakeScore += Math.abs(dot) * 2;
      }
      if (len > 2) es.prevDir = { x: dx / len, y: dy / len };
      es.lastTime = now;

      const radius = Math.min(50, 5 + es.shakeScore * 10);
      setEraserPos({ x: pt.x, y: pt.y, radius });
      eraseAt(pt.x, pt.y, radius);
    } else if (tool === 'erase' && !isDrawing.current) {
      // Show eraser cursor even when not pressing
      setEraserPos({ x: pt.x, y: pt.y, radius: 8 });
    } else if (tool === 'lasso' && lassoStart.current) {
      const start = lassoStart.current;
      setLassoRect({
        x: Math.min(start.x, pt.x),
        y: Math.min(start.y, pt.y),
        w: Math.abs(pt.x - start.x),
        h: Math.abs(pt.y - start.y),
      });
    }
  }, [getCanvasPoint, eraserPos]);

  const handleDrawMouseUp = useCallback(() => {
    const tool = useToolStore.getState().activeTool;

    if (tool === 'draw' && isDrawing.current && inProgressPoints && inProgressPoints.length >= 4) {
      const drawOpts = useToolStore.getState().drawOptions;
      useDrawStore.getState().addStroke({
        id: generateId(),
        points: inProgressPoints,
        color: drawOpts.color,
        strokeWidth: drawOpts.strokeWidth,
      });
    } else if (tool === 'lasso' && lassoRect && lassoRect.w > 5 && lassoRect.h > 5) {
      // Find strokes within lasso rect
      const rect = lassoRect;
      const allStrokes = useDrawStore.getState().strokes;
      const selected = allStrokes.filter((s) => {
        for (let i = 0; i < s.points.length; i += 2) {
          if (s.points[i] >= rect.x && s.points[i] <= rect.x + rect.w &&
              s.points[i + 1] >= rect.y && s.points[i + 1] <= rect.y + rect.h) {
            return true;
          }
        }
        return false;
      });
      useDrawStore.getState().selectStrokes(selected.map((s) => s.id));
    }

    isDrawing.current = false;
    setInProgressPoints(null);
    lassoStart.current = null;
    setLassoRect(null);
    if (tool !== 'erase') setEraserPos(null);
  }, [inProgressPoints, lassoRect]);

  function eraseAt(x: number, y: number, radius: number) {
    const strokes = useDrawStore.getState().strokes;
    const toDelete: string[] = [];
    for (const stroke of strokes) {
      for (let i = 0; i < stroke.points.length; i += 2) {
        const dx = stroke.points[i] - x;
        const dy = stroke.points[i + 1] - y;
        if (dx * dx + dy * dy < radius * radius) {
          toDelete.push(stroke.id);
          break;
        }
      }
    }
    if (toDelete.length > 0) {
      useDrawStore.getState().deleteStrokes(toDelete);
    }
  }

  // Cursor style based on active tool
  const cursorClass =
    activeTool === 'text' ? 'infinite-canvas--crosshair'
    : activeTool === 'draw' ? 'infinite-canvas--none'
    : activeTool === 'erase' ? 'infinite-canvas--none'
    : activeTool === 'lasso' ? 'infinite-canvas--crosshair'
    : '';

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
          onClick={handleStageClick}
          onTap={handleStageClick}
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
