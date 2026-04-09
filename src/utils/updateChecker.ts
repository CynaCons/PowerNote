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
  console.log(`[PowerNote Update] Checking for updates... current version: ${currentVersion}`);
  try {
    const url = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;
    console.log(`[PowerNote Update] Fetching: ${url}`);
    const resp = await fetch(url, {
      headers: { Accept: 'application/vnd.github.v3+json' },
    });
    console.log(`[PowerNote Update] Response status: ${resp.status}`);
    if (!resp.ok) {
      console.warn(`[PowerNote Update] GitHub API returned ${resp.status}`);
      return null;
    }

    const data = await resp.json();
    const latest = (data.tag_name || '').replace(/^v/, '');
    console.log(`[PowerNote Update] Latest release tag: ${data.tag_name} → version: ${latest}`);
    console.log(`[PowerNote Update] Assets found: ${data.assets?.length ?? 0}`);
    data.assets?.forEach((a: any) => console.log(`[PowerNote Update]   - ${a.name}: ${a.browser_download_url}`));

    if (!latest) {
      console.warn('[PowerNote Update] No version found in tag_name');
      return null;
    }

    if (latest === currentVersion) {
      console.log('[PowerNote Update] Already up to date');
      return { available: false };
    }

    const asset = data.assets?.find((a: any) => a.name === ASSET_NAME);
    console.log(`[PowerNote Update] Update available: ${currentVersion} → ${latest}`);
    console.log(`[PowerNote Update] Asset ID: ${asset?.id ?? 'NOT FOUND'}`);
    console.log(`[PowerNote Update] Release URL: ${data.html_url}`);

    // Use the GitHub API asset endpoint (supports CORS) instead of browser_download_url (no CORS)
    const apiDownloadUrl = asset?.id
      ? `https://api.github.com/repos/${GITHUB_REPO}/releases/assets/${asset.id}`
      : undefined;
    console.log(`[PowerNote Update] API download URL: ${apiDownloadUrl ?? 'NONE'}`);

    return {
      available: true,
      latestVersion: latest,
      downloadUrl: apiDownloadUrl,
      releaseUrl: data.html_url,
    };
  } catch (err) {
    console.error('[PowerNote Update] Check failed:', err);
    return null;
  }
}

/**
 * Hot-swap the current page with a new version of PowerNote.
 */
export async function performUpdate(
  downloadUrl: string,
  workspace: WorkspaceData
): Promise<boolean> {
  console.log(`[PowerNote Update] Starting hot-swap update...`);
  console.log(`[PowerNote Update] Downloading via API: ${downloadUrl}`);
  try {
    // Use Accept: application/octet-stream to get the raw file content from the API
    const resp = await fetch(downloadUrl, {
      headers: { Accept: 'application/octet-stream' },
    });
    console.log(`[PowerNote Update] Download status: ${resp.status}`);
    if (!resp.ok) {
      console.error(`[PowerNote Update] Download failed: ${resp.status} ${resp.statusText}`);
      return false;
    }

    let newHtml = await resp.text();
    console.log(`[PowerNote Update] Downloaded HTML size: ${newHtml.length} bytes`);

    if (!newHtml.includes('<div id="root">')) {
      console.error('[PowerNote Update] Downloaded file does not contain <div id="root"> — not a valid PowerNote.html');
      console.log(`[PowerNote Update] First 500 chars: ${newHtml.substring(0, 500)}`);
      return false;
    }

    // Inject current workspace data into new template
    const json = JSON.stringify(workspace, null, 2);
    console.log(`[PowerNote Update] Workspace JSON size: ${json.length} bytes`);
    const dataScript = `<script id="powernote-data" type="application/json">\n${json}\n</script>`;

    const existingPattern = /<script id="powernote-data"[^>]*>[\s\S]*?<\/script>/;
    if (existingPattern.test(newHtml)) {
      console.log('[PowerNote Update] Replacing existing data script in new HTML');
      newHtml = newHtml.replace(existingPattern, dataScript);
    } else {
      console.log('[PowerNote Update] Injecting data script before </head>');
      newHtml = newHtml.replace('</head>', `${dataScript}\n</head>`);
    }

    console.log(`[PowerNote Update] Final HTML size: ${newHtml.length} bytes`);
    console.log('[PowerNote Update] Performing document.write() hot-swap...');

    // Hot-swap the page
    document.open();
    document.write(newHtml);
    document.close();
    return true;
  } catch (err) {
    console.error('[PowerNote Update] Hot-swap failed:', err);
    return false;
  }
}
