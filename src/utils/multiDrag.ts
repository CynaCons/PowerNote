/**
 * Multi-node (+ selected stroke) drag session.
 * One undo snapshot at start; silent position updates during move/end.
 */
import type Konva from 'konva';
import { useCanvasStore, undoBatchStart, undoBatchEnd } from '../stores/useCanvasStore';
import { useDrawStore, pushStrokeUndo } from '../stores/useDrawStore';

interface DragSession {
  draggedId: string;
  originX: number;
  originY: number;
  nodeStarts: Map<string, { x: number; y: number }>;
  strokeStarts: Map<string, number[]>;
  multi: boolean;
}

let session: DragSession | null = null;

export function multiDragStart(draggedId: string, x: number, y: number): void {
  const canvas = useCanvasStore.getState();
  const draw = useDrawStore.getState();

  const inSelection = canvas.selectedNodeIds.includes(draggedId);
  const nodeIds = inSelection ? [...canvas.selectedNodeIds] : [draggedId];
  const strokeIds =
    inSelection && nodeIds.length + draw.selectedStrokeIds.length > 1
      ? [...draw.selectedStrokeIds]
      : inSelection
        ? [...draw.selectedStrokeIds]
        : [];

  const multi = nodeIds.length > 1 || strokeIds.length > 0;

  if (multi) {
    undoBatchStart(canvas.nodes);
    if (strokeIds.length > 0) {
      pushStrokeUndo(draw.strokes);
    }
  }

  const nodeStarts = new Map<string, { x: number; y: number }>();
  for (const id of nodeIds) {
    const n = canvas.nodes.find((nn) => nn.id === id);
    if (n) nodeStarts.set(id, { x: n.x, y: n.y });
  }

  const strokeStarts = new Map<string, number[]>();
  for (const id of strokeIds) {
    const s = draw.strokes.find((ss) => ss.id === id);
    if (s) strokeStarts.set(id, [...s.points]);
  }

  session = {
    draggedId,
    originX: x,
    originY: y,
    nodeStarts,
    strokeStarts,
    multi,
  };
}

export function multiDragMove(
  draggedId: string,
  x: number,
  y: number,
  stage: Konva.Stage | null,
): void {
  if (!session || session.draggedId !== draggedId || !session.multi) return;

  const dx = x - session.originX;
  const dy = y - session.originY;
  const canvas = useCanvasStore.getState();

  for (const [id, start] of session.nodeStarts) {
    if (id === draggedId) continue;
    const nx = start.x + dx;
    const ny = start.y + dy;
    canvas.updateNodeSilent(id, { x: nx, y: ny });
    if (stage) {
      // Hit rect has node id; parent Group holds position
      const hit = stage.findOne(`#${id}`);
      const group = hit?.getParent?.();
      if (group && group !== stage) {
        group.position({ x: nx, y: ny });
      }
    }
  }

  if (session.strokeStarts.size > 0) {
    useDrawStore.getState().moveStrokesSilent(
      Array.from(session.strokeStarts.keys()),
      dx,
      dy,
      session.strokeStarts,
    );
  }
}

export function multiDragEnd(draggedId: string, x: number, y: number): void {
  if (!session || session.draggedId !== draggedId) {
    useCanvasStore.getState().updateNode(draggedId, { x, y });
    session = null;
    return;
  }

  const dx = x - session.originX;
  const dy = y - session.originY;
  const canvas = useCanvasStore.getState();

  if (!session.multi) {
    canvas.updateNode(draggedId, { x, y });
    session = null;
    return;
  }

  for (const [id, start] of session.nodeStarts) {
    canvas.updateNodeSilent(id, { x: start.x + dx, y: start.y + dy });
  }

  if (session.strokeStarts.size > 0) {
    useDrawStore.getState().moveStrokesSilent(
      Array.from(session.strokeStarts.keys()),
      dx,
      dy,
      session.strokeStarts,
    );
  }

  undoBatchEnd();
  session = null;
}

export function multiDragCancel(): void {
  if (session?.multi) {
    undoBatchEnd();
  }
  session = null;
}
