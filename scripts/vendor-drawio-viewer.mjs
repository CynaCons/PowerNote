/**
 * Vendors the draw.io viewer as an extension asset.
 *
 * Downloads viewer-static.min.js at a pinned drawio release tag, compresses it
 * deflate-raw + base64 (the runtime inflates with the browser-native
 * DecompressionStream('deflate-raw'), same as normalizeDrawioSource), and
 * writes it into public/ext/ together with a manifest and drawio's LICENSE at
 * that tag. Vite copies public/ into dist-template/ verbatim, and
 * dist-template/ is committed at release tags — which is what lets a deployed
 * notebook fetch the asset from raw.githubusercontent.com pinned to its own
 * app version.
 *
 * Run manually and commit the output:  node scripts/vendor-drawio-viewer.mjs [tag]
 */
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateRawSync } from 'node:zlib';

const TAG = process.argv[2] ?? 'v31.3.1';
const JS_URL = `https://raw.githubusercontent.com/jgraph/drawio/${TAG}/src/main/webapp/js/viewer-static.min.js`;
const LICENSE_URL = `https://raw.githubusercontent.com/jgraph/drawio/${TAG}/LICENSE`;

const outDir = join(dirname(dirname(fileURLToPath(import.meta.url))), 'public', 'ext');
mkdirSync(outDir, { recursive: true });

async function fetchText(url) {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`${resp.status} for ${url}`);
  return resp.text();
}

const js = await fetchText(JS_URL);
const versionMatch = js.match(/mxClient=\{VERSION:"([0-9.]+)"/);
const drawioVersion = versionMatch?.[1] ?? 'unknown';
if (`v${drawioVersion}` !== TAG) {
  throw new Error(`tag ${TAG} but bundled mxClient.VERSION is ${drawioVersion} — refusing to vendor a mismatch`);
}
if (!js.includes('GraphViewer')) {
  throw new Error('downloaded file does not look like the draw.io viewer');
}

const raw = Buffer.from(js, 'utf8');
const b64 = deflateRawSync(raw, { level: 9 }).toString('base64');
const manifest = {
  name: 'drawio-viewer',
  drawioVersion,
  tag: TAG,
  rawBytes: raw.length,
  b64Bytes: b64.length,
  sha256: createHash('sha256').update(raw).digest('hex'),
  source: JS_URL,
  // The drawio LICENSE at this tag is plain Apache-2.0 for source code; the
  // README restricts only icon sets / stencil libraries in Atlassian products.
  // We vendor the viewer source only (no stencil XMLs), so Apache-2.0 applies.
  license: 'Apache-2.0 (see drawio-viewer.LICENSE.txt)',
};

writeFileSync(join(outDir, 'drawio-viewer.b64'), b64);
writeFileSync(join(outDir, 'drawio-viewer.json'), JSON.stringify(manifest, null, 2) + '\n');
writeFileSync(join(outDir, 'drawio-viewer.LICENSE.txt'), await fetchText(LICENSE_URL));

console.log(`vendored draw.io viewer ${drawioVersion}: ${raw.length} bytes raw → ${b64.length} bytes b64`);
console.log(`sha256 ${manifest.sha256}`);
