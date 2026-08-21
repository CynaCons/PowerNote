import type { CanvasNode, ImageNodeData } from '../types/data';
import { generateId } from './ids';

/** Encode-time long-edge cap. Display width is capped separately at 600. */
export const EMBED_MAX_EDGE = 2048;
export const EMBED_JPEG_QUALITY = 0.85;
export const DISPLAY_MAX_WIDTH = 600;

const KEEP_MIME = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);

export interface ImageEmbed {
  src: string;
  naturalWidth: number;
  naturalHeight: number;
}

function normalizeMime(type: string): string {
  const t = type.split(';')[0].trim().toLowerCase();
  return t === 'image/jpg' ? 'image/jpeg' : t;
}

function blobToDataUri(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error('Could not read image bytes'));
    reader.readAsDataURL(blob);
  });
}

function loadHtmlImage(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not decode image'));
    };
    img.src = url;
  });
}

type Decoded = {
  source: CanvasImageSource;
  width: number;
  height: number;
  close: () => void;
};

async function decodeBlob(blob: Blob): Promise<Decoded> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(blob);
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        close: () => bitmap.close(),
      };
    } catch {
      // SVG and a few other types fail createImageBitmap; fall through.
    }
  }
  const img = await loadHtmlImage(blob);
  return {
    source: img,
    width: img.naturalWidth || img.width,
    height: img.naturalHeight || img.height,
    close: () => undefined,
  };
}

/** Sample every 16th pixel's alpha; any < 255 means the scaled canvas has transparency. */
function canvasHasAlpha(ctx: CanvasRenderingContext2D, width: number, height: number): boolean {
  const { data } = ctx.getImageData(0, 0, width, height);
  for (let i = 3; i < data.length; i += 16 * 4) {
    if (data[i] < 255) return true;
  }
  return false;
}

/**
 * Decode a blob and return notebook-ready bytes: original data URI when the
 * long edge is already ≤ 2048 and the input is jpeg/png/gif/webp; otherwise
 * a downscaled (or same-size re-encoded) PNG/JPEG.
 */
export async function embedImage(blob: Blob): Promise<ImageEmbed> {
  if (blob.size === 0) throw new Error('Could not decode image');
  const decoded = await decodeBlob(blob);
  try {
    const { width, height } = decoded;
    if (!width || !height) throw new Error('Could not decode image');
    const longEdge = Math.max(width, height);
    const mime = normalizeMime(blob.type);
    if (longEdge <= EMBED_MAX_EDGE && KEEP_MIME.has(mime)) {
      return {
        src: await blobToDataUri(blob),
        naturalWidth: width,
        naturalHeight: height,
      };
    }

    const scale = longEdge > EMBED_MAX_EDGE ? EMBED_MAX_EDGE / longEdge : 1;
    const dw = Math.max(1, Math.round(width * scale));
    const dh = Math.max(1, Math.round(height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = dw;
    canvas.height = dh;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not encode image');
    ctx.drawImage(decoded.source, 0, 0, dw, dh);
    const hasAlpha = canvasHasAlpha(ctx, dw, dh);
    const src = hasAlpha
      ? canvas.toDataURL('image/png')
      : canvas.toDataURL('image/jpeg', EMBED_JPEG_QUALITY);
    return { src, naturalWidth: dw, naturalHeight: dh };
  } finally {
    decoded.close();
  }
}

export function imageNodeFromEmbed(
  embed: ImageEmbed,
  opts: { x: number; y: number; alt: string },
): CanvasNode {
  let w = embed.naturalWidth;
  let h = embed.naturalHeight;
  if (w > DISPLAY_MAX_WIDTH) {
    h = h * (DISPLAY_MAX_WIDTH / w);
    w = DISPLAY_MAX_WIDTH;
  }
  const data: ImageNodeData = {
    src: embed.src,
    alt: opts.alt,
    naturalWidth: embed.naturalWidth,
    naturalHeight: embed.naturalHeight,
  };
  return {
    id: generateId(),
    type: 'image',
    x: opts.x,
    y: opts.y,
    width: w,
    height: h,
    layer: 3,
    data,
  };
}

/**
 * Decoded byte size of a data-URI base64 payload. `floor(len * 3/4)` minus
 * padding — no decode. Used by `read_page` so the index can name size
 * without shipping the payload.
 */
export function dataUriDecodedBytes(src: string): number {
  const comma = src.indexOf(',');
  if (comma < 0) return 0;
  const b64 = src.slice(comma + 1);
  const len = b64.length;
  let padding = 0;
  if (len > 0 && b64.charAt(len - 1) === '=') padding += 1;
  if (len > 1 && b64.charAt(len - 2) === '=') padding += 1;
  return Math.max(0, Math.floor((len * 3) / 4) - padding);
}

/** MIME subtype of a `data:image/...` URI (`png`, `jpeg`, …). */
export function dataUriImageFormat(src: string): string {
  const m = /^data:image\/([a-zA-Z0-9.+-]+)/i.exec(src);
  if (!m) return 'bin';
  const sub = m[1].toLowerCase();
  return sub === 'jpg' ? 'jpeg' : sub;
}

function altFromUrl(url: string): string {
  try {
    const name = new URL(url).pathname.split('/').filter(Boolean).pop();
    return name ? decodeURIComponent(name) : 'image';
  } catch {
    return 'image';
  }
}

/**
 * Fetch a remote image and run it through the embed pipeline. A URL is never
 * stored as `src`. Failures throw with a reason suitable for an error toast.
 */
export async function embedImageFromUrl(url: string): Promise<ImageEmbed & { alt: string }> {
  let res: Response;
  try {
    res = await fetch(url);
  } catch {
    throw new Error('Could not fetch image (network or CORS)');
  }
  if (!res.ok) {
    throw new Error(`Could not fetch image (HTTP ${res.status})`);
  }
  const headerType = normalizeMime(res.headers.get('content-type') || '');
  const blob = await res.blob();
  const typed = headerType && headerType !== normalizeMime(blob.type)
    ? new Blob([blob], { type: headerType })
    : blob;
  const mime = normalizeMime(typed.type);
  try {
    const embed = await embedImage(typed);
    return { ...embed, alt: altFromUrl(url) };
  } catch (err) {
    if (!mime.startsWith('image/')) {
      throw new Error('URL did not return an image');
    }
    throw err instanceof Error ? err : new Error('Could not decode image');
  }
}
