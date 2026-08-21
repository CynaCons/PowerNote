/**
 * IndexedDB persistence for extension assets.
 *
 * localStorage would work for strings, but a ~1.1 MB base64 payload eats a
 * fifth of its quota — which the notebook library already leans on. IDB has
 * no such pressure, and this mirrors fileHandleStore's schema so the two
 * stores read the same way.
 *
 * Schema:
 *   DB: 'powernote-extensions'
 *   Store: 'kv' (key-value)
 *     - 'asset:drawio-viewer' → CachedExtensionAsset
 *
 * Every failure degrades to null/no-op with a console.warn — a private-mode
 * browser without IDB costs the cache tier, never the feature.
 */

const DB_NAME = 'powernote-extensions';
const DB_VERSION = 1;
const STORE = 'kv';

export interface CachedExtensionAsset {
  /** deflate-raw + base64 payload, exactly as vendored. */
  base64: string;
  /** Upstream version of the asset (drawio release). */
  version: string;
  savedAt: number;
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

export async function getCachedAsset(key: string): Promise<CachedExtensionAsset | null> {
  try {
    const db = await openDB();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(`asset:${key}`);
      req.onsuccess = () => resolve((req.result as CachedExtensionAsset) ?? null);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('[ExtensionStore] getCachedAsset failed:', err);
    return null;
  }
}

export async function putCachedAsset(key: string, asset: CachedExtensionAsset): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(asset, `asset:${key}`);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('[ExtensionStore] putCachedAsset failed:', err);
  }
}

export async function deleteCachedAsset(key: string): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(`asset:${key}`);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('[ExtensionStore] deleteCachedAsset failed:', err);
  }
}
