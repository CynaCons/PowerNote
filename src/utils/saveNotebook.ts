import { useWorkspaceStore } from '../stores/useWorkspaceStore';
import { useCanvasStore } from '../stores/useCanvasStore';
import { useDrawStore } from '../stores/useDrawStore';
import { buildExportHtml, downloadFile } from './serialization';
import {
  isFSASupported,
  saveAsWithPicker,
  writeToHandle,
} from './fileSystemAccess';
import { getCurrentHandle, setCurrentHandle, addRecentHandle } from './fileHandleStore';
import { APP_VERSION } from '../version';
import { showToast } from '../components/layout/Toast';

/**
 * Unified save flow. Tries File System Access API first (fast path:
 * overwrite existing handle, or Save As picker for new file), falls back
 * to legacy download for browsers without FSA support.
 *
 * @param forceSaveAs If true, always show the Save As picker (ignores current handle).
 */
export async function saveNotebook(forceSaveAs: boolean = false): Promise<void> {
  // Flush in-memory state to workspace
  const canvasNodes = useCanvasStore.getState().nodes;
  const wsStore = useWorkspaceStore.getState();
  wsStore.savePageNodes(canvasNodes);
  wsStore.savePageStrokes(useDrawStore.getState().strokes);

  // Increment save revision and stamp editor version
  const revision = (wsStore.workspace.saveRevision || 0) + 1;
  wsStore.updateWorkspace({ editorVersion: APP_VERSION, saveRevision: revision });

  const ws = useWorkspaceStore.getState().workspace;
  const safeName = ws.filename.replace(/[^a-zA-Z0-9_\- ]/g, '_');

  try {
    const html = await buildExportHtml(ws);

    // ── Fast path: overwrite existing file via FSA ──────────
    if (!forceSaveAs && isFSASupported()) {
      const handle = await getCurrentHandle();
      if (handle) {
        const ok = await writeToHandle(handle, html);
        if (ok) {
          useWorkspaceStore.getState().markClean();
          showToast(`Saved to ${handle.name}`, 'success');
          return;
        }
        // Fall through to Save As if permission denied or write failed
      }
    }

    // ── Save As: show picker for new location ───────────────
    if (isFSASupported()) {
      const suggestedName = `${safeName}.html`;
      const newHandle = await saveAsWithPicker(html, suggestedName);
      if (newHandle) {
        await setCurrentHandle(newHandle);
        await addRecentHandle(ws.filename, newHandle);
        useWorkspaceStore.getState().markClean();
        showToast(`Saved to ${newHandle.name}`, 'success');
        return;
      }
      // User cancelled the picker — do nothing (workspace stays dirty)
      return;
    }

    // ── Fallback: legacy versioned download ─────────────────
    const versionedFilename = `${safeName} (v${APP_VERSION}-r${revision}).html`;
    downloadFile(html, versionedFilename);
    useWorkspaceStore.getState().markClean();
    showToast(`Downloaded ${versionedFilename}`, 'success');
  } catch (err) {
    console.error('[saveNotebook] Failed:', err);
    showToast('Failed to save notebook', 'error');
  }
}
