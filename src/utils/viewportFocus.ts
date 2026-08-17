/**
 * Viewport moves that navigation UI shares.
 *
 * The sidebar and the outline both need "put this bit of canvas on screen", and
 * they must agree — a scroll click and a heading click landing at different
 * offsets would read as a bug. Both resolve through here.
 *
 * Zoom is never changed. A jump that also rescaled would cost the reader their
 * sense of where they are in the document, which is the one thing navigation
 * has to preserve.
 */

import { useCanvasStore } from '../stores/useCanvasStore';
import { useWorkspaceStore } from '../stores/useWorkspaceStore';
import { A4_WIDTH, columnLeft, columnWidth } from './pageLayout';

/** Where a jumped-to heading lands, measured from the top of the viewport. */
export const HEADING_INSET = 96;

/** Where the top of a scroll lands, leaving its title header visible. */
export const SCROLL_TOP_INSET = 24;

function canvasWidth(): number {
  const el = document.querySelector('.infinite-canvas');
  return el?.clientWidth ?? window.innerWidth;
}

/**
 * Centre a canvas column horizontally and place `y` at `inset` from the top.
 */
function focus(x: number, y: number, inset: number, width = A4_WIDTH): void {
  const { viewport, setViewport } = useCanvasStore.getState();
  const scale = viewport.scale;

  setViewport({
    x: canvasWidth() / 2 - (x + width / 2) * scale,
    y: inset - y * scale,
    scale,
  });
}

/** Bring the top of a scroll's column into view. */
export function focusScrollStart(column: number): void {
  const scrolls = useWorkspaceStore.getState().getActivePage()?.scrolls;
  focus(columnLeft(column, scrolls), 0, SCROLL_TOP_INSET, columnWidth(column, scrolls));
}

/** Bring a heading into view, near the top of the canvas. */
export function focusHeading(x: number, y: number): void {
  focus(x, y, HEADING_INSET);
}
