import { Rect, Line, Group } from 'react-konva';
import type { BackgroundMode, CanvasNode } from '../../types/data';
import {
  A4_WIDTH,
  A4_HEIGHT,
  PAGE_GAP,
  PAGE_MARGIN as MARGIN,
  SCROLL_HEADROOM_PAGES,
  SCROLL_SEPARATOR_TICK,
  columnAt,
  columnLeft,
} from '../../utils/pageLayout';

export type { BackgroundMode };

// Grid mode spacing
const GRID_SPACING = 100;
const GRID_EXTENT = 5000; // how far grid lines extend

// Scroll mode: pages stacked with no vertical gap, so the column reads as one
// continuous sheet and a page boundary is just a rule across it. Geometry lives
// in pageLayout so the guides and the bridge measure from the same numbers.

interface PageGuidesProps {
  mode: BackgroundMode;
  nodes: CanvasNode[];
}

/**
 * Calculate which page cells are occupied by content.
 * Returns a set of "col,row" keys for pages that should be rendered.
 */
function getOccupiedPages(nodes: CanvasNode[]): Set<string> {
  const occupied = new Set<string>();
  // Always show the first page (0,0)
  occupied.add('0,0');

  for (const node of nodes) {
    // Which page columns/rows does this node touch?
    const colStart = Math.floor((node.x - MARGIN) / (A4_WIDTH + PAGE_GAP));
    const colEnd = Math.floor((node.x + (node.width || 200) - MARGIN) / (A4_WIDTH + PAGE_GAP));
    const rowStart = Math.floor(node.y / (A4_HEIGHT + PAGE_GAP));
    const rowEnd = Math.floor((node.y + (node.height || 30)) / (A4_HEIGHT + PAGE_GAP));

    for (let c = Math.min(colStart, 0); c <= Math.max(colEnd, 0); c++) {
      for (let r = Math.min(rowStart, 0); r <= Math.max(rowEnd, 0); r++) {
        occupied.add(`${c},${r}`);
      }
    }
  }

  // Also add adjacent pages (one step in each direction from occupied)
  const withAdjacent = new Set(occupied);
  for (const key of occupied) {
    const [c, r] = key.split(',').map(Number);
    withAdjacent.add(`${c},${r - 1}`);
    withAdjacent.add(`${c},${r + 1}`);
    withAdjacent.add(`${c - 1},${r}`);
    withAdjacent.add(`${c + 1},${r}`);
  }

  return withAdjacent;
}

function renderPages(nodes: CanvasNode[]) {
  const occupied = getOccupiedPages(nodes);
  const elements: JSX.Element[] = [];

  for (const key of occupied) {
    const [col, row] = key.split(',').map(Number);
    const x = MARGIN + col * (A4_WIDTH + PAGE_GAP);
    const y = row * (A4_HEIGHT + PAGE_GAP);

    elements.push(
      <Rect
        key={`page-bg-${key}`}
        x={x}
        y={y}
        width={A4_WIDTH}
        height={A4_HEIGHT}
        fill="#ffffff"
        shadowColor="rgba(0,0,0,0.08)"
        shadowBlur={8}
        shadowOffsetY={2}
        cornerRadius={2}
        listening={false}
      />,
    );

    // Dashed border
    const pts = [
      { id: 'top', points: [x, y, x + A4_WIDTH, y] },
      { id: 'bottom', points: [x, y + A4_HEIGHT, x + A4_WIDTH, y + A4_HEIGHT] },
      { id: 'left', points: [x, y, x, y + A4_HEIGHT] },
      { id: 'right', points: [x + A4_WIDTH, y, x + A4_WIDTH, y + A4_HEIGHT] },
    ];

    for (const { id, points } of pts) {
      elements.push(
        <Line
          key={`page-${id}-${key}`}
          points={points}
          stroke="#d4d4d4"
          strokeWidth={0.5}
          dash={[6, 4]}
          listening={false}
        />,
      );
    }
  }

  return elements;
}

/**
 * Vertical + horizontal extent of the scroll, in whole pages.
 *
 * Columns still sit `A4_WIDTH + PAGE_GAP` apart — scroll only removes the gap
 * BETWEEN stacked pages, so a multi-column page keeps its existing layout and
 * each column becomes its own scroll.
 */
