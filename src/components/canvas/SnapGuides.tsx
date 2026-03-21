import { Line } from 'react-konva';

export interface SnapLine {
  type: 'vertical' | 'horizontal';
  position: number; // x for vertical, y for horizontal
  start: number;    // start of the line (min y or min x)
  end: number;      // end of the line (max y or max x)
}

interface SnapGuidesProps {
  lines: SnapLine[];
}

export function SnapGuides({ lines }: SnapGuidesProps) {
  return (
    <>
      {lines.map((line, i) => (
        <Line
          key={i}
          points={
            line.type === 'vertical'
              ? [line.position, line.start - 20, line.position, line.end + 20]
              : [line.start - 20, line.position, line.end + 20, line.position]
          }
          stroke="#f43f5e"
          strokeWidth={1}
          dash={[4, 4]}
          listening={false}
        />
      ))}
    </>
  );
}

const SNAP_THRESHOLD = 8;

interface NodeBounds {
  id: string;
  left: number;
  right: number;
  top: number;
  bottom: number;
  centerX: number;
  centerY: number;
}

function getNodeBounds(node: { id: string; x: number; y: number; width: number; height: number }): NodeBounds {
  return {
    id: node.id,
    left: node.x,
    right: node.x + node.width,
    top: node.y,
    bottom: node.y + (node.height || 30),
    centerX: node.x + node.width / 2,
    centerY: node.y + (node.height || 30) / 2,
  };
}

export interface SnapResult {
  x: number;
  y: number;
  lines: SnapLine[];
}

/**
 * Calculate snap position and guide lines for a dragging node.
 * Returns the snapped position and the guide lines to display.
 */
export function calculateSnap(
  draggedNode: { id: string; x: number; y: number; width: number; height: number },
  allNodes: { id: string; x: number; y: number; width: number; height: number }[],
): SnapResult {
  const dragged = getNodeBounds(draggedNode);
  const others = allNodes
    .filter((n) => n.id !== draggedNode.id)
    .map(getNodeBounds);

  if (others.length === 0) {
    return { x: draggedNode.x, y: draggedNode.y, lines: [] };
  }

  let snapX = draggedNode.x;
  let snapY = draggedNode.y;
  const lines: SnapLine[] = [];

  // Vertical alignment (x-axis snapping)
  const xEdges = [
    { edge: dragged.left, label: 'left' },
    { edge: dragged.centerX, label: 'centerX' },
    { edge: dragged.right, label: 'right' },
  ];

  let bestXDist = SNAP_THRESHOLD + 1;
  let bestXSnap: { offset: number; line: SnapLine } | null = null;

  for (const other of others) {
    const otherXEdges = [other.left, other.centerX, other.right];
    for (const dragEdge of xEdges) {
      for (const otherEdge of otherXEdges) {
        const dist = Math.abs(dragEdge.edge - otherEdge);
        if (dist < bestXDist) {
          bestXDist = dist;
          const offset = otherEdge - dragEdge.edge;
          const minY = Math.min(dragged.top, other.top);
          const maxY = Math.max(dragged.bottom, other.bottom);
          bestXSnap = {
            offset,
            line: { type: 'vertical', position: otherEdge, start: minY, end: maxY },
          };
        }
      }
    }
  }

  if (bestXSnap && bestXDist <= SNAP_THRESHOLD) {
    snapX += bestXSnap.offset;
    lines.push(bestXSnap.line);
  }

  // Horizontal alignment (y-axis snapping)
  const yEdges = [
    { edge: dragged.top, label: 'top' },
    { edge: dragged.centerY, label: 'centerY' },
    { edge: dragged.bottom, label: 'bottom' },
  ];

  let bestYDist = SNAP_THRESHOLD + 1;
  let bestYSnap: { offset: number; line: SnapLine } | null = null;

  for (const other of others) {
    const otherYEdges = [other.top, other.centerY, other.bottom];
    for (const dragEdge of yEdges) {
      for (const otherEdge of otherYEdges) {
        const dist = Math.abs(dragEdge.edge - otherEdge);
        if (dist < bestYDist) {
          bestYDist = dist;
          const offset = otherEdge - dragEdge.edge;
          const minX = Math.min(dragged.left, other.left);
          const maxX = Math.max(dragged.right, other.right);
          bestYSnap = {
            offset,
            line: { type: 'horizontal', position: otherEdge, start: minX, end: maxX },
          };
        }
      }
    }
  }

  if (bestYSnap && bestYDist <= SNAP_THRESHOLD) {
    snapY += bestYSnap.offset;
    lines.push(bestYSnap.line);
  }

  return { x: snapX, y: snapY, lines };
}
