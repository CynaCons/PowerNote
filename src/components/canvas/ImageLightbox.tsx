import { useEffect, useState } from 'react';
import { useCanvasStore } from '../../stores/useCanvasStore';
import type { ImageNodeData } from '../../types/data';
import './ImageLightbox.css';

/**
 * Draw the image into an offscreen canvas applying the node's normalized crop
 * and 90°-step rotation, then return that bitmap as a data URL. Output pixel
 * size is the cropped (and possibly swapped) natural size — never the display
 * size on the canvas.
 */
function drawLightboxBitmap(
  img: HTMLImageElement,
  data: ImageNodeData,
): { src: string; width: number; height: number } {
  const natW = data.naturalWidth || img.naturalWidth;
  const natH = data.naturalHeight || img.naturalHeight;
  const crop = data.crop;
  const sx = (crop?.x ?? 0) * natW;
  const sy = (crop?.y ?? 0) * natH;
  const sw = Math.max(1, (crop?.width ?? 1) * natW);
  const sh = Math.max(1, (crop?.height ?? 1) * natH);

  const rot = (((data.rotation ?? 0) % 360) + 360) % 360;
  const swap = rot === 90 || rot === 270;
  const width = Math.max(1, Math.round(swap ? sh : sw));
  const height = Math.max(1, Math.round(swap ? sw : sh));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return { src: img.src, width, height };
  }
  ctx.translate(width / 2, height / 2);
  ctx.rotate((rot * Math.PI) / 180);
  ctx.drawImage(img, sx, sy, sw, sh, -sw / 2, -sh / 2, sw, sh);
  return { src: canvas.toDataURL(), width, height };
}

function fitToViewport(natW: number, natH: number): { width: number; height: number } {
  const maxW = window.innerWidth * 0.92;
  const maxH = window.innerHeight * 0.92;
  const scale = Math.min(1, maxW / natW, maxH / natH);
  return { width: natW * scale, height: natH * scale };
}

export function ImageLightbox() {
  const lightboxNodeId = useCanvasStore((s) => s.lightboxNodeId);
  const node = useCanvasStore((s) => {
    const id = s.lightboxNodeId;
    if (!id) return null;
    return s.nodes.find((n) => n.id === id) ?? null;
  });
  const closeLightbox = useCanvasStore((s) => s.closeLightbox);

  const data = node && node.type === 'image' ? (node.data as ImageNodeData) : null;
  const [bitmap, setBitmap] = useState<{ src: string; width: number; height: number } | null>(null);
  const [display, setDisplay] = useState<{ width: number; height: number } | null>(null);

  // Stale id (page switch / deleted node): drop the overlay.
  useEffect(() => {
    if (!lightboxNodeId) return;
    if (!node || node.type !== 'image') {
      closeLightbox();
    }
  }, [lightboxNodeId, node, closeLightbox]);

  // Capture-phase so canvas Escape (deselect) never also runs.
  useEffect(() => {
    if (!lightboxNodeId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopPropagation();
      closeLightbox();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [lightboxNodeId, closeLightbox]);

  useEffect(() => {
    if (!data) {
      setBitmap(null);
      return;
    }
    let cancelled = false;
    const img = new window.Image();
    img.onload = () => {
      if (!cancelled) setBitmap(drawLightboxBitmap(img, data));
    };
    img.onerror = () => {
      if (!cancelled) setBitmap(null);
    };
    img.src = data.src;
    return () => {
      cancelled = true;
    };
  }, [data]);

  useEffect(() => {
    if (!bitmap) {
      setDisplay(null);
      return;
    }
    const compute = () => setDisplay(fitToViewport(bitmap.width, bitmap.height));
    compute();
    window.addEventListener('resize', compute);
    return () => window.removeEventListener('resize', compute);
  }, [bitmap]);

  if (!lightboxNodeId || !data) return null;

  return (
    <div
      className="image-lightbox"
      data-testid="image-lightbox"
      onClick={closeLightbox}
    >
      <button
        type="button"
        className="image-lightbox__close"
        data-testid="image-lightbox-close"
        aria-label="Close"
        onClick={(e) => {
          e.stopPropagation();
          closeLightbox();
        }}
      >
        ×
      </button>
      {bitmap && display && (
        <img
          className="image-lightbox__img"
          data-testid="image-lightbox-img"
          src={bitmap.src}
          alt={data.alt || ''}
          width={display.width}
          height={display.height}
          onClick={(e) => e.stopPropagation()}
        />
      )}
      {data.alt ? (
        <div className="image-lightbox__alt" onClick={(e) => e.stopPropagation()}>
          {data.alt}
        </div>
      ) : null}
    </div>
  );
}
