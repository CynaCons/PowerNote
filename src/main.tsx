import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import { getEmbeddedData, loadFromLocalStorage, startAutoSave } from './utils/serialization';
import { useWorkspaceStore } from './stores/useWorkspaceStore';
import { useCanvasStore } from './stores/useCanvasStore';
import { useDrawStore } from './stores/useDrawStore';
import { migrateWorkspace } from './utils/migrations';
import { checkForUpdate } from './utils/updateChecker';
import { APP_VERSION } from './version';

// Hydrate: priority is embedded data > localStorage > fresh workspace
const embeddedData = getEmbeddedData();
const autoSavedData = loadFromLocalStorage();
let hydrateData = embeddedData || autoSavedData;

// Migrate old data to current version if needed
if (hydrateData) {
  hydrateData = migrateWorkspace(hydrateData);
  useWorkspaceStore.setState({
    workspace: hydrateData,
    activeSectionId: hydrateData.sections[0]?.id,
    activePageId: hydrateData.sections[0]?.pages[0]?.id,
  });
  const firstPage = hydrateData.sections[0]?.pages[0];
  useCanvasStore.getState().loadPageNodes(firstPage?.nodes ?? []);
  useDrawStore.getState().loadPageStrokes(firstPage?.strokes ?? []);
}

// Check for updates (non-blocking, silent on failure)
checkForUpdate(APP_VERSION).then((result) => {
  console.log('[PowerNote] Update check result:', result);
  if (result?.available && result.latestVersion) {
    (window as any).__POWERNOTE_UPDATE__ = result;
    console.log(`[PowerNote] Update available: v${result.latestVersion}`);
  }
}).catch((err) => {
  console.error('[PowerNote] Update check error:', err);
});

// Start auto-save interval (every 30s when dirty)
startAutoSave(
  () => {
    // Flush active page content to workspace before saving
    const ws = useWorkspaceStore.getState();
    ws.savePageNodes(useCanvasStore.getState().nodes);
    ws.savePageStrokes(useDrawStore.getState().strokes);
    return useWorkspaceStore.getState().workspace;
  },
  () => useWorkspaceStore.getState().isDirty,
);

// Expose stores for E2E testing (dev) and re-export (production standalone)
import('./stores/useToolStore').then(({ useToolStore }) => {
  (window as any).__POWERNOTE_STORES__ = {
    workspace: useWorkspaceStore,
    canvas: useCanvasStore,
    tool: useToolStore,
    draw: useDrawStore,
  };
});

createRoot(document.getElementById('root')!).render(<App />);
