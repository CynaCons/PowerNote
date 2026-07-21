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

/** Default width for newly placed text blocks (= one page) */
export const DEFAULT_TEXT_WIDTH = A4_WIDTH;

/** Minimum text block width (resize floor) */
export const MIN_TEXT_WIDTH = 60;

/** Soft maximum text block width (resize ceiling; not a product page max) */
export const MAX_TEXT_WIDTH = 5000;

/** Minimum text block height after content measure */
export const MIN_TEXT_HEIGHT = 24;