function scrollExtent(nodes: CanvasNode[]) {
  const columns = new Set<number>([0]);
  let minY = 0;
  let maxY = 0;

  for (const node of nodes) {
    const colStart = columnAt(node.x);
    const colEnd = columnAt(node.x + (node.width || 200));
    for (let c = colStart; c <= colEnd; c++) columns.add(c);
    minY = Math.min(minY, node.y);
    maxY = Math.max(maxY, node.y + (node.height || 30));
  }

  return {
    columns,
    firstRow: Math.floor(minY / A4_HEIGHT),
    lastRow: Math.floor(maxY / A4_HEIGHT) + SCROLL_HEADROOM_PAGES,
  };
}

function renderScroll(nodes: CanvasNode[]) {
  const { columns, firstRow, lastRow } = scrollExtent(nodes);
  const elements: JSX.Element[] = [];

  const top = firstRow * A4_HEIGHT;
  const height = (lastRow - firstRow + 1) * A4_HEIGHT;

  for (const col of columns) {
    const x = columnLeft(col);

    elements.push(
      <Rect
        key={`scroll-bg-${col}`}
        name="scroll-sheet"
        x={x}
        y={top}
        width={A4_WIDTH}
        height={height}
        fill="#ffffff"
        shadowColor="rgba(0,0,0,0.08)"
        shadowBlur={8}
        shadowOffsetY={2}
        cornerRadius={2}
        listening={false}
      />,
      // One dashed outline around the whole strip, not per page — the point of
      // scroll mode is that the pages inside it do not look detached.
      <Rect
        key={`scroll-border-${col}`}
        x={x}
        y={top}
        width={A4_WIDTH}
        height={height}
        stroke="#d4d4d4"
        strokeWidth={0.5}
        dash={[6, 4]}
        cornerRadius={2}
        listening={false}
      />,
    );

    for (let row = firstRow + 1; row <= lastRow; row++) {
      const y = row * A4_HEIGHT;
      elements.push(
        <Line
          key={`scroll-sep-${col}-${row}`}
          name="scroll-separator"
          points={[x, y, x + A4_WIDTH, y]}
          stroke="#ededed"
          strokeWidth={1}
          listening={false}
        />,
        <Line
          key={`scroll-tick-l-${col}-${row}`}
          points={[x, y, x + SCROLL_SEPARATOR_TICK, y]}
          stroke="#cfcfcf"
          strokeWidth={1}
          listening={false}
        />,
        <Line
          key={`scroll-tick-r-${col}-${row}`}
          points={[x + A4_WIDTH - SCROLL_SEPARATOR_TICK, y, x + A4_WIDTH, y]}
          stroke="#cfcfcf"
          strokeWidth={1}
          listening={false}
        />,
      );
    }
  }

  return elements;
}

function renderGrid() {
  const elements: JSX.Element[] = [];
  const start = -GRID_EXTENT;
  const end = GRID_EXTENT;

  // Vertical lines
  for (let x = start; x <= end; x += GRID_SPACING) {
    const isMajor = x % (GRID_SPACING * 5) === 0;
    elements.push(
      <Line
        key={`grid-v-${x}`}
        points={[x, start, x, end]}
        stroke={isMajor ? '#c8c8c8' : '#dedede'}
        strokeWidth={isMajor ? 1 : 0.5}
        dash={isMajor ? undefined : [4, 6]}
        listening={false}
      />,
    );
  }

  // Horizontal lines
  for (let y = start; y <= end; y += GRID_SPACING) {
    const isMajor = y % (GRID_SPACING * 5) === 0;
    elements.push(
      <Line
        key={`grid-h-${y}`}
        points={[start, y, end, y]}
        stroke={isMajor ? '#c8c8c8' : '#dedede'}
        strokeWidth={isMajor ? 1 : 0.5}
        dash={isMajor ? undefined : [4, 6]}
        listening={false}
      />,
    );
  }

  return elements;
}

export function PageGuides({ mode, nodes }: PageGuidesProps) {
  if (mode === 'none') return null;
  if (mode === 'grid') return <Group listening={false}>{renderGrid()}</Group>;
  if (mode === 'scroll') return <Group listening={false}>{renderScroll(nodes)}</Group>;
  return <Group listening={false}>{renderPages(nodes)}</Group>;
}
