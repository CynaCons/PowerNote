import { useState, useCallback, useRef } from 'react';
import type Konva from 'konva';
import { useCanvasStore } from '../stores/useCanvasStore';
import { useToolStore } from '../stores/useToolStore';
import { useDrawStore } from '../stores/useDrawStore';
import { generateId } from '../utils/ids';
import type { Stroke } from '../types/data';

export interface ShapePreview {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Hook for all shape creation logic: draw tool (pen + eraser), shape tool (click+drag),
 * and lasso selection. Manages mouse down/move/up handlers, shape preview state,
 * in-progress drawing points, eraser position, pen cursor, and lasso rect.
 */
export function useShapeCreation(
  stageRef: React.RefObject<Konva.Stage | null>,
) {
  // Drawing state
  const [inProgressPoints, setInProgressPoints] = useState<number[] | null>(null);
  const [eraserPos, setEraserPos] = useState<{ x: number; y: number; radius: number } | null>(null);
  const [penCursorPos, setPenCursorPos] = useState<{ x: number; y: number } | null>(null);
  const [lassoRect, setLassoRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const isDrawing = useRef(false);
  const lassoStart = useRef<{ x: number; y: number } | null>(null);
  const eraserState = useRef({ prevDir: null as { x: number; y: number } | null, shakeScore: 0, lastTime: 0 });

  // Shape creation state
  const [shapePreview, setShapePreview] = useState<ShapePreview | null>(null);
  const shapeStart = useRef<{ x: number; y: number } | null>(null);

  const getCanvasPoint = useCallback((_e: Konva.KonvaEventObject<MouseEvent>) => {
    const stage = stageRef.current;
    if (!stage) return { x: 0, y: 0 };
    const pos = stage.getPointerPosition();
    if (!pos) return { x: 0, y: 0 };
    return {
      x: (pos.x - stage.x()) / stage.scaleX(),
      y: (pos.y - stage.y()) / stage.scaleY(),
    };
  }, [stageRef]);

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

    // Find t values where segment P1->P2 intersects circle (ex,ey,r)
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
      // For each segment P1->P2, classify the segment parts as inside/outside
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

  const handleDrawMouseDown = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
    const tool = useToolStore.getState().activeTool;
    // For shape tool: allow clicks on background elements (PageGuides, Stage)
    // For draw/erase/lasso: only trigger on Stage itself
    if (tool !== 'shape' && e.target !== stageRef.current) return;
    // For shape tool: don't start if clicking on an interactive node
    if (tool === 'shape') {
      let target: Konva.Node | null = e.target;
      while (target && target !== stageRef.current) {
        const rect = (target as any).findOne?.('Rect');
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
  }, [getCanvasPoint, stageRef]);

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
      const rect = lassoRect;

      // Find strokes within lasso rect
      const allStrokes = useDrawStore.getState().strokes;
      const selectedStrokes = allStrokes.filter((s) => {
        for (let i = 0; i < s.points.length; i += 2) {
          if (s.points[i] >= rect.x && s.points[i] <= rect.x + rect.w &&
              s.points[i + 1] >= rect.y && s.points[i + 1] <= rect.y + rect.h) {
            return true;
          }
        }
        return false;
      });
      useDrawStore.getState().selectStrokes(selectedStrokes.map((s) => s.id));

      // Find nodes (text/shape/image) whose bounding box intersects the lasso rect
      const allNodes = useCanvasStore.getState().nodes;
      const selectedNodeIds = allNodes.filter((n) => {
        // For arrows/lines, width/height can be negative (direction vector)
        const nx1 = Math.min(n.x, n.x + n.width);
        const ny1 = Math.min(n.y, n.y + n.height);
        const nx2 = Math.max(n.x, n.x + n.width);
        const ny2 = Math.max(n.y, n.y + n.height);
        // Intersection check with lasso rect
        return !(nx2 < rect.x || nx1 > rect.x + rect.w ||
                 ny2 < rect.y || ny1 > rect.y + rect.h);
      }).map((n) => n.id);

      // Replace node selection with lassoed ones
      useCanvasStore.setState({ selectedNodeIds });

      // After lasso, switch to select mode so the user can move/duplicate
      if (selectedNodeIds.length > 0 || selectedStrokes.length > 0) {
        useToolStore.getState().setTool('select');
      }
    }

    isDrawing.current = false;
    setInProgressPoints(null);
    shapeStart.current = null;
    setShapePreview(null);
    lassoStart.current = null;
    setLassoRect(null);
    const opts = useToolStore.getState().drawOptions;
    if (!(tool === 'draw' && opts.isErasing)) setEraserPos(null);
  }, [inProgressPoints, lassoRect, shapePreview]);

  return {
    // State
    inProgressPoints,
    eraserPos,
    penCursorPos,
    lassoRect,
    shapePreview,
    // Handlers
    handleDrawMouseDown,
    handleDrawMouseMove,
    handleDrawMouseUp,
  };
}
