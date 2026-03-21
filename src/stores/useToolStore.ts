import { create } from 'zustand';
import type { ToolType, TextOptions } from '../types/data';
import { defaultTextOptions } from '../utils/defaults';

interface ToolState {
  activeTool: ToolType;
  textOptions: TextOptions;

  setTool: (tool: ToolType) => void;
  setTextOptions: (options: Partial<TextOptions>) => void;
}

export const useToolStore = create<ToolState>((set) => ({
  activeTool: 'select',
  textOptions: { ...defaultTextOptions },

  setTool: (tool) => set({ activeTool: tool }),

  setTextOptions: (options) =>
    set((state) => ({
      textOptions: { ...state.textOptions, ...options },
    })),
}));
