import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import { getEmbeddedData } from './utils/serialization';
import { useWorkspaceStore } from './stores/useWorkspaceStore';
import { useCanvasStore } from './stores/useCanvasStore';
import { useDrawStore } from './stores/useDrawStore';

// Hydrate from embedded data if present (self-contained HTML mode)
const embeddedData = getEmbeddedData();
if (embeddedData) {
  useWorkspaceStore.setState({
    workspace: embeddedData,
    activeSectionId: embeddedData.sections[0]?.id,
    activePageId: embeddedData.sections[0]?.pages[0]?.id,
  });
  const firstPage = embeddedData.sections[0]?.pages[0];
  useCanvasStore.getState().loadPageNodes(firstPage?.nodes ?? []);
  useDrawStore.getState().loadPageStrokes(firstPage?.strokes ?? []);
}

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
