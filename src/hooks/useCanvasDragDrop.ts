import { useEffect } from 'react';
import type Konva from 'konva';
import { useCanvasStore } from '../stores/useCanvasStore';
import { generateId } from '../utils/ids';
import { clampCanvasY, liveCeiling } from '../utils/scrollCeiling';
import type { CanvasNode as CanvasNodeType, ImageNodeData } from '../types/data';
import { sniffFormat, normalizeDrawioSource, type DiagramFormat } from '../diagram';
import { placeDiagramOnCanvas } from '../diagram/canvasOps';
import { showToast } from '../components/layout/Toast';
import { useDiagramStore } from '../stores/useDiagramStore';

function fileExt(name: string): string {
  const i = name.lastIndexOf('.');
  return i >= 0 ? name.slice(i + 1).toLowerCase() : '';
}

function titleFromFilename(name: string): string {
  const i = name.lastIndexOf('.');
  const base = i > 0 ? name.slice(0, i) : name;
  return base || 'Diagram';
}

/**
 * A dropped SVG used to match the image/* gate (MIME image/svg+xml) and land
 * as an opaque raster. From now on .svg / image/svg+xml become native nodes.
 */
function isSvgFile(file: File): boolean {
  return fileExt(file.name) === 'svg' || file.type === 'image/svg+xml';
}

function isDrawioFile(file: File): boolean {
  const n = file.name.toLowerCase();
  return n.endsWith('.drawio') || n.endsWith('.drawio.xml') || n.endsWith('.dio');
}

function isXmlFile(file: File): boolean {
  return fileExt(file.name) === 'xml';
}

function viewportCentre(
  stage: Konva.Stage | null,
  dimensions: { width: number; height: number },
): { x: number; y: number } {
  const ceiling = liveCeiling();
  return {
    x: stage ? (dimensions.width / 2 - stage.x()) / stage.scaleX() : 200,
    y: clampCanvasY(
      stage ? (dimensions.height / 2 - stage.y()) / stage.scaleY() : 200,
      ceiling,
    ),
  };
}

function dropPoint(
  e: DragEvent,
  container: HTMLElement,
  stage: Konva.Stage | null,
): { x: number; y: number } {
  const rect = container.getBoundingClientRect();
  const ceiling = liveCeiling();
  return {
    x: stage ? (e.clientX - rect.left - stage.x()) / stage.scaleX() : e.clientX - rect.left,
    y: clampCanvasY(
      stage ? (e.clientY - rect.top - stage.y()) / stage.scaleY() : e.clientY - rect.top,
      ceiling,
    ),
  };
}

function editingTextField(): boolean {
  const active = document.activeElement;
  if (!(active instanceof HTMLElement)) return false;
  const tag = active.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || active.isContentEditable;
}

/**
 * Surface error diagnostics the way the source dialog lists them — drop/paste
 * has no dialog, so the existing toast is the user-facing channel. The bridge
 * path returns the same array on create_diagram; here we only toast `error`.
 */
function toastImport(
  title: string,
  result: { placed: boolean; elementCount: number; diagnostics: { severity: string; message: string }[]; warning?: string },
): void {
  const errors = result.diagnostics.filter((d) => d.severity === 'error');
  const notes = result.diagnostics.filter((d) => d.severity !== 'error');
  if (!result.placed) {
    showToast(errors[0]?.message ?? `Nothing in “${title}” could be drawn.`, 'error');
    return;
  }
  const bits = [`Imported “${title}”: ${result.elementCount} mark${result.elementCount === 1 ? '' : 's'}`];
  if (notes.length) bits.push(`${notes.length} note${notes.length === 1 ? '' : 's'}`);
  if (errors.length) bits.push(`${errors.length} skipped`);
  showToast(bits.join(' · '), errors.length ? 'info' : 'success');
  if (result.warning) showToast(result.warning, 'info');
}

async function ingestDiagramText(
  raw: string,
  opts: { x: number; y: number; title: string; format: Extract<DiagramFormat, 'drawio' | 'svg'> },
): Promise<void> {
  const source = opts.format === 'drawio' ? await normalizeDrawioSource(raw) : raw;
  const result = placeDiagramOnCanvas({
    x: opts.x,
    y: opts.y,
    source,
    title: opts.title,
    format: opts.format,
  });
  toastImport(opts.title, result);
  if (result.placed && result.diagnostics.length > 0) {
    useDiagramStore.getState().openSource(result.frameId);
  }
}

