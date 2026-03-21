import { create } from 'zustand';
import type { Stroke } from '../types/data';
import { useWorkspaceStore } from './useWorkspaceStore';

const MAX_HISTORY = 50;

interface DrawState {
  strokes: Stroke[];
  selectedStrokeIds: string[];

  addStroke: (stroke: Stroke) => void;
  deleteStroke: (id: string) => void;
  deleteStrokes: (ids: string[]) => void;
  moveStrokes: (ids: string[], dx: number, dy: number) => void;
  selectStrokes: (ids: string[]) => void;
  clearStrokeSelection: () => void;

  loadPageStrokes: (strokes: Stroke[]) => void;
  getStrokesSnapshot: () => Stroke[];

  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
}

let undoStack: Stroke[][] = [];
let redoStack: Stroke[][] = [];

function pushUndo(strokes: Stroke[]) {
  undoStack.push(strokes.map((s) => ({ ...s, points: [...s.points] })));
  if (undoStack.length > MAX_HISTORY) undoStack.shift();
  redoStack = [];
}

function deepCopy(strokes: Stroke[]): Stroke[] {
  return strokes.map((s) => ({ ...s, points: [...s.points] }));
}

export const useDrawStore = create<DrawState>((set, get) => ({
  strokes: [],
  selectedStrokeIds: [],

  addStroke: (stroke) => {
    set((state) => {
      pushUndo(state.strokes);
      useWorkspaceStore.getState().markDirty();
      return { strokes: [...state.strokes, stroke] };
    });
  },

  deleteStroke: (id) => {
    set((state) => {
      pushUndo(state.strokes);
      useWorkspaceStore.getState().markDirty();
      return {
        strokes: state.strokes.filter((s) => s.id !== id),
        selectedStrokeIds: state.selectedStrokeIds.filter((sid) => sid !== id),
      };
    });
  },

  deleteStrokes: (ids) => {
    set((state) => {
      pushUndo(state.strokes);
      useWorkspaceStore.getState().markDirty();
      const idSet = new Set(ids);
      return {
        strokes: state.strokes.filter((s) => !idSet.has(s.id)),
        selectedStrokeIds: state.selectedStrokeIds.filter((sid) => !idSet.has(sid)),
      };
    });
  },

  moveStrokes: (ids, dx, dy) => {
    set((state) => {
      pushUndo(state.strokes);
      useWorkspaceStore.getState().markDirty();
      const idSet = new Set(ids);
      return {
        strokes: state.strokes.map((s) => {
          if (!idSet.has(s.id)) return s;
          const newPoints = [...s.points];
          for (let i = 0; i < newPoints.length; i += 2) {
            newPoints[i] += dx;
            newPoints[i + 1] += dy;
          }
          return { ...s, points: newPoints };
        }),
      };
    });
  },

  selectStrokes: (ids) => set({ selectedStrokeIds: ids }),
  clearStrokeSelection: () => set({ selectedStrokeIds: [] }),

  loadPageStrokes: (strokes) => {
    undoStack = [];
    redoStack = [];
    set({ strokes, selectedStrokeIds: [] });
  },

  getStrokesSnapshot: () => get().strokes,

  undo: () => {
    const prev = undoStack.pop();
    if (!prev) return;
    set((state) => {
      redoStack.push(deepCopy(state.strokes));
      return { strokes: prev };
    });
  },

  redo: () => {
    const next = redoStack.pop();
    if (!next) return;
    set((state) => {
      undoStack.push(deepCopy(state.strokes));
      return { strokes: next };
    });
  },

  canUndo: () => undoStack.length > 0,
  canRedo: () => redoStack.length > 0,
}));
