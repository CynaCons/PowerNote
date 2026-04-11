import type { WorkspaceData } from '../types/data';

const DATA_SCRIPT_ID = 'powernote-data';
const AUTOSAVE_KEY = 'powernote-autosave';
const AUTOSAVE_INTERVAL_MS = 30_000; // 30 seconds

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

// ─── Auto-Save to localStorage ───────────────────────────────

/**
 * Save workspace to localStorage
 */
export function autoSaveToLocalStorage(workspace: WorkspaceData): void {
  try {
    localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(workspace));
  } catch (e) {
    console.warn('Auto-save failed (storage full?):', e);
  }
}

/**
 * Load workspace from localStorage (if available)
 */
export function loadFromLocalStorage(): WorkspaceData | null {
  try {
    const json = localStorage.getItem(AUTOSAVE_KEY);
    if (!json) return null;
    return deserializeWorkspace(json);
  } catch {
    return null;
  }
}

/**
 * Clear auto-save from localStorage (call after successful file export)
 */
export function clearAutoSave(): void {
  localStorage.removeItem(AUTOSAVE_KEY);
}

/**
 * Start the auto-save interval. Returns a cleanup function to stop it.
 * flushAndGetWorkspace should flush active page nodes/strokes to workspace
 * and return the full workspace data.
 *
 * Saves to BOTH `powernote-autosave` (single snapshot, restored on next load)
 * AND the notebook library (up to 5 recent notebooks, user-browsable).
 */
export function startAutoSave(
  flushAndGetWorkspace: () => WorkspaceData,
  getIsDirty: () => boolean,
): () => void {
  const interval = setInterval(() => {
    if (!getIsDirty()) return;
    const workspace = flushAndGetWorkspace();
    autoSaveToLocalStorage(workspace);

    // Also save to notebook library (Word-style continuous autosave)
    import('./notebookLibrary').then(({ saveToLibrary }) => {
      saveToLibrary(workspace);
    });

    if (import.meta.env?.DEV) {
      console.log('[PowerNote] Auto-saved to localStorage + library');
    }
  }, AUTOSAVE_INTERVAL_MS);

  return () => clearInterval(interval);
}
