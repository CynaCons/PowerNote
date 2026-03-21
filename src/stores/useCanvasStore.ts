import { create } from 'zustand';
import type { CanvasNode, Viewport } from '../types/data';

interface CanvasState {
  nodes: CanvasNode[];
  viewport: Viewport;
  selectedNodeId: string | null;

  // Node CRUD
  addNode: (node: CanvasNode) => void;
  updateNode: (id: string, updates: Partial<CanvasNode>) => void;
  deleteNode: (id: string) => void;

  // Bulk operations for page switching
  loadPageNodes: (nodes: CanvasNode[]) => void;
  getNodesSnapshot: () => CanvasNode[];

  // Selection
  setSelectedNodeId: (id: string | null) => void;

  // Viewport
  setViewport: (viewport: Partial<Viewport>) => void;
}

export const useCanvasStore = create<CanvasState>((set, get) => ({
  nodes: [],
  viewport: { x: 0, y: 0, scale: 1 },
  selectedNodeId: null,

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
      selectedNodeId:
        state.selectedNodeId === id ? null : state.selectedNodeId,
    })),

  loadPageNodes: (nodes) =>
    set({ nodes, selectedNodeId: null }),

  getNodesSnapshot: () => get().nodes,

  setSelectedNodeId: (id) => set({ selectedNodeId: id }),

  setViewport: (viewport) =>
    set((state) => ({
      viewport: { ...state.viewport, ...viewport },
    })),
}));
