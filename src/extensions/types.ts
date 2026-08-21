/**
 * Extensions are capabilities too heavy to live in the base bundle — today
 * only the draw.io viewer (~4 MB of JS, ~1.1 MB deflated). An extension is a
 * single compressed+base64 asset that can be fetched once, cached, and (from
 * v0.65) embedded into the notebook HTML as a `text/plain` script block so a
 * saved file carries its own renderer.
 */

export type ExtensionId = 'drawio-viewer';

export type ExtensionStatus = 'not-installed' | 'installing' | 'installed' | 'failed';

/** An extension as it travels inside a notebook file. */
export interface EmbeddedExtension {
  /** DOM id of the script block, e.g. "powernote-ext-drawio". */
  scriptId: string;
  /** deflate-raw + base64 payload. Base64 contains no `<`, so the block can
   *  never terminate early on a `</script` inside the payload. */
  base64: string;
  /** Upstream version of the vendored asset (drawio release). */
  version: string;
}
