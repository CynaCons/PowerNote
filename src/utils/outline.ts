/**
 * Document outline derived from the markdown already on the canvas.
 *
 * Headings are not a separate data type in PowerNote — they are `#` lines
 * inside ordinary text blocks. So the outline is computed, never stored: it
 * cannot drift out of sync with the content, and editing a heading updates it
 * on the next render with no bookkeeping.
 *
 * The interesting part is vertical precision. One block can hold several
 * headings, so anchoring every entry to `node.y` would send three outline rows
 * to the same place. Instead each heading's offset inside its block is measured
 * against the real renderer — the same probe the block-layout code uses — so a
 * jump lands on the heading rather than on the top of the block containing it.
 */

import type { CanvasNode, ScrollRecord, TextNodeData } from '../types/data';
import { measureMarkdownHeight, MARKDOWN_PADDING } from './renderMarkdown';
import { A4_WIDTH, columnAt } from './pageLayout';

export interface OutlineEntry {
  id: string;
  /** 1 = `#`, 2 = `##`, 3 = `###`. Deeper levels are ignored. */
  level: number;
  text: string;
  /** Canvas coordinates of the heading itself, not of its block. */
  x: number;
  y: number;
  blockId: string;
  scrollId?: string;
}

export interface OutlineGroup {
  scrollId?: string;
  title: string;
  column: number;
  entries: OutlineEntry[];
}

/** ATX headings only (`# `..`### `), which is what the renderer styles. */
const HEADING = /^(#{1,3})\s+(.+?)\s*#*\s*$/;

/**
 * Vertical offset of a heading inside its own block.
 *
 * Measures the markdown ABOVE the heading and subtracts the probe's bottom
 * padding, since that padding is not between the prefix and the heading.
 */
function offsetWithinBlock(
  linesBefore: string[],
  width: number,
  data: TextNodeData,
): number {
  if (linesBefore.length === 0) return MARKDOWN_PADDING;
  const measured = measureMarkdownHeight(linesBefore.join('\n'), width, data);
  if (measured === null) return MARKDOWN_PADDING;
  return Math.max(MARKDOWN_PADDING, measured - MARKDOWN_PADDING);
}

/** Every heading on the page, in reading order: column by column, top to bottom. */
export function deriveOutline(nodes: CanvasNode[]): OutlineEntry[] {
  const entries: OutlineEntry[] = [];

  for (const node of nodes) {
    if (node.type !== 'text') continue;
    const data = node.data as TextNodeData;
    const lines = data.text.split('\n');
    const width = node.width || A4_WIDTH;

    let inFence = false;
    lines.forEach((line, index) => {
      // A `#` inside a fenced code block is a comment, not a heading.
      if (/^\s*```/.test(line)) {
        inFence = !inFence;
        return;
      }
      if (inFence) return;

      const match = HEADING.exec(line);
      if (!match) return;

      entries.push({
        id: `${node.id}:${index}`,
        level: match[1].length,
        text: match[2],
        x: node.x,
        y: node.y + offsetWithinBlock(lines.slice(0, index), width, data),
        blockId: node.id,
      });
    });
  }

  return entries.sort((a, b) => {
    const col = columnAt(a.x) - columnAt(b.x);
    if (col !== 0) return col;
    return a.y - b.y;
  });
}

/**
 * Outline grouped by scroll, so a page with parallel workstreams reads as
 * several documents rather than one interleaved list.
 */
export function groupOutline(
  entries: OutlineEntry[],
  scrolls: ScrollRecord[] | undefined,
): OutlineGroup[] {
  const groups = new Map<number, OutlineGroup>();

  for (const entry of entries) {
    const column = columnAt(entry.x, scrolls);
    if (!groups.has(column)) {
      const scroll = scrolls?.find((s) => s.column === column);
      groups.set(column, {
        scrollId: scroll?.id,
        title: scroll?.title ?? '',
        column,
        entries: [],
      });
    }
    groups.get(column)!.entries.push({ ...entry, scrollId: groups.get(column)!.scrollId });
  }

  return [...groups.values()].sort((a, b) => a.column - b.column);
}
