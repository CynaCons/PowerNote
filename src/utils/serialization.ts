import type { WorkspaceData } from '../types/data';

const DATA_SCRIPT_ID = 'powernote-data';

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
