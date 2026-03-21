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
 * Uses the current page's HTML as the template and injects/replaces the data.
 */
export async function buildExportHtml(workspace: WorkspaceData): Promise<string> {
  // Get the current page's full HTML
  const html = document.documentElement.outerHTML;
  const json = serializeWorkspace(workspace);

  const dataScript = `<script id="${DATA_SCRIPT_ID}" type="application/json">\n${json}\n</script>`;

  // Check if there's already an embedded data script
  const existingPattern = /<script id="powernote-data" type="application\/json">[\s\S]*?<\/script>/;
  if (existingPattern.test(html)) {
    // Replace existing data
    return '<!DOCTYPE html>\n<html>' +
      html.replace(existingPattern, dataScript) +
      '</html>';
  }

  // Insert before </head>
  return '<!DOCTYPE html>\n' +
    html.replace('</head>', `${dataScript}\n</head>`);
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
