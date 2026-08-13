/**
 * Shared page geometry + text sizing constants.
 * Keep in sync with visual A4 guides on the canvas (96 DPI).
 */

/** A4 width at 96 DPI */
export const A4_WIDTH = 794;

/** A4 height at 96 DPI */
export const A4_HEIGHT = 1123;

/** Gap between adjacent page cells */
export const PAGE_GAP = 40;

/** Left/top inset for the first page guide (visual only) */
export const PAGE_MARGIN = 60;

/** Blank pages kept below the last occupied one in scroll mode. */
export const SCROLL_HEADROOM_PAGES = 1;

/**
 * Length of the darker end-cap drawn at each end of a scroll page separator.
 * They read as a fold rather than a stray rule across the sheet.
 */
export const SCROLL_SEPARATOR_TICK = 12;

/**
 * Height reserved at the top of a scroll for its title header.
 *
 * Sized to clear BLOCK_TOP_INSET (48) so the header sits above the first block
 * of an existing notebook rather than on top of it — naming a scroll never
 * moves content that is already there.
 */
export const SCROLL_HEADER_HEIGHT = 40;

/** Left edge of a column band. 0 is the leftmost. */
export function columnLeft(column: number): number {
  return PAGE_MARGIN + column * (A4_WIDTH + PAGE_GAP);
}

/**
 * Which column band an x coordinate falls in.
 *
 * The single definition of a band boundary — page guides, block layout and
 * scroll membership all resolve through this, so they cannot drift apart.
 */
export function columnAt(x: number): number {
  return Math.floor((x - PAGE_MARGIN) / (A4_WIDTH + PAGE_GAP));
}

/** Default width for newly placed text blocks (= one page) */
export const DEFAULT_TEXT_WIDTH = A4_WIDTH;

/** Minimum text block width (resize floor) */
export const MIN_TEXT_WIDTH = 60;

/** Soft maximum text block width (resize ceiling; not a product page max) */
export const MAX_TEXT_WIDTH = 5000;

/** Minimum text block height after content measure */
export const MIN_TEXT_HEIGHT = 24;

/** Canvas y a scroll title rests at when the page is scrolled to the top. */
export const SCROLL_TITLE_RESTING_Y = 12;
/** Gap kept between a held title and the top of the viewport. */
export const SCROLL_TITLE_PIN_INSET = 10;

/**
 * Where a scroll title should draw, given where the viewport is (v0.35).
 *
 * At rest it sits at the top of the band. Once the viewport scrolls past that,
 * the title holds just below the top edge instead, so you never lose track of
 * which column you are reading — a frozen header row, in canvas coordinates.
 *
 * Pure so the behaviour is testable without a stage: the component only feeds
 * it the viewport.
 */
export function scrollTitleY(viewport: { y: number; scale: number }): {
  y: number;
  holding: boolean;
} {
  const viewportTop = -viewport.y / (viewport.scale || 1);
  const y = Math.max(SCROLL_TITLE_RESTING_Y, viewportTop + SCROLL_TITLE_PIN_INSET);
  return { y, holding: y > SCROLL_TITLE_RESTING_Y + 0.5 };
}
