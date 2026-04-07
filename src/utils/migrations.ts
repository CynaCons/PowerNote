import type { WorkspaceData } from '../types/data';
import { APP_VERSION } from '../version';

/**
 * Registry of data migrations keyed by the version they upgrade FROM.
 * Each migration transforms the workspace data to be compatible with the next version.
 * Add entries here when the data schema changes between releases.
 */
const migrations: Record<string, (data: any) => any> = {
  // Example:
  // '0.15.0': (data) => { /* transform data from 0.15 → 0.16 format */ return data; },
};

/**
 * Compare two semver strings. Returns -1, 0, or 1.
 */
function compareSemver(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) < (pb[i] || 0)) return -1;
    if ((pa[i] || 0) > (pb[i] || 0)) return 1;
  }
  return 0;
}

/**
 * Migrate workspace data from its embedded version to the current app version.
 * Applies all registered migrations in sequence.
 * Safe to call even if data is already current — it will just stamp the version.
 */
export function migrateWorkspace(data: WorkspaceData): WorkspaceData {
  const fromVersion = data.editorVersion || '0.0.0';

  if (compareSemver(fromVersion, APP_VERSION) >= 0) {
    // Already current or newer — just ensure version is stamped
    return { ...data, editorVersion: APP_VERSION };
  }

  // Apply migrations in version order
  let migrated = { ...data };
  const sortedVersions = Object.keys(migrations).sort(compareSemver);

  for (const ver of sortedVersions) {
    if (compareSemver(fromVersion, ver) < 0 && compareSemver(ver, APP_VERSION) <= 0) {
      migrated = migrations[ver](migrated);
    }
  }

  migrated.editorVersion = APP_VERSION;
  return migrated;
}
