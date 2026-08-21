/**
 * draw.io source → exact SVG snapshot, via the viewer extension.
 *
 * The offscreen-render recipe comes from the v0.64 spike
 * (docs/DESIGN_DRAWIO.md addendum): a fixed-position container parked at
 * -10000px with explicit dimensions (mxGraph yields zero-size output under
 * display:none), `GraphViewer.createViewerForElement` with chrome disabled,
 * then the first `<svg>` serialized to a base64 data URI. foreignObject
 * labels stay in — Chromium draws them to canvas untainted and re-rasterizes
 * crisply under zoom.
 *
 * Never throws: a canvas entry point has to keep working on input it did not
 * author, so every failure is an `{ok:false, reason}` the caller can turn
 * into a transpile fallback plus a diagnostic.
 */

import type { DiagramRenderSnapshot } from '../types/data';
import { getDrawioViewerStatus, loadDrawioViewer } from '../extensions/drawioViewer';

export type RenderDrawioResult =
  | { ok: true; snapshot: DiagramRenderSnapshot }
  | { ok: false; reason: string };

/** Big enough for any sane page; the svg reports its own bounds afterwards. */
const CONTAINER_W = 4000;
const CONTAINER_H = 4000;

function utf8ToBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(bin);
}

interface GraphViewerInstance {
  graph?: {
    getGraphBounds?: () => { x: number; y: number; width: number; height: number };
  };
}

interface GraphViewerStatic {
  createViewerForElement: (el: Element, callback?: (viewer: GraphViewerInstance) => void) => void;
}

export async function renderDrawioSnapshot(source: string): Promise<RenderDrawioResult> {
  if (typeof document === 'undefined') {
    return { ok: false, reason: 'no DOM in this environment' };
  }
  try {
    await loadDrawioViewer();
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : String(err) };
  }
  const GraphViewer = window.GraphViewer as GraphViewerStatic | undefined;
  if (!GraphViewer || typeof GraphViewer.createViewerForElement !== 'function') {
    return { ok: false, reason: 'draw.io viewer loaded but createViewerForElement is missing' };
  }

  const container = document.createElement('div');
  container.style.cssText = `position:fixed;left:-10000px;top:0;width:${CONTAINER_W}px;height:${CONTAINER_H}px;overflow:hidden;`;
  document.body.appendChild(container);
  try {
    container.setAttribute(
      'data-mxgraph',
      JSON.stringify({ xml: source, nav: false, resize: false, toolbar: null, 'auto-fit': false }),
    );
    // Captured via object property — a plain `let` gets flow-narrowed to
    // `never` because TS cannot see that the callback runs synchronously.
    const captured: { viewer: GraphViewerInstance | null } = { viewer: null };
    GraphViewer.createViewerForElement(container, (v) => {
      captured.viewer = v;
    });

    const svg = container.querySelector('svg');
    if (!svg) {
      return { ok: false, reason: 'the viewer produced no SVG for this source' };
    }

    // The viewer parks the artwork somewhere inside the (large) container.
    // The snapshot must be the ARTWORK: crop the viewBox to its bounds.
    // The graph's own bounds are authoritative — svg.getBBox() lies as soon
    // as an HTML label is present, because mxGraph renders those as
    // percentage-sized <foreignObject>s whose bbox is the whole container.
    let width = 0;
    let height = 0;
    const setCrop = (x: number, y: number, w: number, h: number) => {
      width = Math.ceil(w) + 4;
      height = Math.ceil(h) + 4;
      svg.setAttribute('viewBox', `${Math.floor(x) - 2} ${Math.floor(y) - 2} ${width} ${height}`);
    };
    const graphBounds = captured.viewer?.graph?.getGraphBounds?.();
    if (graphBounds && graphBounds.width > 4 && graphBounds.height > 4) {
      setCrop(graphBounds.x, graphBounds.y, graphBounds.width, graphBounds.height);
    }
    if (!(width > 4) || !(height > 4)) {
      try {
        const box = (svg as SVGGraphicsElement).getBBox();
        // A bbox as large as the park is the foreignObject lie — refuse it.
        if (box.width > 4 && box.height > 4 && box.width < CONTAINER_W && box.height < CONTAINER_H) {
          setCrop(box.x, box.y, box.width, box.height);
        }
      } catch {
        // getBBox needs layout; fall through to attribute sizes below.
      }
    }
    if (!(width > 4) || !(height > 4)) {
      const attrW = Number.parseFloat(svg.getAttribute('width') ?? '');
      const attrH = Number.parseFloat(svg.getAttribute('height') ?? '');
      if (attrW > 4 && attrH > 4 && attrW < CONTAINER_W && attrH < CONTAINER_H) {
        width = Math.ceil(attrW);
        height = Math.ceil(attrH);
        if (!svg.getAttribute('viewBox')) svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
      }
    }
    if (!(width > 4) || !(height > 4)) {
      return { ok: false, reason: 'the source rendered to an empty drawing' };
    }

    svg.setAttribute('width', String(width));
    svg.setAttribute('height', String(height));
    svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

    const serialized = new XMLSerializer().serializeToString(svg);
    return {
      ok: true,
      snapshot: {
        src: `data:image/svg+xml;base64,${utf8ToBase64(serialized)}`,
        naturalWidth: width,
        naturalHeight: height,
        renderer: 'drawio-viewer',
        rendererVersion: getDrawioViewerStatus().version ?? 'unknown',
        at: Date.now(),
      },
    };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : String(err) };
  } finally {
    container.remove();
  }
}
