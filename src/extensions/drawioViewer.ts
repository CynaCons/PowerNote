/**
 * Loader for the draw.io viewer extension.
 *
 * The viewer (`viewer-static.min.js`, ~4 MB) is never part of the app bundle.
 * It ships as a deflate-raw+base64 asset in `public/ext/`, which Vite copies
 * verbatim into `dist-template/` — the directory committed at release tags —
 * so a deployed notebook fetches it from raw.githubusercontent.com pinned to
 * its own app version, the same CORS-clean route the updater uses.
 *
 * Since v0.65 the asset has FOUR sources, tried in this order:
 *   1. module memory — loaded/installed/harvested earlier this session
 *   2. the document's own <script id="powernote-ext-drawio"> block — a
 *      standalone notebook that carries its renderer
 *   3. IndexedDB — installed once per browser via Settings → Extensions
 *   4. the network — dev server, or raw.githubusercontent.com at the app tag
 * Only tier 4 touches the network; a notebook with the block (or a browser
 * with the cache) renders draw.io fully offline.
 *
 * Execution details are load-bearing, established by the v0.64 spike
 * (docs/DESIGN_DRAWIO.md addendum):
 * - The inflated source runs via an injected classic `<script>` element,
 *   removed synchronously after execution — top-level `var`s must become
 *   window globals (`new Function` would scope them away), and 4 MB of JS
 *   must never stay in the DOM where an `outerHTML`-based save would
 *   serialize it into the notebook.
 * - `DRAW_MATH_URL` is pointed at a data: no-op BEFORE eval because the
 *   build tail calls `Editor.initMath()` unconditionally; `onDrawioViewerLoad`
 *   is defined so the bootstrap never scans the document on its own; stencil
 *   dynamic loading is disabled AFTER eval so rendering never issues the
 *   synchronous stencil XHR — a library shape degrades to its styled box
 *   deterministically, on- and offline.
 */

import { inflateRawBase64 } from '../diagram/drawio';
import { GITHUB_REPO } from '../utils/updateChecker';
import { APP_VERSION } from '../version';
import { EXT_SCRIPT_ID_DRAWIO, readExtensionBlockFromDom, readExtensionBlockFromHtml } from './embed';
import { getCachedAsset, putCachedAsset } from './extensionStore';
import type { EmbeddedExtension, ExtensionStatus } from './types';

const ASSET_PATH = 'ext/drawio-viewer.b64';
const MANIFEST_PATH = 'ext/drawio-viewer.json';
const CACHE_KEY = 'drawio-viewer';

declare global {
  interface Window {
    /** Test override: base URL to fetch the extension asset from. */
    __POWERNOTE_EXT_URL__?: string;
    GraphViewer?: unknown;
    mxStencilRegistry?: { dynamicLoading?: boolean; allowEval?: boolean };
    DRAW_MATH_URL?: string;
    onDrawioViewerLoad?: () => void;
    mxLoadResources?: boolean;
    mxLoadStylesheets?: boolean;
    mxForceIncludes?: boolean;
  }
}

interface LoadedAsset {
  base64: string;
  version: string;
}

/** The asset this session holds, wherever it came from. The v0.65 embed path
 *  (collectEmbeddedExtensions) reads this before falling back to DOM/IDB. */
let memoryAsset: LoadedAsset | null = null;
let loadPromise: Promise<void> | null = null;
let installPromise: Promise<LoadedAsset> | null = null;
let lastError: string | null = null;

function isDev(): boolean {
  try {
    return typeof import.meta !== 'undefined' && Boolean(import.meta.env?.DEV);
  } catch {
    return false;
  }
}

function assetBaseUrls(): string[] {
  const urls: string[] = [];
  if (typeof window !== 'undefined' && window.__POWERNOTE_EXT_URL__) {
    urls.push(window.__POWERNOTE_EXT_URL__.replace(/\/$/, '') + '/');
  } else {
    if (isDev()) urls.push('/');
    urls.push(`https://raw.githubusercontent.com/${GITHUB_REPO}/v${APP_VERSION}/dist-template/`);
  }
  return urls;
}

/**
 * Fetches the compressed viewer over the network. Tries each base in order;
 * the manifest ride is best-effort — a missing manifest costs the version
 * label, not the load.
 */
export async function fetchViewerBase64(): Promise<LoadedAsset> {
  let lastFailure = 'no asset URL configured';
  for (const base of assetBaseUrls()) {
    try {
      const resp = await fetch(base + ASSET_PATH);
      if (!resp.ok) {
        lastFailure = `${resp.status} from ${base + ASSET_PATH}`;
        continue;
      }
      const base64 = (await resp.text()).trim();
      if (!/^[A-Za-z0-9+/=\s]+$/.test(base64.slice(0, 4096))) {
        lastFailure = `${base + ASSET_PATH} is not a base64 asset`;
        continue;
      }
      let version = 'unknown';
      try {
        const mResp = await fetch(base + MANIFEST_PATH);
        if (mResp.ok) {
          const manifest = await mResp.json();
          if (typeof manifest?.drawioVersion === 'string') version = manifest.drawioVersion;
        }
      } catch {
        // manifest is informational only
      }
      return { base64, version };
    } catch (err) {
      lastFailure = `${base + ASSET_PATH}: ${err instanceof Error ? err.message : String(err)}`;
    }
  }
  throw new Error(`draw.io viewer asset unavailable — ${lastFailure}`);
}

