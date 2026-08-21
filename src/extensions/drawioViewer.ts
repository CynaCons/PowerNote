/**
 * Loader for the draw.io viewer extension.
 *
 * The viewer (`viewer-static.min.js`, ~4 MB) is never part of the app bundle.
 * It ships as a deflate-raw+base64 asset in `public/ext/`, which Vite copies
 * verbatim into `dist-template/` — the directory committed at release tags —
 * so a deployed notebook fetches it from raw.githubusercontent.com pinned to
 * its own app version, the same CORS-clean route the updater uses.
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
import type { ExtensionStatus } from './types';

const ASSET_PATH = 'ext/drawio-viewer.b64';
const MANIFEST_PATH = 'ext/drawio-viewer.json';

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

/** In-memory copy of what was loaded — the v0.65 embed path reads this. */
let loadedAsset: LoadedAsset | null = null;
let loadPromise: Promise<void> | null = null;
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
 * Fetches the compressed viewer. Tries each base in order; the manifest ride
 * is best-effort — a missing manifest costs the version label, not the load.
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

/**
 * Loads the viewer once per session. Rejects with a reason on failure and
 * clears the memo so a later attempt (e.g. back online) can retry.
 */
export function loadDrawioViewer(): Promise<void> {
  if (typeof window !== 'undefined' && typeof window.GraphViewer === 'function') {
    return Promise.resolve();
  }
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    const asset = await fetchViewerBase64();
    const js = await inflateRawBase64(asset.base64);
    if (js == null || !js.includes('GraphViewer')) {
      throw new Error('draw.io viewer asset did not inflate to the viewer script');
    }
    executeViewer(js);
    if (typeof window.GraphViewer !== 'function') {
      throw new Error('draw.io viewer executed but GraphViewer is missing');
    }
    loadedAsset = asset;
    lastError = null;
  })().catch((err) => {
    loadPromise = null;
    lastError = err instanceof Error ? err.message : String(err);
    throw err;
  });
  return loadPromise;
}

export function getDrawioViewerStatus(): { status: ExtensionStatus; version?: string; error?: string } {
  if (loadedAsset || (typeof window !== 'undefined' && typeof window.GraphViewer === 'function')) {
    return { status: 'installed', version: loadedAsset?.version };
  }
  if (loadPromise) return { status: 'installing' };
  if (lastError) return { status: 'failed', error: lastError };
  return { status: 'not-installed' };
}
