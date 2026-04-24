import { useWorkspaceStore } from '../stores/useWorkspaceStore';
import { useCanvasStore } from '../stores/useCanvasStore';
import { useDrawStore } from '../stores/useDrawStore';
import { extractDataFromHtml } from './serialization';
import { isFSASupported, readFromHandle } from './fileSystemAccess';
import { getCurrentHandle } from './fileHandleStore';
import { migrateWorkspace } from './migrations';
import { showToast } from '../components/layout/Toast';

/**
 * Is revert possible right now? True when the workspace has unsaved
 * changes AND a current `FileSystemFileHandle` with already-granted read
 * permission exists. Used by the TopBar to gate button enablement.
 */
export async function canRevert(): Promise<boolean> {
  if (!useWorkspaceStore.getState().isDirty) return false;
  if (!isFSASupported()) return false;
  const handle = await getCurrentHandle();
  if (!handle) return false;
  const perm = await (handle as any).queryPermission?.({ mode: 'read' });
  return perm === 'granted';
}

/**
 * Discard unsaved in-memory changes and reload the current file from
 * disk via the FSA handle. Standard "File → Revert" behavior.
 *
 * Opens a confirmation dialog first. No-ops (without prompting) when
 * the workspace is clean or no revertible handle is available.
 */
export async function revertNotebook(
  confirm: (msg: string) => boolean = window.confirm.bind(window),
): Promise<void> {
  if (!useWorkspaceStore.getState().isDirty) return;
  if (!isFSASupported()) {
    showToast('Revert requires File System Access API', 'error');
    return;
  }

  const handle = await getCurrentHandle();
  if (!handle) {
    showToast('No saved file to revert to', 'error');
    return;
  }

  const perm = await (handle as any).queryPermission?.({ mode: 'read' });
  if (perm !== 'granted') {
    showToast('Cannot read saved file — permission denied', 'error');
    return;
  }

  const ok = confirm(
    'Discard unsaved changes and revert to the last saved version on disk?',
  );
  if (!ok) return;

  try {
    const text = await readFromHandle(handle);
    if (!text) {
      showToast('Revert failed — could not read file', 'error');
      return;
    }
    const ok = applyRevertedText(text);
    if (!ok) {
      showToast('Revert failed — file is not a valid PowerNote notebook', 'error');
      return;
    }
    showToast(`Reverted to ${handle.name}`, 'info');
  } catch (err) {
    console.error('[revertNotebook] Failed:', err);
    showToast('Revert failed', 'error');
  }
}

/**
 * Apply a saved-file text to the stores: parse, migrate, hydrate,
 * mark clean. Returns false when the text is not a valid PowerNote HTML.
 * Exported for tests that exercise the hydration path without needing
 * to mock FSA + IDB.
 */
export function applyRevertedText(text: string): boolean {
  const data = extractDataFromHtml(text);
  if (!data) return false;

  const migrated = migrateWorkspace(data);
  useWorkspaceStore.setState({
    workspace: migrated,
    activeSectionId: migrated.sections[0]?.id ?? '',
    activePageId: migrated.sections[0]?.pages[0]?.id ?? '',
    isDirty: false,
  });
  const firstPage = migrated.sections[0]?.pages[0];
  useCanvasStore.getState().loadPageNodes(firstPage?.nodes ?? []);
  useDrawStore.getState().loadPageStrokes(firstPage?.strokes ?? []);
  return true;
}
