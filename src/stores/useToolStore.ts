import { create } from 'zustand';
import type { ToolType, TextOptions, DrawOptions } from '../types/data';
import { defaultTextOptions } from '../utils/defaults';

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

  setTool: (tool: ToolType) => void;
  setTextOptions: (options: Partial<TextOptions>) => void;
  setDrawOptions: (options: Partial<DrawOptions>) => void;
}

export const useToolStore = create<ToolState>((set) => ({
  activeTool: 'select',
  textOptions: { ...defaultTextOptions },
  drawOptions: { ...defaultDrawOptions },

  setTool: (tool) => set({ activeTool: tool }),

  setTextOptions: (options) =>
    set((state) => ({
      textOptions: { ...state.textOptions, ...options },
    })),

  setDrawOptions: (options) =>
    set((state) => ({
      drawOptions: { ...state.drawOptions, ...options },
    })),
}));
