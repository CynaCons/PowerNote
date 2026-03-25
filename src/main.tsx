import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import { getEmbeddedData, loadFromLocalStorage, startAutoSave } from './utils/serialization';
import { useWorkspaceStore } from './stores/useWorkspaceStore';
import { useCanvasStore } from './stores/useCanvasStore';
import { useDrawStore } from './stores/useDrawStore';

// Hydrate: priority is embedded data > localStorage > fresh workspace
const embeddedData = getEmbeddedData();
const autoSavedData = loadFromLocalStorage();
const hydrateData = embeddedData || autoSavedData;

if (hydrateData) {
  useWorkspaceStore.setState({
    workspace: hydrateData,
    activeSectionId: hydrateData.sections[0]?.id,
    activePageId: hydrateData.sections[0]?.pages[0]?.id,
  });
  const firstPage = hydrateData.sections[0]?.pages[0];
  useCanvasStore.getState().loadPageNodes(firstPage?.nodes ?? []);
  useDrawStore.getState().loadPageStrokes(firstPage?.strokes ?? []);
}

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
