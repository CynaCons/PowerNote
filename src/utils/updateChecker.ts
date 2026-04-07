import type { WorkspaceData } from '../types/data';

const GITHUB_REPO = 'CynaCons/PowerNote';
const ASSET_NAME = 'PowerNote.html';

interface UpdateInfo {
  available: boolean;
  latestVersion?: string;
  downloadUrl?: string;
  releaseUrl?: string;
}

/**
 * Check GitHub for a newer release of PowerNote.
 * Returns null if the check fails (offline, CORS blocked, etc.)
 */
export async function checkForUpdate(currentVersion: string): Promise<UpdateInfo | null> {
  try {
    const resp = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`,
      { headers: { Accept: 'application/vnd.github.v3+json' } }
    );
    if (!resp.ok) return null;

    const data = await resp.json();
    const latest = (data.tag_name || '').replace(/^v/, '');
    if (!latest) return null;

    if (latest === currentVersion) {
      return { available: false };
    }

    const asset = data.assets?.find((a: any) => a.name === ASSET_NAME);

    return {
      available: true,
      latestVersion: latest,
      downloadUrl: asset?.browser_download_url,
      releaseUrl: data.html_url,
    };
  } catch {
    return null; // Offline or fetch blocked
  }
}

/**
 * Hot-swap the current page with a new version of PowerNote.
 * Fetches the new PowerNote.html, injects the user's workspace data,
 * and replaces the entire document.
 *
 * Returns false if the update fails (user stays on current version).
 */
export async function performUpdate(
  downloadUrl: string,
  workspace: WorkspaceData
): Promise<boolean> {
  try {
    const resp = await fetch(downloadUrl);
    if (!resp.ok) return false;

    let newHtml = await resp.text();
    if (!newHtml.includes('<div id="root">')) return false; // sanity check

    // Inject current workspace data into new template
    const json = JSON.stringify(workspace, null, 2);
    const dataScript = `<script id="powernote-data" type="application/json">\n${json}\n</script>`;

    const existingPattern = /<script id="powernote-data"[^>]*>[\s\S]*?<\/script>/;
    if (existingPattern.test(newHtml)) {
      newHtml = newHtml.replace(existingPattern, dataScript);
    } else {
      newHtml = newHtml.replace('</head>', `${dataScript}\n</head>`);
    }

    // Hot-swap the page — new editor boots with user's data
    document.open();
    document.write(newHtml);
    document.close();
    return true;
  } catch {
    return false;
  }
}
