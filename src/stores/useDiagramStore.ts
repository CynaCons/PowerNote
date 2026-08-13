import { create } from 'zustand';

/**
 * Which diagram's source dialog is open.
 *
 * The dialog is page-level DOM, so it cannot live inside the diagram node: a
 * react-konva subtree is reconciled by Konva's renderer, and plain HTML children
 * there fail on `getParent`. The node raises the intent, `InfiniteCanvas` renders
 * the dialog next to its other HTML overlays.
 */
interface DiagramUiState {
  editingId: string | null;
  openSource: (nodeId: string) => void;
  closeSource: () => void;
}

export const useDiagramStore = create<DiagramUiState>((set) => ({
  editingId: null,
  openSource: (nodeId) => set({ editingId: nodeId }),
  closeSource: () => set({ editingId: null }),
}));
