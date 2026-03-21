import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

// Expose stores for E2E testing (dev mode only)
if (import.meta.env.DEV) {
  import('./stores/useWorkspaceStore').then(({ useWorkspaceStore }) => {
    import('./stores/useCanvasStore').then(({ useCanvasStore }) => {
      import('./stores/useToolStore').then(({ useToolStore }) => {
        (window as any).__POWERNOTE_STORES__ = {
          workspace: useWorkspaceStore,
          canvas: useCanvasStore,
          tool: useToolStore,
        };
      });
    });
  });
}

createRoot(document.getElementById('root')!).render(<App />);
