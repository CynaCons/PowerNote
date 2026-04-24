import type { WorkspaceData } from '../types/data';

const DATA_SCRIPT_ID = 'powernote-data';
const LEGACY_AUTOSAVE_KEY = 'powernote-autosave';
const AUTOSAVE_DEBOUNCE_MS = 1_500;
const AUTOSAVE_MAX_WAIT_MS = 5_000;

/**
 * Serialize workspace data to a JSON string
 */
export function serializeWorkspace(workspace: WorkspaceData): string {
  return JSON.stringify(workspace, null, 2);
}

/**
 * Deserialize workspace data from a JSON string
 */
export function deserializeWorkspace(json: string): WorkspaceData | null {
  try {
    const data = JSON.parse(json);
    if (!data.version || !data.sections) return null;
    return data as WorkspaceData;
  } catch {
    return null;
  }
}

/**
 * Check if the current document has embedded PowerNote data
 */
export function getEmbeddedData(): WorkspaceData | null {
  const scriptTag = document.getElementById(DATA_SCRIPT_ID);
  if (!scriptTag) return null;
  const json = scriptTag.textContent?.trim();
  if (!json) return null;
  return deserializeWorkspace(json);
}

/**
 * Build a self-contained HTML file with the app bundle + embedded data.
 *
 * In PRODUCTION (standalone HTML): uses document.documentElement.outerHTML
 * since JS/CSS are already inlined.
 *
 * In DEV: fetches the pre-built single-file template from dist-template/
 * and injects the user data into it.
 */
export async function buildExportHtml(workspace: WorkspaceData): Promise<string> {
  const json = serializeWorkspace(workspace);
  const dataScript = `<script id="${DATA_SCRIPT_ID}" type="application/json">\n${json}\n</script>`;

  let html: string;

  // Detect dev mode: import.meta.env exists in Vite dev, but is {} in IIFE builds
  const isDev = typeof import.meta !== 'undefined'
    && import.meta.env
    && import.meta.env.DEV;

  if (isDev) {
    // In dev mode: fetch the pre-built production template
    try {
      const resp = await fetch('/dist-template/index.html');
      if (!resp.ok) throw new Error(`Template fetch failed: ${resp.status}`);
      html = await resp.text();
    } catch (e) {
      console.error('Failed to fetch export template. Run: npm run build:template', e);
      // Fallback: use current page HTML (won't work standalone but preserves data)
      html = document.documentElement.outerHTML;
    }
  } else {
    // In production (standalone HTML): current page IS the bundled app
    html = document.documentElement.outerHTML;
  }

  // Replace existing data script or insert before </head>
  const existingPattern = /<script id="powernote-data" type="application\/json">[\s\S]*?<\/script>/;
  if (existingPattern.test(html)) {
    return html.replace(existingPattern, dataScript);
  }

  // Ensure we have <!DOCTYPE html> at the start
  const doctype = html.startsWith('<!') ? '' : '<!DOCTYPE html>\n';
  return doctype + html.replace('</head>', `${dataScript}\n</head>`);
}

/**
 * Trigger a file download in the browser
 */
export function downloadFile(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * Read an HTML file and extract embedded PowerNote data
 */
export function extractDataFromHtml(htmlContent: string): WorkspaceData | null {
  const match = htmlContent.match(
    /<script id="powernote-data" type="application\/json">([\s\S]*?)<\/script>/
  );
  if (!match) return null;
  return deserializeWorkspace(match[1].trim());
}

// ─── Auto-Save ───────────────────────────────────────────────

/**
 * Remove any legacy `powernote-autosave` localStorage snapshot. Older builds
 * used to write the full workspace here; current builds persist via the
 * File System Access handle + notebook library instead. Called once on
 * startup so upgraded installs do not keep stale state around.
 */
export function clearLegacyAutoSave(): void {
  try {
    localStorage.removeItem(LEGACY_AUTOSAVE_KEY);
  } catch {
    // ignored — quota/privacy errors are non-fatal here
  }
}

/**
 * Start the auto-save pipeline. Returns a cleanup function.
 *
 * Cadence:
 *   - Saves 1.5 s after the last edit (debounced).
 *   - If edits keep arriving, saves are forced no later than 5 s after the
 *     notebook first became dirty (max-wait safety net).
 *
 * Destinations (when available):
 *   - Notebook library (localStorage, user-browsable, up to 5 entries).
 *   - Live file on disk via the current `FileSystemFileHandle`, but only
 *     when read-write permission is already granted (no silent prompts).
 *
 * `subscribeToChanges` is invoked with a handler that should fire on any
 * workspace-affecting store update; the returned function is used to
 * unsubscribe on cleanup.
 */
export function startAutoSave(
  flushAndGetWorkspace: () => WorkspaceData,
  getIsDirty: () => boolean,
  subscribeToChanges: (onChange: () => void) => () => void,
): () => void {
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let firstDirtyAt: number | null = null;
  let saveInFlight = false;

  const runSave = async () => {
    debounceTimer = null;
    firstDirtyAt = null;
    if (saveInFlight || !getIsDirty()) return;
    saveInFlight = true;
    try {
      const workspace = flushAndGetWorkspace();

      const { saveToLibrary } = await import('./notebookLibrary');
      saveToLibrary(workspace);

      try {
        const { isFSASupported } = await import('./fileSystemAccess');
        if (isFSASupported()) {
          const { getCurrentHandle } = await import('./fileHandleStore');
          const handle = await getCurrentHandle();
          if (handle) {
            const perm = await (handle as any).queryPermission?.({ mode: 'readwrite' });
            if (perm === 'granted') {
              const html = await buildExportHtml(workspace);
              const writable = await handle.createWritable();
              await writable.write(html);
              await writable.close();
              if (import.meta.env?.DEV) {
                console.log('[PowerNote] Auto-saved to file via FSA handle');
              }
            }
          }
        }
      } catch (err) {
        if (import.meta.env?.DEV) {
          console.log('[PowerNote] FSA autosave skipped:', err);
        }
      }

      if (import.meta.env?.DEV) {
        console.log('[PowerNote] Auto-saved to library');
      }
    } finally {
      saveInFlight = false;
    }
  };

  const scheduleSave = () => {
    if (!getIsDirty()) return;
    const now = Date.now();
    if (firstDirtyAt == null) firstDirtyAt = now;
    const elapsed = now - firstDirtyAt;
    const delay = Math.max(0, Math.min(AUTOSAVE_DEBOUNCE_MS, AUTOSAVE_MAX_WAIT_MS - elapsed));
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(runSave, delay);
  };

  const unsubscribe = subscribeToChanges(scheduleSave);

  return () => {
    unsubscribe();
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
  };
}
