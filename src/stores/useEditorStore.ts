import { create } from 'zustand';
import type { FormatKind } from '../utils/markdownToggle';

interface EditorState {
  activeEditor: HTMLTextAreaElement | null;
  applyFormat: ((kind: FormatKind) => void) | null;

  registerEditor: (
    textarea: HTMLTextAreaElement,
    applyFormat: (kind: FormatKind) => void,
  ) => void;
  unregisterEditor: (textarea: HTMLTextAreaElement) => void;
}

export const useEditorStore = create<EditorState>((set, get) => ({
  activeEditor: null,
  applyFormat: null,

  registerEditor: (textarea, applyFormat) =>
    set({ activeEditor: textarea, applyFormat }),

  unregisterEditor: (textarea) => {
    if (get().activeEditor === textarea) {
      set({ activeEditor: null, applyFormat: null });
    }
  },
}));
