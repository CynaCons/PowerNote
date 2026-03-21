import { create } from 'zustand';
import type { CanvasNode, Viewport, ContainerNodeData } from '../types/data';

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

  // Container-specific
  toggleContainerCollapse: (containerId: string) => void;
  moveNodeIntoContainer: (nodeId: string, containerId: string) => void;
  moveNodeOutOfContainer: (nodeId: string) => void;
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
    set((state) => {
      const deletedNode = state.nodes.find((n) => n.id === id);

      // If deleting a container, release its children
      let updatedNodes = state.nodes.filter((n) => n.id !== id);
      if (deletedNode?.type === 'container') {
        updatedNodes = updatedNodes.map((n) =>
          n.parentContainerId === id
            ? { ...n, parentContainerId: null }
            : n,
        );
      }

      return {
        nodes: updatedNodes,
        selectedNodeId:
          state.selectedNodeId === id ? null : state.selectedNodeId,
      };
    }),

  loadPageNodes: (nodes) =>
    set({ nodes, selectedNodeId: null }),

  getNodesSnapshot: () => get().nodes,

  setSelectedNodeId: (id) => set({ selectedNodeId: id }),

  setViewport: (viewport) =>
    set((state) => ({
      viewport: { ...state.viewport, ...viewport },
    })),

  toggleContainerCollapse: (containerId) =>
    set((state) => ({
      nodes: state.nodes.map((n) => {
        if (n.id !== containerId || n.type !== 'container') return n;
        const data = n.data as ContainerNodeData;
        return {
          ...n,
          data: { ...data, isCollapsed: !data.isCollapsed },
        };
      }),
    })),

  moveNodeIntoContainer: (nodeId, containerId) =>
    set((state) => ({
      nodes: state.nodes.map((n) =>
        n.id === nodeId ? { ...n, parentContainerId: containerId } : n,
      ),
    })),

  moveNodeOutOfContainer: (nodeId) =>
    set((state) => ({
      nodes: state.nodes.map((n) =>
        n.id === nodeId ? { ...n, parentContainerId: null } : n,
      ),
    })),
}));
