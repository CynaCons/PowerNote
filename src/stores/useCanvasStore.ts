import { create } from 'zustand';
import type { CanvasNode, Viewport } from '../types/data';
import { generateId } from '../utils/ids';
import { useWorkspaceStore } from './useWorkspaceStore';

const MAX_HISTORY = 50;

interface CanvasState {
  nodes: CanvasNode[];
  viewport: Viewport;
  selectedNodeIds: string[];

  // Node CRUD (all push to undo history)
  addNode: (node: CanvasNode) => void;
  updateNode: (id: string, updates: Partial<CanvasNode>) => void;
  updateNodeSilent: (id: string, updates: Partial<CanvasNode>) => void; // no undo push (for layout sync)
  deleteNode: (id: string) => void;
  deleteSelectedNodes: () => void;

  // Bulk operations for page switching
  loadPageNodes: (nodes: CanvasNode[]) => void;
  getNodesSnapshot: () => CanvasNode[];

  // Selection
  selectNode: (id: string, additive: boolean) => void;
  clearSelection: () => void;

  // Viewport
  setViewport: (viewport: Partial<Viewport>) => void;
  _stageRef: { current: any | null };
  setStageRef: (stage: any) => void;
  zoomToFit: () => void;

  // Clipboard
  copySelectedNodes: () => void;
  pasteNodes: (offsetX?: number, offsetY?: number) => void;

  // Undo/Redo
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
}

// Module-level state (persists across renders, not serialized)
let clipboard: CanvasNode[] = [];
let undoStack: CanvasNode[][] = [];
let redoStack: CanvasNode[][] = [];
let batchDepth = 0; // When > 0, only the first pushUndo in the batch saves a snapshot
let _konvaStageRef: any = null; // Konva.Stage reference for direct manipulation

function pushUndo(nodes: CanvasNode[]) {
  if (batchDepth > 0) return; // Inside a batch — skip intermediate snapshots
  undoStack.push(nodes.map((n) => ({ ...n, data: { ...n.data } })));
  if (undoStack.length > MAX_HISTORY) undoStack.shift();
  redoStack = []; // Clear redo on new action
}

/** Start a batch — the NEXT pushUndo saves, all subsequent ones inside the batch are skipped */
export function undoBatchStart(nodes: CanvasNode[]) {
  if (batchDepth === 0) {
    // Save the snapshot at the start of the batch
    undoStack.push(nodes.map((n) => ({ ...n, data: { ...n.data } })));
    if (undoStack.length > MAX_HISTORY) undoStack.shift();
    redoStack = [];
  }
  batchDepth++;
}

export function undoBatchEnd() {
  if (batchDepth > 0) batchDepth--;
}

function deepCopyNodes(nodes: CanvasNode[]): CanvasNode[] {
  return nodes.map((n) => ({ ...n, data: { ...n.data } }));
}

