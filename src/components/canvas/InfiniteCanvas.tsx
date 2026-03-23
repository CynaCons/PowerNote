import { useRef, useState, useCallback, useEffect } from 'react';
import { Stage, Layer, Rect as KonvaRect, Ellipse, Line as KonvaLine } from 'react-konva';
import type Konva from 'konva';
import { useCanvasStore, undoBatchStart } from '../../stores/useCanvasStore';
import { useToolStore } from '../../stores/useToolStore';
import { useDrawStore } from '../../stores/useDrawStore';
import { CanvasNode } from './CanvasNode';
import { ContextMenu } from './ContextMenu';
import { SnapGuides, type SnapLine } from './SnapGuides';
import { PageGuides, type BackgroundMode } from './PageGuides';
import { DrawingLayer } from './DrawingLayer';
import { TrashButton } from './TrashButton';
import { generateId } from '../../utils/ids';
import type { CanvasNode as CanvasNodeType, ImageNodeData, Stroke } from '../../types/data';
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

  // Shape creation state
  const [shapePreview, setShapePreview] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const shapeStart = useRef<{ x: number; y: number } | null>(null);

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; nodeId: string } | null>(null);

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
      // Allow clicks on the Stage itself AND on non-interactive background elements
      // (like PageGuide rects which have listening={false} or no node ID)
      const target = e.target;
      const isStage = target === stageRef.current;
      const isBackgroundElement = !isStage && !target.id();
      if (!isStage && !isBackgroundElement) return;

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

      // S: toggle shape tool
      if (e.key === 's' || e.key === 'S') {
        if (!e.ctrlKey && !e.metaKey) {
          const toolStore = useToolStore.getState();
          toolStore.setTool(toolStore.activeTool === 'shape' ? 'select' : 'shape');
        }
      }

      // E: toggle eraser mode in draw tool
      if (e.key === 'e' || e.key === 'E') {
        const toolStore = useToolStore.getState();
        if (toolStore.activeTool === 'draw') {
          toolStore.setDrawOptions({ isErasing: !toolStore.drawOptions.isErasing });
        } else {
          toolStore.setTool('draw');
          toolStore.setDrawOptions({ isErasing: true });
        }
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
        if (tool === 'draw' || tool === 'lasso') {
          useDrawStore.getState().undo();
        } else {
          useCanvasStore.getState().undo();
        }
      }

      // Ctrl+Shift+Z / Ctrl+Y: redo
      if ((e.ctrlKey || e.metaKey) && ((e.key === 'z' && e.shiftKey) || e.key === 'y')) {
        e.preventDefault();
        const tool = useToolStore.getState().activeTool;
        if (tool === 'draw' || tool === 'lasso') {
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
  const isDrawTool = activeTool === 'draw' || activeTool === 'lasso' || activeTool === 'shape';

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
    const tool = useToolStore.getState().activeTool;
    // For shape tool: allow clicks on background elements (PageGuides, Stage)
    // For draw/erase/lasso: only trigger on Stage itself
    if (tool !== 'shape' && e.target !== stageRef.current) return;
    // For shape tool: don't start if clicking on an interactive node
    if (tool === 'shape') {
      let target: Konva.Node | null = e.target;
      while (target && target !== stageRef.current) {
        const rect = target.findOne?.('Rect');
        if (rect?.id?.() && useCanvasStore.getState().nodes.find(n => n.id === rect.id())) {
          return; // Clicked on an existing node — don't start shape
        }
        target = target.parent;
      }
    }
    const pt = getCanvasPoint(e);

    if (tool === 'draw') {
      const drawOpts = useToolStore.getState().drawOptions;
      if (drawOpts.isErasing) {
        // Eraser mode
        isDrawing.current = true;
        if (drawOpts.eraserMode === 'stroke') {
          eraseStrokeAt(pt.x, pt.y);
          setEraserPos({ ...pt, radius: 8 });
        } else {
          eraserState.current = { prevDir: null, shakeScore: 0, lastTime: Date.now() };
          const radius = drawOpts.eraserSize / 2;
          setEraserPos({ ...pt, radius });
          eraseZoneAt(pt.x, pt.y, radius);
        }
      } else {
        // Pen mode
        isDrawing.current = true;
        setInProgressPoints([pt.x, pt.y]);
      }
    } else if (tool === 'shape') {
      shapeStart.current = pt;
      setShapePreview({ x: pt.x, y: pt.y, w: 0, h: 0 });
    } else if (tool === 'lasso') {
      lassoStart.current = pt;
      setLassoRect({ x: pt.x, y: pt.y, w: 0, h: 0 });
    }
  }, [getCanvasPoint]);

  const handleDrawMouseMove = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
    const tool = useToolStore.getState().activeTool;
    const pt = getCanvasPoint(e);

    // Track cursor for draw tool
    if (tool === 'draw') {
      const drawOpts = useToolStore.getState().drawOptions;
      if (drawOpts.isErasing) {
        // Eraser cursor
        setPenCursorPos(null);
        const radius = drawOpts.eraserMode === 'zone' ? drawOpts.eraserSize / 2 : 8;
        setEraserPos({ x: pt.x, y: pt.y, radius });

        if (isDrawing.current) {
          if (drawOpts.eraserMode === 'stroke') {
            eraseStrokeAt(pt.x, pt.y);
          } else {
            // Zone eraser — constant size from settings
            const r = drawOpts.eraserSize / 2;
            setEraserPos({ x: pt.x, y: pt.y, radius: r });
            eraseZoneAt(pt.x, pt.y, r);
          }
        }
      } else {
        // Pen cursor
        setPenCursorPos({ x: pt.x, y: pt.y });
        setEraserPos(null);

        if (isDrawing.current) {
          setInProgressPoints((prev) => prev ? [...prev, pt.x, pt.y] : null);
        }
      }
    } else {
      setPenCursorPos(null);
      setEraserPos(null);
    }

    if (tool === 'shape' && shapeStart.current) {
      const start = shapeStart.current;
      const shapeType = useToolStore.getState().shapeOptions.shapeType;
      let w = pt.x - start.x;
      let h = pt.y - start.y;
      // Shift constrains to square/circle
      if (e.evt.shiftKey && shapeType !== 'arrow' && shapeType !== 'line') {
        const size = Math.max(Math.abs(w), Math.abs(h));
        w = Math.sign(w || 1) * size;
        h = Math.sign(h || 1) * size;
      }
      if (shapeType === 'arrow' || shapeType === 'line') {
        // Arrows/lines: store start point and signed delta
        setShapePreview({ x: start.x, y: start.y, w, h });
      } else {
        // Other shapes: normalize to positive width/height with top-left origin
        setShapePreview({
          x: w >= 0 ? start.x : start.x + w,
          y: h >= 0 ? start.y : start.y + h,
          w: Math.abs(w),
          h: Math.abs(h),
        });
      }
    }

    if (tool === 'lasso' && lassoStart.current) {
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

    const drawOpts = useToolStore.getState().drawOptions;
    if (tool === 'draw' && !drawOpts.isErasing && isDrawing.current && inProgressPoints && inProgressPoints.length >= 4) {
      useDrawStore.getState().addStroke({
        id: generateId(),
        points: inProgressPoints,
        color: drawOpts.color,
        strokeWidth: drawOpts.strokeWidth,
      });
    } else if (tool === 'shape' && shapePreview) {
      // Commit shape node — different min size for shapes vs arrows/lines
      const shapeOpts = useToolStore.getState().shapeOptions;
      const isLine = shapeOpts.shapeType === 'arrow' || shapeOpts.shapeType === 'line';
      const dragDist = Math.sqrt(shapePreview.w * shapePreview.w + shapePreview.h * shapePreview.h);
      const minSize = isLine ? 5 : (Math.abs(shapePreview.w) > 5 && Math.abs(shapePreview.h) > 5);

      if (isLine ? dragDist > 5 : minSize) {
        useCanvasStore.getState().addNode({
          id: generateId(),
          type: 'shape',
          x: shapePreview.x,
          y: shapePreview.y,
          width: shapePreview.w,
          height: shapePreview.h,
          layer: 3,
          data: {
            shapeType: shapeOpts.shapeType,
            fill: shapeOpts.fill,
            stroke: shapeOpts.stroke,
            strokeWidth: shapeOpts.strokeWidth,
            strokeDash: [...shapeOpts.strokeDash],
          },
        });
      }
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
    shapeStart.current = null;
    setShapePreview(null);
    lassoStart.current = null;
    setLassoRect(null);
    const opts = useToolStore.getState().drawOptions;
    if (!(tool === 'draw' && opts.isErasing)) setEraserPos(null);
  }, [inProgressPoints, lassoRect]);

  // Stroke eraser: deletes entire stroke if any point is within touch radius
  function eraseStrokeAt(x: number, y: number) {
    const strokes = useDrawStore.getState().strokes;
    const touchRadius = 12; // fixed detection radius for stroke mode
    const toDelete: string[] = [];
    for (const stroke of strokes) {
      for (let i = 0; i < stroke.points.length; i += 2) {
        const dx = stroke.points[i] - x;
        const dy = stroke.points[i + 1] - y;
        if (dx * dx + dy * dy < touchRadius * touchRadius) {
          toDelete.push(stroke.id);
          break;
        }
      }
    }
    if (toDelete.length > 0) {
      useDrawStore.getState().deleteStrokes(toDelete);
    }
  }

  /**
   * Zone eraser: precise pixel-level erasing using circle-segment intersection.
   * Only the visual pixels under the eraser circle are removed.
   * Strokes are split at exact intersection points with the eraser boundary.
   */
  function eraseZoneAt(ex: number, ey: number, radius: number) {
    const store = useDrawStore.getState();
    const strokes = store.strokes;
    const r2 = radius * radius;
    const toDelete: string[] = [];
    const toAdd: Stroke[] = [];

    // Lerp helper
    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

    // Find t values where segment P1→P2 intersects circle (ex,ey,r)
    // Returns sorted t values in [0,1] where the segment crosses the boundary
    function circleSegmentIntersections(
      x1: number, y1: number, x2: number, y2: number,
    ): number[] {
      const dx = x2 - x1, dy = y2 - y1;
      const fx = x1 - ex, fy = y1 - ey;
      const a = dx * dx + dy * dy;
      if (a < 1e-10) return []; // degenerate segment
      const b = 2 * (fx * dx + fy * dy);
      const c = fx * fx + fy * fy - r2;
      const disc = b * b - 4 * a * c;
      if (disc < 0) return [];
      const sqrtDisc = Math.sqrt(disc);
      const t1 = (-b - sqrtDisc) / (2 * a);
      const t2 = (-b + sqrtDisc) / (2 * a);
      const results: number[] = [];
      if (t1 > 1e-6 && t1 < 1 - 1e-6) results.push(t1);
      if (t2 > 1e-6 && t2 < 1 - 1e-6) results.push(t2);
      return results.sort((a, b) => a - b);
    }

    // Is a point inside the eraser circle?
    function isInside(px: number, py: number) {
      const dx = px - ex, dy = py - ey;
      return dx * dx + dy * dy <= r2;
    }

    for (const stroke of strokes) {
      const pts = stroke.points;
      if (pts.length < 4) continue;

      // Quick bounding-box reject: skip strokes far from eraser
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      for (let i = 0; i < pts.length; i += 2) {
        if (pts[i] < minX) minX = pts[i];
        if (pts[i] > maxX) maxX = pts[i];
        if (pts[i + 1] < minY) minY = pts[i + 1];
        if (pts[i + 1] > maxY) maxY = pts[i + 1];
      }
      if (ex + radius < minX || ex - radius > maxX ||
          ey + radius < minY || ey - radius > maxY) continue;

      // Walk through segments, building "outside" runs
      // For each segment P1→P2, classify the segment parts as inside/outside
      const outsideRuns: number[][] = [];
      let currentRun: number[] = [];
      let modified = false;

      for (let i = 0; i < pts.length - 2; i += 2) {
        const x1 = pts[i], y1 = pts[i + 1];
        const x2 = pts[i + 2], y2 = pts[i + 3];
        const p1in = isInside(x1, y1);
        const p2in = isInside(x2, y2);

        const crossings = circleSegmentIntersections(x1, y1, x2, y2);

        if (!p1in && !p2in && crossings.length === 0) {
          // Entire segment outside — add both endpoints
          if (currentRun.length === 0) currentRun.push(x1, y1);
          currentRun.push(x2, y2);
        } else if (p1in && p2in && crossings.length === 0) {
          // Entire segment inside — flush current run
          modified = true;
          if (currentRun.length >= 4) outsideRuns.push(currentRun);
          currentRun = [];
        } else {
          // Segment crosses the boundary
          modified = true;

          // Build sub-segments with their inside/outside classification
          const tValues = [0, ...crossings, 1];
          for (let j = 0; j < tValues.length - 1; j++) {
            const ta = tValues[j], tb = tValues[j + 1];
            const midT = (ta + tb) / 2;
            const midX = lerp(x1, x2, midT);
            const midY = lerp(y1, y2, midT);
            const midInside = isInside(midX, midY);

            if (!midInside) {
              // This sub-segment is outside
              const ax = lerp(x1, x2, ta), ay = lerp(y1, y2, ta);
              const bx = lerp(x1, x2, tb), by = lerp(y1, y2, tb);
              if (currentRun.length === 0) currentRun.push(ax, ay);
              currentRun.push(bx, by);
            } else {
              // This sub-segment is inside — flush
              if (currentRun.length >= 4) outsideRuns.push(currentRun);
              currentRun = [];
            }
          }
        }
      }
      // Flush last run
      if (currentRun.length >= 4) outsideRuns.push(currentRun);

      if (!modified) continue;

      toDelete.push(stroke.id);
      for (const run of outsideRuns) {
        toAdd.push({
          id: generateId(),
          points: run,
          color: stroke.color,
          strokeWidth: stroke.strokeWidth,
        });
      }
    }

    if (toDelete.length > 0) {
      store.deleteStrokes(toDelete);
      for (const s of toAdd) {
        useDrawStore.getState().addStroke(s);
      }
    }
  }

  // Right-click context menu handler
  const handleContextMenu = useCallback((e: Konva.KonvaEventObject<PointerEvent>) => {
    e.evt.preventDefault();
    // Find if we right-clicked on a node
    const target = e.target;
    if (target === stageRef.current) {
      setContextMenu(null);
      return;
    }
    // Walk up to find a Group with an element that has a node ID
    let current: Konva.Node | null = target;
    while (current && current !== stageRef.current) {
      const rect = current.findOne?.('Rect');
      const nodeId = rect?.id?.();
      if (nodeId) {
        const storeNode = useCanvasStore.getState().nodes.find((n) => n.id === nodeId);
        if (storeNode) {
          const stage = stageRef.current;
          const container = stage?.container();
          if (container) {
            const rect = container.getBoundingClientRect();
            setContextMenu({
              x: e.evt.clientX - rect.left,
              y: e.evt.clientY - rect.top,
              nodeId,
            });
          }
          return;
        }
      }
      current = current.parent;
    }
    setContextMenu(null);
  }, []);

  // Cursor style based on active tool
  const cursorClass =
    activeTool === 'text' ? 'infinite-canvas--crosshair'
    : activeTool === 'draw' ? 'infinite-canvas--none'
    : activeTool === 'shape' ? ''
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
          onClick={(e) => { setContextMenu(null); handleStageClick(e); }}
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
      {/* Right-click context menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          nodeId={contextMenu.nodeId}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
}
