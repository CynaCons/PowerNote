import { create } from 'zustand';
import type { ToolType, TextOptions, DrawOptions, ShapeOptions } from '../types/data';
import { defaultTextOptions, defaultShapeOptions } from '../utils/defaults';

const defaultDrawOptions: DrawOptions = {
  color: '#1a1a1a',
  strokeWidth: 3,
  eraserMode: 'stroke',
  eraserSize: 12,
  isErasing: false,
};

interface ToolState {
  activeTool: ToolType;
  textOptions: TextOptions;
  drawOptions: DrawOptions;
  shapeOptions: ShapeOptions;

  setTool: (tool: ToolType) => void;
  setTextOptions: (options: Partial<TextOptions>) => void;
  setDrawOptions: (options: Partial<DrawOptions>) => void;
  setShapeOptions: (options: Partial<ShapeOptions>) => void;
}

export const useToolStore = create<ToolState>((set) => ({
  activeTool: 'select',
  textOptions: { ...defaultTextOptions },
  drawOptions: { ...defaultDrawOptions },
  shapeOptions: { ...defaultShapeOptions },

  setTool: (tool) => set({ activeTool: tool }),

  setTextOptions: (options) =>
    set((state) => ({
      textOptions: { ...state.textOptions, ...options },
    })),

  setDrawOptions: (options) =>
    set((state) => ({
      drawOptions: { ...state.drawOptions, ...options },
    })),

  setShapeOptions: (options) =>
    set((state) => ({
      shapeOptions: { ...state.shapeOptions, ...options },
    })),
}));
