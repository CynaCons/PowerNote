import type { WorkspaceData } from '../types/data';
import { generateId } from './ids';

const LIBRARY_KEY = 'powernote-library';
const MAX_ENTRIES = 5;

export interface LibraryEntry {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  workspace: WorkspaceData;
}

/**
 * Load all library entries from localStorage.
 * Returns sorted by updatedAt descending (most recent first).
 */
export function loadLibrary(): LibraryEntry[] {
  try {
    const json = localStorage.getItem(LIBRARY_KEY);
    if (!json) return [];
    const entries = JSON.parse(json) as LibraryEntry[];
    if (!Array.isArray(entries)) return [];
    return entries.sort((a, b) => b.updatedAt - a.updatedAt);
  } catch {
    return [];
  }
}

/**
 * Save (upsert) a workspace to the library.
 * - If an entry with the same `name` exists, update it.
 * - Otherwise create a new entry.
 * - Caps at MAX_ENTRIES via LRU (oldest updatedAt evicted).
 */
export function saveToLibrary(workspace: WorkspaceData): LibraryEntry | null {
  try {
    const entries = loadLibrary();
    const now = Date.now();
    const existingIdx = entries.findIndex((e) => e.name === workspace.filename);

    let updated: LibraryEntry;
    if (existingIdx >= 0) {
      updated = {
        ...entries[existingIdx],
        updatedAt: now,
        workspace,
      };
      entries[existingIdx] = updated;
    } else {
      updated = {
        id: generateId(),
        name: workspace.filename,
        createdAt: now,
        updatedAt: now,
        workspace,
      };
      entries.push(updated);
    }

    // Enforce cap — evict oldest
    entries.sort((a, b) => b.updatedAt - a.updatedAt);
    while (entries.length > MAX_ENTRIES) {
      entries.pop();
    }

    localStorage.setItem(LIBRARY_KEY, JSON.stringify(entries));
    return updated;
  } catch (err) {
    console.warn('[NotebookLibrary] Save failed:', err);
    return null;
  }
}

/**
 * Delete a library entry by id.
 */
export function deleteFromLibrary(id: string): void {
  try {
    const entries = loadLibrary();
    const filtered = entries.filter((e) => e.id !== id);
    localStorage.setItem(LIBRARY_KEY, JSON.stringify(filtered));
  } catch (err) {
    console.warn('[NotebookLibrary] Delete failed:', err);
  }
}

/**
 * Get a single library entry by id.
 */
export function getLibraryEntry(id: string): LibraryEntry | null {
  const entries = loadLibrary();
  return entries.find((e) => e.id === id) || null;
}

/**
 * Format a timestamp as "2 hours ago", "just now", etc.
 */
export function formatRelativeTime(timestamp: number): string {
  const delta = Date.now() - timestamp;
  const sec = Math.floor(delta / 1000);
  if (sec < 60) return 'just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} min${min !== 1 ? 's' : ''} ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hour${hr !== 1 ? 's' : ''} ago`;
  const days = Math.floor(hr / 24);
  if (days < 7) return `${days} day${days !== 1 ? 's' : ''} ago`;
  return new Date(timestamp).toLocaleDateString();
}