/** Offline tiers only: memory → the document's block → IndexedDB. */
async function resolveAssetOffline(): Promise<LoadedAsset | null> {
  if (memoryAsset) return memoryAsset;
  const block = readExtensionBlockFromDom(EXT_SCRIPT_ID_DRAWIO);
  if (block) return { base64: block.base64, version: block.version };
  const cached = await getCachedAsset(CACHE_KEY);
  if (cached) return { base64: cached.base64, version: cached.version };
  return null;
}

/**
 * Harvest extension blocks from an OPENED notebook's HTML. Every open path
 * extracts only the workspace JSON and throws the rest of the file away —
 * without this, opening someone else's extension-carrying notebook and
 * saving it would silently uninstall their extension. Fire-and-forget: the
 * bytes land in memory now and in IDB when it gets around to it.
 */
export function harvestEmbeddedExtensions(html: string): void {
  try {
    const block = readExtensionBlockFromHtml(html, EXT_SCRIPT_ID_DRAWIO);
    if (!block) return;
    memoryAsset = { base64: block.base64, version: block.version };
    void putCachedAsset(CACHE_KEY, { base64: block.base64, version: block.version, savedAt: Date.now() });
  } catch (err) {
    console.warn('[Extensions] harvest failed:', err);
  }
}

function executeViewer(js: string): void {
  window.mxLoadResources = false;
  window.mxLoadStylesheets = false;
  window.mxForceIncludes = false;
  window.onDrawioViewerLoad = () => {};
  window.DRAW_MATH_URL = 'data:text/javascript,//';
  const el = document.createElement('script');
  el.textContent = js;
  document.head.appendChild(el);
  el.remove();
  if (window.mxStencilRegistry) {
    window.mxStencilRegistry.dynamicLoading = false;
    window.mxStencilRegistry.allowEval = false;
  }
}

async function validateAsset(asset: LoadedAsset): Promise<string> {
  const js = await inflateRawBase64(asset.base64);
  if (js == null || !js.includes('GraphViewer')) {
    throw new Error('draw.io viewer asset did not inflate to the viewer script');
  }
  return js;
}

/**
 * Loads the viewer once per session. Rejects with a reason on failure and
 * clears the memo so a later attempt (e.g. back online, or after an install)
 * can retry.
 */
export function loadDrawioViewer(): Promise<void> {
  if (typeof window !== 'undefined' && typeof window.GraphViewer === 'function') {
    return Promise.resolve();
  }
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    let asset = await resolveAssetOffline();
    let fromNetwork = false;
    if (!asset) {
      asset = await fetchViewerBase64();
      fromNetwork = true;
    }
    const js = await validateAsset(asset);
    executeViewer(js);
    if (typeof window.GraphViewer !== 'function') {
      throw new Error('draw.io viewer executed but GraphViewer is missing');
    }
    memoryAsset = asset;
    if (fromNetwork) {
      void putCachedAsset(CACHE_KEY, { base64: asset.base64, version: asset.version, savedAt: Date.now() });
    }
    lastError = null;
  })().catch((err) => {
    loadPromise = null;
    lastError = err instanceof Error ? err.message : String(err);
    throw err;
  });
  return loadPromise;
}

/**
 * Explicit install from Settings → Extensions: fetch, validate, cache in
 * IndexedDB and remember in memory (so the next save embeds it). Does not
 * execute the viewer — rendering loads it on demand.
 */
export function installDrawioViewer(): Promise<LoadedAsset> {
  if (installPromise) return installPromise;
  installPromise = (async () => {
    const asset = await fetchViewerBase64();
    await validateAsset(asset);
    await putCachedAsset(CACHE_KEY, { base64: asset.base64, version: asset.version, savedAt: Date.now() });
    memoryAsset = asset;
    lastError = null;
    return asset;
  })().finally(() => {
    installPromise = null;
  });
  return installPromise;
}

/**
 * What the save and update paths embed into the notebook HTML. Empty when
 * nothing is installed/held — a notebook that never used draw.io stays lean.
 */
export async function collectEmbeddedExtensions(): Promise<EmbeddedExtension[]> {
  const asset = await resolveAssetOffline();
  if (!asset) return [];
  return [{ scriptId: EXT_SCRIPT_ID_DRAWIO, base64: asset.base64, version: asset.version }];
}

/** Synchronous view for callers that only need "is it live" (renderer badge). */
export function getDrawioViewerStatus(): { status: ExtensionStatus; version?: string; error?: string } {
  if (memoryAsset || (typeof window !== 'undefined' && typeof window.GraphViewer === 'function')) {
    return { status: 'installed', version: memoryAsset?.version };
  }
  if (loadPromise || installPromise) return { status: 'installing' };
  if (lastError) return { status: 'failed', error: lastError };
  return { status: 'not-installed' };
}

export interface DrawioViewerState {
  status: ExtensionStatus;
  /** Version of whatever asset is closest to hand. */
  version: string | null;
  /** True when the asset sits in this browser's IndexedDB. */
  cached: boolean;
  /** True when THIS document carries the embed block. */
  embedded: boolean;
  error: string | null;
}

/** Full async view for the Settings panel. */
export async function getDrawioViewerState(): Promise<DrawioViewerState> {
  const cached = await getCachedAsset(CACHE_KEY);
  const block = readExtensionBlockFromDom(EXT_SCRIPT_ID_DRAWIO);
  const loaded = typeof window !== 'undefined' && typeof window.GraphViewer === 'function';
  const version = memoryAsset?.version ?? block?.version ?? cached?.version ?? null;
  let status: ExtensionStatus;
  if (loadPromise || installPromise) status = 'installing';
  else if (loaded || memoryAsset || cached || block) status = 'installed';
  else if (lastError) status = 'failed';
  else status = 'not-installed';
  return { status, version, cached: cached != null, embedded: block != null, error: lastError };
}
