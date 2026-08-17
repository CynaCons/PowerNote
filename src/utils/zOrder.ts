/**
 * Paint order for canvas nodes.
 *
 * Nodes carry a layer of 1..5 and are painted low to high. A diagram breaks
 * that flat model, because its marks use the same five layers among THEMSELVES:
 * containers at 2 recede behind entities at 3, links at 4 cross under text at 5.
 * That internal spread is what makes the drawing legible, so a diagram cannot be
 * moved by shifting its members — there is nowhere for them to go, and
 * flattening them to one layer would let a later entity's box paint over an
 * earlier entity's label.
 *
 * So a diagram's layer is a BAND rather than a position: members sort inside
 * whatever layer their frame sits at, keeping their order relative to each
 * other. Changing the frame's layer then moves the whole diagram past other
 * content in one step, which is the only thing a person means by it.
 */

import type { CanvasNode } from '../types/data';

const DEFAULT_LAYER = 3;

/** The frame's layer sits below its own contents, which is where it belongs. */
const FRAME_WITHIN_BAND = -1;

/**
 * Nodes in paint order, lowest first.
 *
 * Stable: nodes that tie on both keys keep their insertion order, which is what
 * the SVG transpiler relies on to reproduce document order.
 */
export function sortNodesForPaint(nodes: CanvasNode[]): CanvasNode[] {
  // Frames only — a groupId pointing at anything else (an ordinary Ctrl+G
  // group) has no band and must keep using the node's own layer.
  const frameLayer = new Map<string, number>();
  for (const node of nodes) {
    if (node.type === 'diagram') frameLayer.set(node.id, node.layer ?? DEFAULT_LAYER);
  }

  const keyOf = (node: CanvasNode): [number, number] => {
    const own = node.layer ?? DEFAULT_LAYER;
    if (node.type === 'diagram') return [own, FRAME_WITHIN_BAND];

    const band = node.groupId ? frameLayer.get(node.groupId) : undefined;
    return band === undefined ? [own, 0] : [band, own];
  };

  return [...nodes]
    .map((node, index) => ({ node, key: keyOf(node), index }))
    .sort((a, b) => a.key[0] - b.key[0] || a.key[1] - b.key[1] || a.index - b.index)
    .map((entry) => entry.node);
}
