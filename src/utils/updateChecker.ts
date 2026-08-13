import type { WorkspaceData } from '../types/data';
import { isFSASupported, writeToHandle, verifyPermission } from './fileSystemAccess';
import { getCurrentHandle } from './fileHandleStore';

const GITHUB_REPO = 'CynaCons/PowerNote';
const ASSET_NAME = 'PowerNote.html';

/**
 * How long a check is trusted before asking GitHub again.
 *
 * api.github.com allows 60 unauthenticated requests an hour PER IP, and the
 * check fires on every page load. Without a cache, opening a handful of
 * notebooks — or running a test suite that loads the app hundreds of times —
 * exhausts the quota for everything else on that IP, and the user sees 403.
 */
const CHECK_CACHE_KEY = 'powernote-update-check';
const CHECK_CACHE_MS = 6 * 60 * 60 * 1000;

function readCachedCheck(currentVersion: string): UpdateInfo | null {
  try {
    const raw = localStorage.getItem(CHECK_CACHE_KEY);
    if (!raw) return null;
    const entry = JSON.parse(raw);
    if (entry.forVersion !== currentVersion) return null;
    if (Date.now() - entry.at > CHECK_CACHE_MS) return null;
    return entry.info as UpdateInfo;
  } catch {
    return null;
  }
}

function writeCachedCheck(currentVersion: string, info: UpdateInfo): void {
  try {
    localStorage.setItem(
      CHECK_CACHE_KEY,
      JSON.stringify({ at: Date.now(), forVersion: currentVersion, info }),
    );
  } catch {
    // A full or blocked localStorage costs us the cache, not the check.
  }
}

/**
 * Automation loads the app over and over, and each load would spend one of the
 * hour's 60 requests. `navigator.webdriver` is set by every driver, so this
 * needs no cooperation from the tests themselves.
 */
function isAutomated(): boolean {
  return typeof navigator !== 'undefined' && navigator.webdriver === true;
}

/**
 * The version on main, read from a host that is not API-rate-limited.
 *
 * Used when the API says 403. The release flow bumps the version and tags in
 * one go, so main's version is the newest release's version.
 */
async function latestVersionFromRaw(): Promise<string | null> {
  try {
    const resp = await fetch(
      `https://raw.githubusercontent.com/${GITHUB_REPO}/main/package.json`,
      { cache: 'no-cache' },
    );
    if (!resp.ok) return null;
    const pkg = await resp.json();
    return typeof pkg.version === 'string' ? pkg.version : null;
  } catch {
    return null;
  }
}

