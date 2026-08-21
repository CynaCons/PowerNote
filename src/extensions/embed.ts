/**
 * Extension blocks inside a notebook HTML file.
 *
 * An installed extension travels as
 *   <script id="powernote-ext-…" type="text/plain" data-version="…">BASE64</script>
 * next to the powernote-data block. `type="text/plain"` means the browser
 * never executes it, and a base64 payload cannot contain `<` — so the block
 * can never terminate early on a `</script` the way raw JS would (the exact
 * corruption vite.export.config.ts has to escape around for the app bundle).
 *
 * Pure string functions, no store imports: buildExportHtml AND
 * buildUpdatedHtml both inject through here, so the save path and the update
 * path cannot drift apart — that drift is how an update would silently
 * uninstall an extension.
 */

import type { EmbeddedExtension } from './types';

export const EXT_SCRIPT_ID_DRAWIO = 'powernote-ext-drawio';

function blockPattern(scriptId: string): RegExp {
  return new RegExp(`<script id="${scriptId}"[^>]*>[\\s\\S]*?</script>`);
}

function renderBlock(ext: EmbeddedExtension): string {
  return (
    `<script id="${ext.scriptId}" type="text/plain" data-version="${ext.version}" ` +
    `data-license="Apache-2.0">${ext.base64}</script>`
  );
}

/**
 * Replace-or-insert each extension block. Replace-by-id keeps it idempotent:
 * prod saves serialize the live DOM, which already carries the block — a
 * plain insert would duplicate ~1.1 MB on every save.
 */
export function injectExtensionBlocks(html: string, exts: EmbeddedExtension[]): string {
  let out = html;
  for (const ext of exts) {
    if (!ext.base64) continue;
    const block = renderBlock(ext);
    const pattern = blockPattern(ext.scriptId);
    if (pattern.test(out)) {
      out = out.replace(pattern, block);
    } else if (out.includes('</head>')) {
      out = out.replace('</head>', `${block}\n</head>`);
    } else {
      out = block + out;
    }
  }
  return out;
}

/** Read one extension block out of a notebook's HTML text (opened files). */
export function readExtensionBlockFromHtml(
  html: string,
  scriptId: string,
): EmbeddedExtension | null {
  const match = html.match(
    new RegExp(`<script id="${scriptId}"[^>]*?(?:data-version="([^"]*)")?[^>]*>([A-Za-z0-9+/=\\s]+)</script>`),
  );
  if (!match) return null;
  const base64 = (match[2] ?? '').replace(/\s+/g, '');
  if (!base64) return null;
  return { scriptId, base64, version: match[1] || 'unknown' };
}

/** Read one extension block out of the live document (standalone notebooks). */
export function readExtensionBlockFromDom(scriptId: string): EmbeddedExtension | null {
  if (typeof document === 'undefined') return null;
  const el = document.getElementById(scriptId);
  if (!el) return null;
  const base64 = (el.textContent ?? '').replace(/\s+/g, '');
  if (!base64) return null;
  return { scriptId, base64, version: el.getAttribute('data-version') || 'unknown' };
}
