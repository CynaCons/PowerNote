import { create } from 'zustand';
import type { CanvasNode, Viewport } from '../types/data';
import { generateId } from '../utils/ids';

interface CanvasState {
  nodes: CanvasNode[];
  viewport: Viewport;
  selectedNodeIds: string[];

  // Node CRUD
  addNode: (node: CanvasNode) => void;
  updateNode: (id: string, updates: Partial<CanvasNode>) => void;
  deleteNode: (id: string) => void;
  deleteSelectedNodes: () => void;

  // Bulk operations for page switching
  loadPageNodes: (nodes: CanvasNode[]) => void;
  getNodesSnapshot: () => CanvasNode[];

  // Selection (multi-select support)
  selectNode: (id: string, additive: boolean) => void;
  clearSelection: () => void;

  // Viewport
  setViewport: (viewport: Partial<Viewport>) => void;

  // Clipboard
  copySelectedNodes: () => void;
  pasteNodes: (offsetX?: number, offsetY?: number) => void;
}

// Internal clipboard (module-level, persists across store resets)
let clipboard: CanvasNode[] = [];

export const useCanvasStore = create<CanvasState>((set, get) => ({
  nodes: [],
  viewport: { x: 0, y: 0, scale: 1 },
  selectedNodeIds: [],

  addNode: (node) =>
    set((state) => ({ nodes: [...state.nodes, node] })),

  updateNode: (id, updates) =>
    set((state) => ({
      nodes: state.nodes.map((n) =>
        n.id === id ? { ...n, ...updates } : n,
      ),
    })),

  deleteNode: (id) =>
    set((state) => ({
      nodes: state.nodes.filter((n) => n.id !== id),
      selectedNodeIds: state.selectedNodeIds.filter((sid) => sid !== id),
    })),

  deleteSelectedNodes: () =>
    set((state) => ({
      nodes: state.nodes.filter((n) => !state.selectedNodeIds.includes(n.id)),
      selectedNodeIds: [],
    })),

  loadPageNodes: (nodes) =>
    set({ nodes, selectedNodeIds: [] }),

  getNodesSnapshot: () => get().nodes,

  selectNode: (id, additive) =>
    set((state) => {
      if (additive) {
        // Ctrl+Click: toggle selection
        const already = state.selectedNodeIds.includes(id);
        return {
          selectedNodeIds: already
            ? state.selectedNodeIds.filter((sid) => sid !== id)
            : [...state.selectedNodeIds, id],
        };
      }
      // Normal click: single select
      return { selectedNodeIds: [id] };
    }),

  clearSelection: () => set({ selectedNodeIds: [] }),

  setViewport: (viewport) =>
    set((state) => ({
      viewport: { ...state.viewport, ...viewport },
    })),

  copySelectedNodes: () => {
    const state = get();
    clipboard = state.nodes
      .filter((n) => state.selectedNodeIds.includes(n.id))
      .map((n) => ({ ...n }));
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
    set((state) => ({
      nodes: [...state.nodes, ...newNodes],
      selectedNodeIds: newNodes.map((n) => n.id),
    }));
  },
}));
