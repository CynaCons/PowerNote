import { create } from 'zustand';

export type FileBindingSource = 'fsa' | 'file-url' | 'none';

interface FileBindingState {
  /** Best-effort display path or file name for the open HTML file */
  label: string | null;
  source: FileBindingSource;
  setFromHandle: (handle: { name: string }) => void;
  setFromFileUrl: () => void;
  clear: () => void;
  /**
   * Re-resolve display identity.
   * - handle present → `handle.name` (picker APIs do not expose a folder path)
   * - `file://` + no handle → absolute path from `location`
   * - otherwise → unlinked
   */
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

/** Resolve absolute display path from a document location, or null if not file://. */
export function resolveFileUrlLabel(protocol: string, pathname: string): string | null {
  if (protocol !== 'file:') return null;
  return formatFileUrlPath(pathname);
}

/** True when the tab itself is a local HTML file (full path available). */
export function isFileUrlDocument(): boolean {
  return typeof window !== 'undefined' && window.location.protocol === 'file:';
}

export const useFileBindingStore = create<FileBindingState>((set) => ({
  label: null,
  source: 'none',

  setFromHandle: (handle) =>
    set({ label: handle.name, source: 'fsa' }),

  setFromFileUrl: () => {
    if (typeof window === 'undefined') {
      set({ label: null, source: 'none' });
      return;
    }
    const label = resolveFileUrlLabel(window.location.protocol, window.location.pathname);
    if (!label) {
      set({ label: null, source: 'none' });
      return;
    }
    set({ label, source: 'file-url' });
  },

  clear: () => set({ label: null, source: 'none' }),

  refresh: async () => {
    const { getCurrentHandle } = await import('../utils/fileHandleStore');
    const handle = await getCurrentHandle();
    if (handle) {
      set({ label: handle.name, source: 'fsa' });
      return;
    }
    if (typeof window !== 'undefined') {
      const label = resolveFileUrlLabel(window.location.protocol, window.location.pathname);
      if (label) {
        set({ label, source: 'file-url' });
        return;
      }
    }
    set({ label: null, source: 'none' });
  },
}));
