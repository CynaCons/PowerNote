/**
 * File System Access API wrapper.
 *
 * Provides high-level save/open/permission helpers on top of
 * showSaveFilePicker / showOpenFilePicker / FileSystemFileHandle.
 *
 * Verified working on `file://` origin in Chromium (spike 2026-04-11).
 * Graceful fallback: callers check `isFSASupported()` first.
 */

// TypeScript helpers — the native types exist but the permission methods
// on FileSystemHandle are only in recent lib.dom.d.ts; cast to any to avoid
// TS errors across target versions.
interface FSFileHandle extends FileSystemFileHandle {
  queryPermission?: (opts: { mode: 'read' | 'readwrite' }) => Promise<PermissionState>;
  requestPermission?: (opts: { mode: 'read' | 'readwrite' }) => Promise<PermissionState>;
}

declare global {
  interface Window {
    showSaveFilePicker?: (opts?: any) => Promise<FileSystemFileHandle>;
    showOpenFilePicker?: (opts?: any) => Promise<FileSystemFileHandle[]>;
  }
}

/** Feature detection — true in Chrome/Edge/Opera/Brave, false in Firefox/Safari. */
export function isFSASupported(): boolean {
  return typeof window !== 'undefined'
    && 'showSaveFilePicker' in window
    && 'showOpenFilePicker' in window;
}

/** Common picker type for .html notebooks. */
const HTML_PICKER_TYPES = [
  {
    description: 'PowerNote notebook',
    accept: { 'text/html': ['.html'] as string[] },
  },
];

/**
 * Check + request read/write permission on a stored file handle.
 * Handles loaded from IndexedDB start in `'prompt'` state; this function
 * calls `requestPermission` to show the browser dialog (must be inside a
 * user gesture).
 */
export async function verifyPermission(
  handle: FileSystemFileHandle,
  readWrite: boolean = true,
): Promise<boolean> {
  const h = handle as FSFileHandle;
  const opts = { mode: readWrite ? 'readwrite' : 'read' } as const;

  try {
    if (h.queryPermission) {
      const state = await h.queryPermission(opts);
      if (state === 'granted') return true;
    }
    if (h.requestPermission) {
      const state = await h.requestPermission(opts);
      return state === 'granted';
    }
  } catch (err) {
    console.warn('[FSA] verifyPermission failed:', err);
  }
  return false;
}

/**
 * Show "Save As" picker, write the given HTML, and return the new handle.
 * Must be called inside a user gesture (click/keydown).
 */
export async function saveAsWithPicker(
  html: string,
  suggestedName: string,
): Promise<FileSystemFileHandle | null> {
  if (!isFSASupported()) return null;
  try {
    const handle = await window.showSaveFilePicker!({
      suggestedName,
      types: HTML_PICKER_TYPES,
    });
    const ok = await writeToHandle(handle, html);
    return ok ? handle : null;
  } catch (err: any) {
    if (err?.name === 'AbortError') return null; // user cancelled
    console.warn('[FSA] saveAsWithPicker failed:', err);
    return null;
  }
}

/**
 * Write HTML to an existing file handle (the "Ctrl+S overwrites" case).
 * Returns false if permission was denied or write failed.
 */
export async function writeToHandle(
  handle: FileSystemFileHandle,
  html: string,
): Promise<boolean> {
  try {
    const perm = await verifyPermission(handle, true);
    if (!perm) return false;
    const writable = await handle.createWritable();
    await writable.write(html);
    await writable.close();
    return true;
  } catch (err) {
    console.warn('[FSA] writeToHandle failed:', err);
    return false;
  }
}

/**
 * Show the "Open" picker and return both the handle and the file contents.
 * Must be called inside a user gesture.
 */
export async function openWithPicker(): Promise<{
  handle: FileSystemFileHandle;
  text: string;
} | null> {
  if (!isFSASupported()) return null;
  try {
    const [handle] = await window.showOpenFilePicker!({
      types: HTML_PICKER_TYPES,
      multiple: false,
    });
    const file = await handle.getFile();
    const text = await file.text();
    return { handle, text };
  } catch (err: any) {
    if (err?.name === 'AbortError') return null; // user cancelled
    console.warn('[FSA] openWithPicker failed:', err);
    return null;
  }
}

/**
 * Read a file handle's current contents without writing. Useful for the
 * bootstrap flow (restore last file on startup).
 */
export async function readFromHandle(
  handle: FileSystemFileHandle,
): Promise<string | null> {
  try {
    const perm = await verifyPermission(handle, false);
    if (!perm) return null;
    const file = await handle.getFile();
    return await file.text();
  } catch (err) {
    console.warn('[FSA] readFromHandle failed:', err);
    return null;
  }
}
