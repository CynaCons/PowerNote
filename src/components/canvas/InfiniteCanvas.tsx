import { useRef, useState, useCallback, useEffect } from 'react';
import { Stage, Layer } from 'react-konva';
import type Konva from 'konva';
import { useCanvasStore, undoBatchStart } from '../../stores/useCanvasStore';
import { useToolStore } from '../../stores/useToolStore';
import { CanvasNode } from './CanvasNode';
import { SnapGuides, type SnapLine } from './SnapGuides';
import { PageGuides, type BackgroundMode } from './PageGuides';
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

interface InfiniteCanvasProps {
  backgroundMode?: BackgroundMode;
}

export function InfiniteCanvas({ backgroundMode = 'pages' }: InfiniteCanvasProps) {
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

      // Ctrl+Z: undo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        useCanvasStore.getState().undo();
      }

      // Ctrl+Shift+Z / Ctrl+Y: redo
      if ((e.ctrlKey || e.metaKey) && ((e.key === 'z' && e.shiftKey) || e.key === 'y')) {
        e.preventDefault();
        useCanvasStore.getState().redo();
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
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <Layer>
            <PageGuides mode={backgroundMode} nodes={nodes} />
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
