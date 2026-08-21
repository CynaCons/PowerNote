import { create } from 'zustand';
import {
  getDrawioViewerState,
  installDrawioViewer,
  type DrawioViewerState,
} from '../extensions/drawioViewer';

/**
 * Settings-panel view of the extension machinery. The truth lives in the
 * extension module (memory/DOM/IndexedDB); this store only mirrors it so the
 * panel re-renders through the usual zustand path. `refresh()` is called when
 * the panel opens and after every install attempt.
 */
interface ExtensionStoreState {
  drawio: DrawioViewerState;
  refresh: () => Promise<void>;
  install: () => Promise<void>;
}

const IDLE: DrawioViewerState = {
  status: 'not-installed',
  version: null,
  cached: false,
  embedded: false,
  error: null,
};

export const useExtensionStore = create<ExtensionStoreState>((set, get) => ({
  drawio: IDLE,

  refresh: async () => {
    set({ drawio: await getDrawioViewerState() });
  },

  install: async () => {
    set({ drawio: { ...get().drawio, status: 'installing', error: null } });
    try {
      await installDrawioViewer();
    } catch (err) {
      set({
        drawio: {
          ...get().drawio,
          status: 'failed',
          error: err instanceof Error ? err.message : String(err),
        },
      });
      return;
    }
    await get().refresh();
  },
}));
