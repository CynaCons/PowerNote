import type { WorkspaceData } from '../types/data';
import { isFSASupported, writeToHandle, verifyPermission } from './fileSystemAccess';
import { getCurrentHandle } from './fileHandleStore';

const GITHUB_REPO = 'CynaCons/PowerNote';
const ASSET_NAME = 'PowerNote.html';

export interface UpdateInfo {
  available: boolean;
  latestVersion?: string;
  downloadUrl?: string;
  releaseUrl?: string;
}

/** Result of performUpdate — callers use mode for UI copy. */
export type UpdateMode = 'live-swap' | 'download';

export type PerformUpdateResult =
  | { ok: true; mode: UpdateMode }
  | { ok: false };

/**
 * Injectable deps for tests. Production uses the defaults below.
 */
export interface PerformUpdateDeps {
  fetchTemplate?: (downloadUrl: string) => Promise<string | null>;
  getHandle?: () => Promise<FileSystemFileHandle | null>;
  writeHandle?: (handle: FileSystemFileHandle, html: string) => Promise<boolean>;
  verifyWritePermission?: (handle: FileSystemFileHandle) => Promise<boolean>;
  reload?: () => void;
  download?: (content: string, filename: string) => void;
  buildBackupHtml?: (workspace: WorkspaceData) => Promise<string>;
  /** When false, skip live-swap even if a handle exists. Default: window flag. */
  isLiveUpdateEnabled?: () => boolean;
  /** Download a safety backup before overwriting the live file. Default: true. */
  downloadBackupBeforeLiveSwap?: boolean;
}

declare global {
  interface Window {
    /** Set to `false` to force download fallback (prototype / E2E). Default: enabled. */
    __POWERNOTE_LIVE_UPDATE__?: boolean;
  }
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
      downloadUrl: asset?.browser_download_url,
      releaseUrl: data.html_url,
    };
  } catch (err) {
    console.error('[PowerNote Update] Check failed:', err);
    return null;
  }
}

/**
 * Inject workspace JSON into a PowerNote HTML template (pure, testable).
 */
export function buildUpdatedHtml(templateHtml: string, workspace: WorkspaceData): string {
  const json = JSON.stringify(workspace, null, 2);
  const dataScript = `<script id="powernote-data" type="application/json">\n${json}\n</script>`;
  const existingPattern = /<script id="powernote-data"[^>]*>[\s\S]*?<\/script>/;
  if (existingPattern.test(templateHtml)) {
    return templateHtml.replace(existingPattern, dataScript);
  }
  if (templateHtml.includes('</head>')) {
    return templateHtml.replace('</head>', `${dataScript}\n</head>`);
  }
  return dataScript + templateHtml;
}

/** Live-update enabled unless explicitly disabled via window flag. */
export function isLiveUpdateEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  return window.__POWERNOTE_LIVE_UPDATE__ !== false;
}

/**
 * Try to fetch the PowerNote.html asset using multiple strategies.
 * GitHub's download URLs have CORS issues from file:// origins,
 * so we try several approaches in order.
 */
export async function fetchAssetHtml(downloadUrl: string): Promise<string | null> {
  // Strategy 1: Direct fetch of browser_download_url
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
  try {
    const match = downloadUrl.match(/repos\/([^/]+\/[^/]+)\/releases\/download/);
    const assetMatch = downloadUrl.match(/\/([^/]+)$/);
    if (match && assetMatch) {
      const repo = match[1];
      console.log('[PowerNote Update] Strategy 2: GitHub API asset endpoint');
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

  // Strategy 3: raw.githubusercontent.com dist-template
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
 * Perform update with A/B-style live-swap when possible:
 *   1. Fetch new template, inject workspace data
 *   2. If FSA handle + write permission + live-update enabled → write file + reload
 *   3. Else download backup + updated HTML (user opens manually)
 *
 * Prototype default: download a safety backup before live overwrite.
 */
export async function performUpdate(
  downloadUrl: string,
  workspace: WorkspaceData,
  currentVersion: string,
  newVersion: string,
  deps: PerformUpdateDeps = {},
): Promise<PerformUpdateResult> {
  console.log(`[PowerNote Update] Starting update ${currentVersion} → ${newVersion}...`);

  const fetchTemplate = deps.fetchTemplate ?? fetchAssetHtml;
  const getHandle = deps.getHandle ?? getCurrentHandle;
  const writeHandle = deps.writeHandle ?? writeToHandle;
  const verifyWrite = deps.verifyWritePermission
    ?? ((h: FileSystemFileHandle) => verifyPermission(h, true));
  const reload = deps.reload ?? (() => { window.location.reload(); });
  const download = deps.download ?? triggerDownload;
  const liveEnabled = deps.isLiveUpdateEnabled ?? isLiveUpdateEnabled;
  const backupBeforeLive = deps.downloadBackupBeforeLiveSwap !== false;

  const buildBackup = deps.buildBackupHtml ?? (async (ws: WorkspaceData) => {
    const { buildExportHtml } = await import('./serialization');
    return buildExportHtml(ws);
  });

  try {
    const safeName = workspace.filename.replace(/[^a-zA-Z0-9_\- ]/g, '_');

    console.log('[PowerNote Update] Downloading new version...');
    const newHtml = await fetchTemplate(downloadUrl);
    if (!newHtml) {
      console.error('[PowerNote Update] Could not download new version');
      return { ok: false };
    }

    const finalHtml = buildUpdatedHtml(newHtml, workspace);
    console.log(`[PowerNote Update] Built updated HTML (${finalHtml.length} bytes)`);

    // ── Live-swap path (FSA A/B) ─────────────────────────────
    if (liveEnabled() && isFSASupported()) {
      const handle = await getHandle();
      if (handle) {
        const canWrite = await verifyWrite(handle);
        if (canWrite) {
          if (backupBeforeLive) {
            console.log('[PowerNote Update] Saving safety backup before live-swap...');
            const backupHtml = await buildBackup(workspace);
            download(backupHtml, `${safeName} (v${currentVersion}_update-backup).html`);
          }

          console.log('[PowerNote Update] Live-swap: writing to current file handle...');
          const written = await writeHandle(handle, finalHtml);
          if (written) {
            console.log('[PowerNote Update] Live-swap write OK — reloading');
            reload();
            return { ok: true, mode: 'live-swap' };
          }
          console.warn('[PowerNote Update] Live-swap write failed — falling back to download');
        }
      }
    }

    // ── Download fallback ────────────────────────────────────
    console.log('[PowerNote Update] Download fallback path...');
    const backupHtml = await buildBackup(workspace);
    download(backupHtml, `${safeName} (v${currentVersion}_update-backup).html`);
    download(finalHtml, `${safeName} (v${newVersion}).html`);
    console.log('[PowerNote Update] Update complete — open the downloaded file to use the new version');
    return { ok: true, mode: 'download' };
  } catch (err) {
    console.error('[PowerNote Update] Update failed:', err);
    return { ok: false };
  }
}
