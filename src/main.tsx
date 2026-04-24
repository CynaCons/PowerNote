import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import { getEmbeddedData, startAutoSave, extractDataFromHtml, clearLegacyAutoSave } from './utils/serialization';
import { useWorkspaceStore } from './stores/useWorkspaceStore';
import { useCanvasStore } from './stores/useCanvasStore';
import { useDrawStore } from './stores/useDrawStore';
import { migrateWorkspace } from './utils/migrations';
import { checkForUpdate } from './utils/updateChecker';
import { isFSASupported, readFromHandle } from './utils/fileSystemAccess';
import { getCurrentHandle, clearCurrentHandle } from './utils/fileHandleStore';
import { APP_VERSION } from './version';
import type { WorkspaceData } from './types/data';

function hydrateStores(data: WorkspaceData) {
  useWorkspaceStore.setState({
    workspace: data,
    activeSectionId: data.sections[0]?.id,
    activePageId: data.sections[0]?.pages[0]?.id,
    isDirty: false,
  });
  const firstPage = data.sections[0]?.pages[0];
  useCanvasStore.getState().loadPageNodes(firstPage?.nodes ?? []);
  useDrawStore.getState().loadPageStrokes(firstPage?.strokes ?? []);
}

// One-shot migration: older builds stashed a full workspace snapshot under
// `powernote-autosave`. That path is gone — the FSA handle + notebook
// library cover persistence now. Clear any legacy value so upgraded
// installs don't hold stale state.
clearLegacyAutoSave();

// Hydrate priority:
//   1. Embedded data (standalone HTML)
//   2. FSA current file handle (if permission already granted)
//   3. Fresh workspace (defaults)
const embeddedData = getEmbeddedData();
if (embeddedData) {
  hydrateStores(migrateWorkspace(embeddedData));
} else if (isFSASupported()) {
  // Async: try to restore from FSA handle if permission is already granted.
  // If NOT granted, we don't prompt (that requires user gesture) — the
  // user can re-open via the Open button which prompts properly.
  (async () => {
    try {
      const handle = await getCurrentHandle();
      if (!handle) return;
      const perm = await (handle as any).queryPermission?.({ mode: 'read' });
      if (perm !== 'granted') return; // silent skip — user will reopen manually
      const text = await readFromHandle(handle);
      if (!text) return;
      const data = extractDataFromHtml(text);
      if (data) {
        hydrateStores(migrateWorkspace(data));
        console.log('[PowerNote] Restored last file via FSA handle');
      }
    } catch (err) {
      console.warn('[PowerNote] FSA restore failed, handle may be stale:', err);
      await clearCurrentHandle();
    }
  })();
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

// Start auto-save (debounced 1.5s after last edit, max-wait 5s while dirty).
// Driven by workspace-store subscription: canvas/draw mutations flip
// isDirty on the workspace store, which is the only signal we listen to.
startAutoSave(
  () => {
    const ws = useWorkspaceStore.getState();
    ws.savePageNodes(useCanvasStore.getState().nodes);
    ws.savePageStrokes(useDrawStore.getState().strokes);
    return useWorkspaceStore.getState().workspace;
  },
  () => useWorkspaceStore.getState().isDirty,
  (onChange) => useWorkspaceStore.subscribe(onChange),
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