export interface UpdateInfo {
  available: boolean;
  latestVersion?: string;
  downloadUrl?: string;
  releaseUrl?: string;
  /** Release tag, e.g. "v0.36.0". The download is pinned to it — see fetchAssetHtml. */
  tag?: string;
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
  fetchTemplate?: (downloadUrl: string, tag?: string) => Promise<string | null>;
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
 * Compare dotted numeric versions. Returns >0 when `a` is newer than `b`.
 * Non-numeric suffixes are ignored — good enough for the x.y.z tags we ship.
 */
export function compareVersions(a: string, b: string): number {
  const parts = (v: string) =>
    v.split('.').map((p) => Number.parseInt(p, 10) || 0);
  const av = parts(a);
  const bv = parts(b);
  for (let i = 0; i < Math.max(av.length, bv.length); i++) {
    const diff = (av[i] ?? 0) - (bv[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

/**
 * Check GitHub for a newer release of PowerNote.
 * Returns null if the check fails (offline, CORS blocked, etc.)
 */
export async function checkForUpdate(
  currentVersion: string,
  options: { force?: boolean } = {},
): Promise<UpdateInfo | null> {
  if (isAutomated() && !options.force) return null;

  if (!options.force) {
    const cached = readCachedCheck(currentVersion);
    if (cached) {
      console.log('[PowerNote Update] Using cached check (refreshes every 6h)');
      return cached;
    }
  }

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
        console.warn(
          '[PowerNote Update] GitHub API rate limited (403) — falling back to raw.githubusercontent.com, ' +
          'which has no API quota.',
        );
        const raw = await latestVersionFromRaw();
        if (raw) {
          const info: UpdateInfo =
            compareVersions(raw, currentVersion) > 0
              ? { available: true, latestVersion: raw, tag: `v${raw}` }
              : { available: false, latestVersion: raw };
          writeCachedCheck(currentVersion, info);
          return info;
        }
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

    // Only a strictly NEWER release counts. Plain inequality would treat a
    // local build that runs ahead of the published tag as an available
    // "update" and offer to install an older one over it.
    if (compareVersions(latest, currentVersion) <= 0) {
      console.log(
        `[PowerNote Update] Already up to date (running ${currentVersion}, latest release ${latest})`,
      );
      const upToDate: UpdateInfo = { available: false, latestVersion: latest };
      writeCachedCheck(currentVersion, upToDate);
      return upToDate;
    }

    const asset = data.assets?.find((a: any) => a.name === ASSET_NAME);
    console.log(`[PowerNote Update] Asset ID: ${asset?.id ?? 'NOT FOUND'}`);
    console.log(`[PowerNote Update] browser_download_url: ${asset?.browser_download_url ?? 'NONE'}`);
    console.log(`[PowerNote Update] Release URL: ${data.html_url}`);

    const info: UpdateInfo = {
      available: true,
      latestVersion: latest,
      downloadUrl: asset?.browser_download_url,
      releaseUrl: data.html_url,
      tag: data.tag_name,
    };
    writeCachedCheck(currentVersion, info);
    return info;
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
/**
 * Downloads the new build.
 *
 * Order matters, and it is not the obvious one. GitHub does NOT send CORS
 * headers on release-asset downloads: `browser_download_url` 302s to
 * objects.githubusercontent.com, and so does the API's octet-stream asset
 * endpoint, and neither response carries `Access-Control-Allow-Origin`. From a
 * page — which is all PowerNote ever is — both fail with a bare "TypeError:
 * Failed to fetch". They are kept only as fallbacks in case that ever changes.
 *
 * raw.githubusercontent.com does send `Access-Control-Allow-Origin: *`, and the
 * built single-file app is committed at `dist-template/index.html`, so fetching
 * it AT THE RELEASE TAG is the path that actually works. Pinning to the tag
 * rather than `main` matters: main can be ahead of the newest release, and an
 * update must install the version it just told the user about.
 */
export async function fetchAssetHtml(
  downloadUrl: string,
  tag?: string,
): Promise<string | null> {
  const looksRight = (text: string) => text.includes('<div id="root">');

  // Strategy 1: the committed build at the release tag. The only CORS-clean route.
  if (tag) {
    const rawUrl = `https://raw.githubusercontent.com/${GITHUB_REPO}/${tag}/dist-template/index.html`;
    console.log(`[PowerNote Update] Strategy 1: ${rawUrl}`);
    try {
      const resp = await fetch(rawUrl);
      if (resp.ok) {
        const text = await resp.text();
        if (looksRight(text)) {
          console.log(`[PowerNote Update] Strategy 1 succeeded (${text.length} bytes)`);
          return text;
        }
        console.warn('[PowerNote Update] Strategy 1: response is not a PowerNote build');
      } else {
        console.warn(`[PowerNote Update] Strategy 1 returned ${resp.status}`);
      }
    } catch (err) {
      console.log('[PowerNote Update] Strategy 1 failed:', err);
    }
  }

  // Strategy 2: the release asset. Expected to fail on CORS; kept as a fallback.
  if (downloadUrl) {
    console.log('[PowerNote Update] Strategy 2: direct asset fetch');
    try {
      const resp = await fetch(downloadUrl);
      if (resp.ok) {
        const text = await resp.text();
        if (looksRight(text)) {
          console.log(`[PowerNote Update] Strategy 2 succeeded (${text.length} bytes)`);
          return text;
        }
      }
    } catch (err) {
      console.log('[PowerNote Update] Strategy 2 failed (expected — GitHub sends no CORS header on assets):', err);
    }
  }

  // Strategy 3: main. Last resort only — it can be ahead of the newest release,
  // so it may install something that was never released.
  console.log('[PowerNote Update] Strategy 3: raw.githubusercontent.com @ main');
  try {
    const resp = await fetch(
      `https://raw.githubusercontent.com/${GITHUB_REPO}/main/dist-template/index.html`,
    );
    if (resp.ok) {
      const text = await resp.text();
      if (looksRight(text)) {
        console.warn(
          '[PowerNote Update] Strategy 3 succeeded, but this is main rather than the ' +
          'release — the installed build may be ahead of the version reported.',
        );
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
  tag?: string,
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
    const newHtml = await fetchTemplate(downloadUrl, tag ?? `v${newVersion}`);
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
