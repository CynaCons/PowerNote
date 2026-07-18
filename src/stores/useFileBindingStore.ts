import { create } from 'zustand';

export type FileBindingSource = 'fsa' | 'file-url' | 'none';

interface FileBindingState {
  /** Best-effort display path or file name for the open HTML file */
  label: string | null;
  source: FileBindingSource;
  setFromHandle: (handle: { name: string }) => void;
  setFromFileUrl: () => void;
  clear: () => void;
  /** Re-read FSA handle, else fall back to file:// path, else clear */
  refresh: () => Promise<void>;
}

/** Normalize file:// pathname to a readable OS-ish path for display. */
export function formatFileUrlPath(pathname: string): string {
  let path = pathname;
  try {
    path = decodeURIComponent(pathname);
  } catch {
    // keep raw
  }
  // Chromium on Windows: /C:/Users/... → C:\Users\...
  if (/^\/[A-Za-z]:\//.test(path)) {
    return path.slice(1).replace(/\//g, '\\');
  }
  return path;
}

export const useFileBindingStore = create<FileBindingState>((set) => ({
  label: null,
  source: 'none',

  setFromHandle: (handle) =>
    set({ label: handle.name, source: 'fsa' }),

  setFromFileUrl: () => {
    if (typeof window === 'undefined' || window.location.protocol !== 'file:') {
      set({ label: null, source: 'none' });
      return;
    }
    set({
      label: formatFileUrlPath(window.location.pathname),
      source: 'file-url',
    });
  },

  clear: () => set({ label: null, source: 'none' }),

  refresh: async () => {
    const { getCurrentHandle } = await import('../utils/fileHandleStore');
    const handle = await getCurrentHandle();
    if (handle) {
      set({ label: handle.name, source: 'fsa' });
      return;
    }
    if (typeof window !== 'undefined' && window.location.protocol === 'file:') {
      set({
        label: formatFileUrlPath(window.location.pathname),
        source: 'file-url',
      });
      return;
    }
    set({ label: null, source: 'none' });
  },
}));
