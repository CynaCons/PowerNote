/**
 * IndexedDB persistence for FileSystemFileHandle objects.
 *
 * localStorage cannot store handles (they're not JSON-serializable).
 * IDB preserves them as structured-cloneable objects that remain live
 * across page reloads.
 *
 * Schema:
 *   DB: 'powernote-handles'
 *   Store: 'kv' (key-value)
 *     - 'current' → FileSystemFileHandle (the notebook user is editing)
 *     - 'recent' → Array<RecentHandleEntry>
 */

const DB_NAME = 'powernote-handles';
const DB_VERSION = 1;
const STORE = 'kv';
const CURRENT_KEY = 'current';
const RECENT_KEY = 'recent';
const MAX_RECENT = 5;

export interface RecentHandleEntry {
  id: string;
  name: string;
  updatedAt: number;
  handle: FileSystemFileHandle;
}

function isIDBAvailable(): boolean {
  return typeof indexedDB !== 'undefined';
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!isIDBAvailable()) {
      reject(new Error('IndexedDB not available'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGet<T>(key: string): Promise<T | null> {
  try {
    const db = await openDB();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(key);
      req.onsuccess = () => resolve((req.result as T) ?? null);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('[FileHandleStore] idbGet failed:', err);
    return null;
  }
}

async function idbPut<T>(key: string, value: T): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('[FileHandleStore] idbPut failed:', err);
  }
}

async function idbDelete(key: string): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('[FileHandleStore] idbDelete failed:', err);
  }
}

// ── Current handle ──────────────────────────────────────────

export async function setCurrentHandle(handle: FileSystemFileHandle): Promise<void> {
  await idbPut(CURRENT_KEY, handle);
}

export async function getCurrentHandle(): Promise<FileSystemFileHandle | null> {
  return await idbGet<FileSystemFileHandle>(CURRENT_KEY);
}

export async function clearCurrentHandle(): Promise<void> {
  await idbDelete(CURRENT_KEY);
}

// ── Recent handles (max 5) ──────────────────────────────────

export async function getRecentHandles(): Promise<RecentHandleEntry[]> {
  const entries = await idbGet<RecentHandleEntry[]>(RECENT_KEY);
  if (!Array.isArray(entries)) return [];
  return [...entries].sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function addRecentHandle(
  name: string,
  handle: FileSystemFileHandle,
): Promise<void> {
  const entries = await getRecentHandles();
  const now = Date.now();

  // Upsert by name: if an entry with this name exists, update it.
  const existingIdx = entries.findIndex((e) => e.name === name);
  if (existingIdx >= 0) {
    entries[existingIdx] = { ...entries[existingIdx], updatedAt: now, handle };
  } else {
    entries.unshift({
      id: `rh_${now}_${Math.random().toString(36).slice(2, 8)}`,
      name,
      updatedAt: now,
      handle,
    });
  }

  // Cap at MAX_RECENT (LRU — keep most recent)
  entries.sort((a, b) => b.updatedAt - a.updatedAt);
  while (entries.length > MAX_RECENT) entries.pop();

  await idbPut(RECENT_KEY, entries);
}

export async function removeRecentHandle(id: string): Promise<void> {
  const entries = await getRecentHandles();
  const filtered = entries.filter((e) => e.id !== id);
  await idbPut(RECENT_KEY, filtered);
}

export async function clearAllRecentHandles(): Promise<void> {
  await idbDelete(RECENT_KEY);
}