/** Read a File (image) as a base64 data URI, then add it to the canvas */
function addImageFromFile(file: File, x: number, y: number) {
  if (!file.type.startsWith('image/')) return;
  const reader = new FileReader();
  reader.onload = () => {
    const src = reader.result as string;
    const img = new Image();
    img.onload = () => {
      // Scale down if too large (max 600px wide)
      const maxW = 600;
      let w = img.naturalWidth;
      let h = img.naturalHeight;
      if (w > maxW) {
        h = h * (maxW / w);
        w = maxW;
      }
      const node: CanvasNodeType = {
        id: generateId(),
        type: 'image',
        x, y,
        width: w,
        height: h,
        layer: 3,
        data: {
          src,
          alt: file.name || 'image',
          naturalWidth: img.naturalWidth,
          naturalHeight: img.naturalHeight,
        } as ImageNodeData,
      };
      useCanvasStore.getState().addNode(node);
    };
    img.src = src;
  };
  reader.readAsDataURL(file);
}

async function ingestDroppedFiles(files: File[], x: number, y: number): Promise<void> {
  for (const file of files) {
    if (isDrawioFile(file) || isXmlFile(file) || isSvgFile(file)) {
      const text = await file.text();
      if (isDrawioFile(file) || (isXmlFile(file) && sniffFormat(text) === 'drawio')) {
        await ingestDiagramText(text, {
          x,
          y,
          title: titleFromFilename(file.name),
          format: 'drawio',
        });
        continue;
      }
      if (isSvgFile(file)) {
        await ingestDiagramText(text, {
          x,
          y,
          title: titleFromFilename(file.name),
          format: 'svg',
        });
        continue;
      }
      // .xml that does not sniff as mxGraph: leave it (not an image either).
      continue;
    }
    if (file.type.startsWith('image/')) {
      addImageFromFile(file, x, y);
    }
  }
}

/**
 * Hook for file drag-and-drop onto canvas and clipboard paste handlers.
 * Handles:
 * - Drop of .drawio / mxGraph .xml / .svg → diagram frame at the drop point
 * - Ctrl+V paste of mxGraph or SVG text → diagram frame at viewport centre
 * - Ctrl+V paste and drop of remaining image/* files (unchanged)
 */
export function useCanvasDragDrop(
  containerRef: React.RefObject<HTMLDivElement | null>,
  stageRef: React.RefObject<Konva.Stage | null>,
  dimensions: { width: number; height: number },
) {
  // ── Clipboard paste (images, or diagram-source text) ───────
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const data = e.clipboardData;
      if (!data) return;

      // Images first, including a pasted image/svg+xml raster — same as today.
      for (const item of Array.from(data.items)) {
        if (item.type.startsWith('image/')) {
          e.preventDefault();
          const file = item.getAsFile();
          if (file) {
            const { x, y } = viewportCentre(stageRef.current, dimensions);
            addImageFromFile(file, x, y);
          }
          return;
        }
      }

      if (editingTextField()) return;

      const text = data.getData('text/plain');
      if (!text) return;
      const sniffed = sniffFormat(text);
      if (sniffed !== 'drawio' && sniffed !== 'svg') return;

      e.preventDefault();
      const { x, y } = viewportCentre(stageRef.current, dimensions);
      void ingestDiagramText(text, {
        x,
        y,
        title: 'Diagram',
        format: sniffed,
      });
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [stageRef, dimensions]);

  // ── Drag-drop files onto canvas ─────────────────────────
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
      e.dataTransfer!.dropEffect = 'copy';
    };

    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      const files = e.dataTransfer?.files ? Array.from(e.dataTransfer.files) : [];
      if (files.length === 0) return;
      const { x, y } = dropPoint(e, container, stageRef.current);
      void ingestDroppedFiles(files, x, y);
    };

    container.addEventListener('dragover', handleDragOver);
    container.addEventListener('drop', handleDrop);
    return () => {
      container.removeEventListener('dragover', handleDragOver);
      container.removeEventListener('drop', handleDrop);
    };
  }, [containerRef, stageRef]);
}
