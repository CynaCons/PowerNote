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
      if (resp.status === 403) {
        console.warn('[PowerNote Update] GitHub API rate limited (403). Try again in a few minutes.');
      } else {
        console.warn(`[PowerNote Update] GitHub API returned ${resp.status}`);
      }
      return null;
    }

    const data = await resp.json();
    const latest = (data.tag_name || '').replace(/^v/, '');
    console.log(`[PowerNote Update] Latest release tag: ${data.tag_name} → version: ${latest}`);
    console.log(`[PowerNote Update] Assets found: ${data.assets?.length ?? 0}`);

    if (!latest) {
      console.warn('[PowerNote Update] No version found in tag_name');
      return null;
    }

    if (latest === currentVersion) {
      console.log('[PowerNote Update] Already up to date');
      return { available: false };
    }

    const asset = data.assets?.find((a: any) => a.name === ASSET_NAME);
    console.log(`[PowerNote Update] Asset ID: ${asset?.id ?? 'NOT FOUND'}`);
    console.log(`[PowerNote Update] browser_download_url: ${asset?.browser_download_url ?? 'NONE'}`);
    console.log(`[PowerNote Update] Release URL: ${data.html_url}`);

    return {
      available: true,
      latestVersion: latest,
      // Store both URLs — we'll try multiple download strategies
      downloadUrl: asset?.browser_download_url,
      releaseUrl: data.html_url,
    };
  } catch (err) {
    console.error('[PowerNote Update] Check failed:', err);
    return null;
  }
}

/**
 * Try to fetch the PowerNote.html asset using multiple strategies.
 * GitHub's download URLs have CORS issues from file:// origins,
 * so we try several approaches in order.
 */
async function fetchAssetHtml(downloadUrl: string): Promise<string | null> {
  // Strategy 1: Direct fetch of browser_download_url
  // Works from http:// origins, may fail from file://
  console.log('[PowerNote Update] Strategy 1: direct fetch');
  try {
    const resp = await fetch(downloadUrl);
    if (resp.ok) {
      const text = await resp.text();
      if (text.includes('<div id="root">')) {
        console.log(`[PowerNote Update] Strategy 1 succeeded (${text.length} bytes)`);
        return text;
      }
    }
  } catch (err) {
    console.log('[PowerNote Update] Strategy 1 failed:', err);
  }

  // Strategy 2: Use GitHub API asset endpoint with octet-stream
  // The API itself has CORS, but it 302-redirects to a CDN that might not
  try {
    const match = downloadUrl.match(/repos\/([^/]+\/[^/]+)\/releases\/download/);
    const assetMatch = downloadUrl.match(/\/([^/]+)$/);
    if (match && assetMatch) {
      const repo = match[1];
      console.log('[PowerNote Update] Strategy 2: GitHub API asset endpoint');
      // First get the release to find asset ID
      const releaseResp = await fetch(`https://api.github.com/repos/${repo}/releases/latest`, {
        headers: { Accept: 'application/vnd.github.v3+json' },
      });
      if (releaseResp.ok) {
        const releaseData = await releaseResp.json();
        const asset = releaseData.assets?.find((a: any) => a.name === ASSET_NAME);
        if (asset?.id) {
          const assetResp = await fetch(
            `https://api.github.com/repos/${repo}/releases/assets/${asset.id}`,
            { headers: { Accept: 'application/octet-stream' } }
          );
          if (assetResp.ok) {
            const text = await assetResp.text();
            if (text.includes('<div id="root">')) {
              console.log(`[PowerNote Update] Strategy 2 succeeded (${text.length} bytes)`);
              return text;
            }
            console.log('[PowerNote Update] Strategy 2: response is not valid HTML');
          }
        }
      }
    }
  } catch (err) {
    console.log('[PowerNote Update] Strategy 2 failed:', err);
  }

  // Strategy 3: Use raw.githubusercontent.com to fetch dist-template from main branch
  // This bypasses the release system but gets the latest built template
  console.log('[PowerNote Update] Strategy 3: raw.githubusercontent.com');
  try {
    const resp = await fetch(
      `https://raw.githubusercontent.com/${GITHUB_REPO}/main/dist-template/index.html`
    );
    if (resp.ok) {
      const text = await resp.text();
      if (text.includes('<div id="root">')) {
        console.log(`[PowerNote Update] Strategy 3 succeeded (${text.length} bytes)`);
        return text;
      }
    }
  } catch (err) {
    console.log('[PowerNote Update] Strategy 3 failed:', err);
  }

  console.error('[PowerNote Update] All download strategies failed');
  return null;
}

/**
 * Download a file to the user's machine.
 */
function triggerDownload(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Perform update: saves a backup of current notebook, then downloads
 * the new version with user data injected. User opens the downloaded file.
 *
 * Hot-swap via document.write/Blob URL doesn't work because browsers'
 * HTML parsers choke on the minified JS bundle. Download is the only
 * reliable approach for self-contained HTML files.
 */
export async function performUpdate(
  downloadUrl: string,
  workspace: WorkspaceData,
  currentVersion: string,
  newVersion: string,
): Promise<boolean> {
  console.log(`[PowerNote Update] Starting update ${currentVersion} → ${newVersion}...`);
  try {
    // Step 1: Save backup of current notebook
    console.log('[PowerNote Update] Saving backup...');
    const { buildExportHtml } = await import('./serialization');
    const backupHtml = await buildExportHtml(workspace);
    const safeName = workspace.filename.replace(/[^a-zA-Z0-9_\- ]/g, '_');
    triggerDownload(backupHtml, `${safeName} (v${currentVersion}_update-backup).html`);

    // Step 2: Download new template
    console.log('[PowerNote Update] Downloading new version...');
    const newHtml = await fetchAssetHtml(downloadUrl);
    if (!newHtml) {
      console.error('[PowerNote Update] Could not download new version');
      return false;
    }

    // Step 3: Inject user data into new template
    const json = JSON.stringify(workspace, null, 2);
    console.log(`[PowerNote Update] Workspace JSON size: ${json.length} bytes`);
    const dataScript = `<script id="powernote-data" type="application/json">\n${json}\n</script>`;

    let finalHtml: string;
    const existingPattern = /<script id="powernote-data"[^>]*>[\s\S]*?<\/script>/;
    if (existingPattern.test(newHtml)) {
      finalHtml = newHtml.replace(existingPattern, dataScript);
    } else {
      finalHtml = newHtml.replace('</head>', `${dataScript}\n</head>`);
    }

    // Step 4: Download the updated notebook
    console.log(`[PowerNote Update] Downloading updated notebook (${finalHtml.length} bytes)...`);
    triggerDownload(finalHtml, `${safeName} (v${newVersion}).html`);

    console.log('[PowerNote Update] Update complete — open the downloaded file to use the new version');
    return true;
  } catch (err) {
    console.error('[PowerNote Update] Update failed:', err);
    return false;
  }
}