export const useCanvasStore = create<CanvasState>((set, get) => ({
  nodes: [],
  viewport: { x: 0, y: 0, scale: 1 },
  selectedNodeIds: [],

  addNode: (node) =>
    set((state) => {
      pushUndo(state.nodes);
      useWorkspaceStore.getState().markDirty();
      // Ensure layer defaults to 3 if not specified
      const withLayer = { ...node, layer: node.layer ?? 3 };
      return { nodes: [...state.nodes, withLayer] };
    }),

  updateNode: (id, updates) =>
    set((state) => {
      pushUndo(state.nodes);
      useWorkspaceStore.getState().markDirty();
      return {
        nodes: state.nodes.map((n) =>
          n.id === id ? { ...n, ...updates } : n,
        ),
      };
    }),

  updateNodeSilent: (id, updates) =>
    set((state) => {
      useWorkspaceStore.getState().markDirty();
      return {
        nodes: state.nodes.map((n) =>
          n.id === id ? { ...n, ...updates } : n,
        ),
      };
    }),

  deleteNode: (id) =>
    set((state) => {
      pushUndo(state.nodes);
      useWorkspaceStore.getState().markDirty();
      return {
        nodes: state.nodes.filter((n) => n.id !== id),
        selectedNodeIds: state.selectedNodeIds.filter((sid) => sid !== id),
      };
    }),

  deleteSelectedNodes: () =>
    set((state) => {
      pushUndo(state.nodes);
      useWorkspaceStore.getState().markDirty();
      return {
        nodes: state.nodes.filter((n) => !state.selectedNodeIds.includes(n.id)),
        selectedNodeIds: [],
      };
    }),

  loadPageNodes: (nodes) => {
    // Reset history on page switch
    undoStack = [];
    redoStack = [];
    set({ nodes, selectedNodeIds: [] });
  },

  getNodesSnapshot: () => get().nodes,

  selectNode: (id, additive) =>
    set((state) => {
      if (additive) {
        const already = state.selectedNodeIds.includes(id);
        return {
          selectedNodeIds: already
            ? state.selectedNodeIds.filter((sid) => sid !== id)
            : [...state.selectedNodeIds, id],
        };
      }
      return { selectedNodeIds: [id] };
    }),

  clearSelection: () => set({ selectedNodeIds: [] }),

  setViewport: (viewport) => {
    set((state) => ({
      viewport: { ...state.viewport, ...viewport },
    }));
    // Sync the Konva Stage if ref is available
    if (_konvaStageRef) {
      const v = get().viewport;
      _konvaStageRef.scale({ x: v.scale, y: v.scale });
      _konvaStageRef.position({ x: v.x, y: v.y });
      _konvaStageRef.batchDraw();
    }
  },

  _stageRef: { current: null }, // kept for interface compat

  setStageRef: (stage) => {
    _konvaStageRef = stage;
  },

  zoomToFit: () => {
    const nodes = get().nodes;
    if (nodes.length === 0) return;

    const stage = _konvaStageRef;
    if (!stage) return;
    const container = stage.container();
    const cw = container.clientWidth;
    const ch = container.clientHeight;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const n of nodes) {
      minX = Math.min(minX, n.x);
      minY = Math.min(minY, n.y);
      maxX = Math.max(maxX, n.x + (n.width || 200));
      maxY = Math.max(maxY, n.y + (n.height || 40));
    }

    const contentW = maxX - minX;
    const contentH = maxY - minY;
    if (contentW <= 0 || contentH <= 0) return;

    const padding = 60;
    const scale = Math.min(
      (cw - padding * 2) / contentW,
      (ch - padding * 2) / contentH,
      2,
    );
    const clampedScale = Math.max(0.1, Math.min(5, scale));

    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    const newViewport = {
      x: cw / 2 - centerX * clampedScale,
      y: ch / 2 - centerY * clampedScale,
      scale: clampedScale,
    };

    set({ viewport: newViewport });
    stage.scale({ x: clampedScale, y: clampedScale });
    stage.position({ x: newViewport.x, y: newViewport.y });
    stage.batchDraw();
  },

  copySelectedNodes: () => {
    const state = get();
    clipboard = state.nodes
      .filter((n) => state.selectedNodeIds.includes(n.id))
      .map((n) => ({ ...n, data: { ...n.data } }));
  },

  pasteNodes: (offsetX = 20, offsetY = 20) => {
    if (clipboard.length === 0) return;
    const newNodes = clipboard.map((n) => ({
      ...n,
      id: generateId(),
      x: n.x + offsetX,
      y: n.y + offsetY,
      data: { ...n.data },
    }));
    set((state) => {
      pushUndo(state.nodes);
      return {
        nodes: [...state.nodes, ...newNodes],
        selectedNodeIds: newNodes.map((n) => n.id),
      };
    });
  },

  undo: () => {
    if (undoStack.length === 0) return;
    const current = get().nodes;
    redoStack.push(deepCopyNodes(current));
    const prev = undoStack.pop()!;
    set({ nodes: prev, selectedNodeIds: [] });
  },

  redo: () => {
    if (redoStack.length === 0) return;
    const current = get().nodes;
    undoStack.push(deepCopyNodes(current));
    const next = redoStack.pop()!;
    set({ nodes: next, selectedNodeIds: [] });
  },

  canUndo: () => undoStack.length > 0,
  canRedo: () => redoStack.length > 0,
}));
