/**
 * Block layout for agent-authored notes.
 *
 * A "block" is one text node holding a markdown chunk (a paragraph, a bullet
 * list, a checklist, a heading). Blocks stack vertically down the A4 page
 * guide at full page width — the same convention as a hand-placed text block,
 * whose default width is already one page (see DEFAULT_TEXT_WIDTH).
 *
 * Heights are measured synchronously against the real stylesheet before a
 * block is placed. TextNode does its own measurement, but only ~60ms later on
 * a timer — an agent appending blocks back to back would stack each one
 * against the previous block's not-yet-corrected height and overlap them.
 */

import type { CanvasNode, TextNodeData } from '../types/data';
import { A4_WIDTH, PAGE_GAP, PAGE_MARGIN, MIN_TEXT_HEIGHT } from '../utils/pageLayout';
import { defaultTextOptions } from '../utils/defaults';
import { generateId } from '../utils/ids';
import { measureMarkdownHeight } from '../utils/renderMarkdown';

/** Vertical gap between consecutive agent-authored blocks. */
export const BLOCK_GAP = 12;

/** Inset from the top of the A4 page guide for the first block on a page. */
export const BLOCK_TOP_INSET = 48;

/** Rough advance width of Inter at the default 16px, used for wrap estimates. */
const AVG_CHAR_WIDTH = 8.2;

/** Rendered line box for the default 16px text. */
const EST_LINE_HEIGHT = 24;

/**
 * Character-counting fallback used only when there is no DOM to measure in.
 */
function estimateFromText(markdown: string, width: number): number {
  const cols = Math.max(1, Math.floor(width / AVG_CHAR_WIDTH));
  let lines = 0;
  for (const line of markdown.split('\n')) {
    // A blank source line still produces a small gap once rendered.
    lines += line.length === 0 ? 1 : Math.ceil(line.length / cols);
  }
  return Math.max(MIN_TEXT_HEIGHT, lines * EST_LINE_HEIGHT);
}

/**
 * Height a markdown chunk will occupy at a given width, with the given text
 * options (they affect it — font size and family change the metrics).
 *
 * Measured for real against the live stylesheet where possible — a character
 * estimate is hopeless for headings and lists (an `# H1` is roughly double a
 * body line), and getting it wrong makes agent-appended blocks overlap.
 */
export function blockHeight(
  markdown: string,
  width = A4_WIDTH,
  data: Pick<TextNodeData, 'fontSize' | 'fontFamily' | 'fontStyle' | 'fill'> = defaultTextOptions,
): number {
  return (
    measureMarkdownHeight(markdown, width, data) ?? estimateFromText(markdown, width)
  );
}

/** Left edge of an A4 page-guide column, matching PageGuides. */
export function columnX(column: number): number {
  return PAGE_MARGIN + column * (A4_WIDTH + PAGE_GAP);
}

/**
 * Which A4 column a node sits in. Uses the same floor-division as PageGuides so
 * the bridge and the visible guides always agree on where column boundaries are.
 */
export function columnOf(node: CanvasNode): number {
  return Math.floor((node.x - PAGE_MARGIN) / (A4_WIDTH + PAGE_GAP));
}

/**
 * Y coordinate for the next block appended to a column: below everything
 * already in THAT column, so agent writes never land on top of existing (or
 * hand-placed) content.
 *
 * Scoped per column on purpose — measuring against the whole page would push
 * the first block of column 1 down past all of column 0's content, leaving a
 * large gap at the top of an otherwise empty column.
 */
export function nextBlockY(nodes: CanvasNode[], column = 0): number {
  let bottom = BLOCK_TOP_INSET;
  let found = false;
  for (const node of nodes) {
    if (columnOf(node) !== column) continue;
    found = true;
    bottom = Math.max(bottom, node.y + (node.height || MIN_TEXT_HEIGHT));
  }
  return found ? bottom + BLOCK_GAP : BLOCK_TOP_INSET;
}

/**
 * Build a text node for a markdown block, positioned at the foot of whatever is
 * already in the target column.
 */
export function createBlockNode(
  markdown: string,
  existing: CanvasNode[],
  column = 0,
): CanvasNode {
  const data: TextNodeData = { ...defaultTextOptions, text: markdown };
  return {
    id: generateId(),
    type: 'text',
    x: columnX(column),
    y: nextBlockY(existing, column),
    width: A4_WIDTH,
    height: blockHeight(markdown, A4_WIDTH, data),
    layer: 3,
    data,
  };
}

/**
 * Text nodes on a page in reading order: column by column, top to bottom within
 * each. Column-major rather than pure top-to-bottom, so a two-column page reads
 * as two pages rather than interleaving the columns line by line.
 */
export function orderedTextNodes(nodes: CanvasNode[]): CanvasNode[] {
  return nodes
    .filter((n) => n.type === 'text')
    .sort((a, b) => {
      const colDiff = columnOf(a) - columnOf(b);
      if (colDiff !== 0) return colDiff;
      if (Math.abs(a.y - b.y) > 20) return a.y - b.y;
      return a.x - b.x;
    });
}
