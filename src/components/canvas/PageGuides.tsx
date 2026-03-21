import { Rect, Line, Group } from 'react-konva';
import type { CanvasNode } from '../../types/data';

// A4 at 96 DPI
const A4_WIDTH = 794;
const A4_HEIGHT = 1123;
const PAGE_GAP = 40;
const MARGIN = 60;

// Grid mode spacing
const GRID_SPACING = 100;
const GRID_EXTENT = 5000; // how far grid lines extend

export type BackgroundMode = 'pages' | 'grid' | 'none';

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
  return <Group listening={false}>{renderPages(nodes)}</Group>;
}
