/**
 * Turns laid-out geometry into ordinary canvas nodes.
 *
 * Nothing here is a special "diagram object": every mark is the same ShapeNode
 * or TextNode a user gets by hand, so the moment it lands it can be selected,
 * dragged, restyled and deleted with the tools that already exist. That is the
 * whole reason we parse PlantUML ourselves instead of embedding its renderer.
 *
 * Members share a `groupId` equal to the diagram's id, which is how the overlay
 * finds them again and how membership stays derived rather than stored.
 */

import type { CanvasNode, ShapeNodeData, TextNodeData } from '../types/data';
import { generateId } from '../utils/ids';
import { MIN_TEXT_WIDTH } from '../utils/pageLayout';
import { MARKDOWN_PADDING } from '../utils/renderMarkdown';
import { displayLabel } from './layout';
import {
  BALL_RADIUS,
  FONT_LABEL,
  FONT_NAME,
  FONT_STEREO,
  INK,
  MUTED,
  FAINT,
  PAPER,
  RADIUS_CONTAINER,
  RADIUS_ENTITY,
  RULE,
  SOCKET_RADIUS,
  STROKE_CONTAINER,
  STROKE_ENTITY,
  STROKE_LINK,
  TINT,
} from './tokens';
import { isPort } from './types';
import type { Box, DiagramEntity, DiagramPort, DiagramSpec, LayoutResult, MeasureText } from './types';

/** Layer 1-5. Containers sit under links so a link crossing a container shows. */
const LAYER_CONTAINER = 2;
const LAYER_ENTITY = 3;
const LAYER_LINK = 4;
const LAYER_TEXT = 5;

const FONT_FAMILY = 'Inter, system-ui, sans-serif';

interface Emitter {
  nodes: CanvasNode[];
  groupId: string;
  offsetX: number;
  offsetY: number;
  measureText: MeasureText;
}

function shape(e: Emitter, box: Box, layer: number, data: ShapeNodeData): void {
  e.nodes.push({
    id: generateId(),
    type: 'shape',
    x: box.x + e.offsetX,
    y: box.y + e.offsetY,
    width: box.width,
    height: box.height,
    layer,
    groupId: e.groupId,
    data,
  });
}

/**
 * Centres a text run on (cx, cy). The node is sized to its measured width so the
 * markdown box does not stretch past the text and break the centring.
 */
function label(
  e: Emitter,
  cx: number,
  cy: number,
  text: string,
  fontSize: number,
  bold: boolean,
  fill: string,
): void {
  if (!text) return;
  // The markdown box is border-box with MARKDOWN_PADDING a side, so the usable
  // width is `width - 2 * padding`. Size to that or every label wraps.
  const measured = e.measureText(text, fontSize, bold ? 700 : 400);
  const width = Math.max(MIN_TEXT_WIDTH, Math.ceil(measured) + 2 * MARKDOWN_PADDING + 6);
  const height = Math.ceil(fontSize * 1.4) + 2 * MARKDOWN_PADDING;
  const data: TextNodeData = {
    text,
    fontSize,
    fontFamily: FONT_FAMILY,
    fontStyle: bold ? 'bold' : 'normal',
    fill,
  };
  e.nodes.push({
    id: generateId(),
    type: 'text',
    x: cx - width / 2 + e.offsetX,
    y: cy - height / 2 + e.offsetY,
    width,
    height,
    layer: LAYER_TEXT,
    groupId: e.groupId,
    data,
  });
}

function line(
  e: Emitter,
  from: { x: number; y: number },
  to: { x: number; y: number },
  arrow: boolean,
  dashed: boolean,
): void {
  e.nodes.push({
    id: generateId(),
    type: 'shape',
    x: from.x + e.offsetX,
    y: from.y + e.offsetY,
    width: to.x - from.x,
    height: to.y - from.y,
    layer: LAYER_LINK,
    groupId: e.groupId,
    data: {
      shapeType: arrow ? 'arrow' : 'line',
      fill: 'transparent',
      stroke: INK,
      strokeWidth: STROKE_LINK,
      strokeDash: dashed ? [5, 4] : [],
    },
  });
}

function emitEntity(e: Emitter, entity: DiagramEntity, boxes: Map<string, Box>): void {
  const box = boxes.get(entity.id);
  if (!box) return;

  const isContainer = entity.children.length > 0;

  if (entity.shape !== 'none') {
    shape(e, box, isContainer ? LAYER_CONTAINER : LAYER_ENTITY, {
      shapeType: 'rect',
      // Containers recede to paper so their children keep the tint and stay the figure.
      fill: isContainer || entity.shape === 'interface' ? PAPER : TINT,
      stroke: isContainer ? RULE : INK,
      strokeWidth: isContainer ? STROKE_CONTAINER : STROKE_ENTITY,
      strokeDash: [],
      cornerRadius: isContainer ? RADIUS_CONTAINER : RADIUS_ENTITY,
    });
  }

  const stereotype = entity.stereotype
    ? `«${entity.stereotype}»`
    : entity.shape === 'interface'
      ? '«interface»'
      : entity.isPart
        ? '«part»'
        : '«component»';

  if (isContainer) {
    // Header text is left-aligned in the container, like a real drawing.
    const cx = box.x + 18 + e.measureText(stereotype, FONT_STEREO, 400) / 2;
    label(e, cx, box.y + 17, stereotype, FONT_STEREO, false, FAINT);
    const nx = box.x + 18 + e.measureText(entity.label, FONT_NAME, 700) / 2;
    label(e, nx, box.y + 37, entity.label, FONT_NAME, true, INK);
  } else if (entity.shape === 'none') {
    label(e, box.x + box.width / 2, box.y + box.height / 2, entity.label, FONT_LABEL, false, MUTED);
  } else {
    const cx = box.x + box.width / 2;
    label(e, cx, box.y + 20, stereotype, FONT_STEREO, false, FAINT);
    label(e, cx, box.y + 40, displayLabel(entity), FONT_NAME, true, INK);
    if (entity.multiplicity) {
      const text = `[${entity.multiplicity}]`;
      const w = e.measureText(text, FONT_LABEL, 400);
      label(e, box.x + box.width - 12 - w / 2, box.y + 16, text, FONT_LABEL, false, MUTED);
    }
  }

  for (const port of entity.ports) emitPort(e, port, boxes);
  for (const child of entity.children) emitEntity(e, child, boxes);
}

function emitPort(e: Emitter, port: DiagramPort, boxes: Map<string, Box>): void {
  const box = boxes.get(port.id);
  if (!box) return;
  shape(e, box, LAYER_LINK, {
    shapeType: 'rect',
    fill: PAPER,
    stroke: INK,
    strokeWidth: STROKE_ENTITY,
    strokeDash: [],
    cornerRadius: 0,
  });
  if (!port.label) return;
  const w = e.measureText(port.label, FONT_LABEL, 400);
  const cx = port.direction === 'in' ? box.x - 10 - w / 2 : box.x + box.width + 10 + w / 2;
  label(e, cx, box.y + box.height / 2, port.label, FONT_LABEL, false, MUTED);
}

/**
 * Builds the canvas nodes for a laid-out diagram.
 *
 * `origin` is where the diagram's top-left lands on the page; layout works from
 * (0,0) and knows nothing about the canvas.
 */
export function materializeDiagram(
  spec: DiagramSpec,
  layout: LayoutResult,
  index: Map<string, DiagramEntity | DiagramPort>,
  groupId: string,
  origin: { x: number; y: number },
  measureText: MeasureText,
): CanvasNode[] {
  const e: Emitter = {
    nodes: [],
    groupId,
    offsetX: origin.x - layout.bounds.x,
    offsetY: origin.y - layout.bounds.y,
    measureText,
  };

  for (const root of spec.roots) emitEntity(e, root, layout.boxes);

  for (const rel of layout.relationships) {
    if (rel.joint) {
      // Assembly: ball nested in socket, with the socket opening toward the ball.
      const rad = (rel.angle * Math.PI) / 180;
      const ux = Math.cos(rad);
      const uy = Math.sin(rad);
      line(e, rel.from, { x: rel.joint.x - ux * SOCKET_RADIUS, y: rel.joint.y - uy * SOCKET_RADIUS }, false, false);
      line(e, rel.to, { x: rel.joint.x + ux * BALL_RADIUS, y: rel.joint.y + uy * BALL_RADIUS }, false, false);

      shape(
        e,
        {
          x: rel.joint.x - SOCKET_RADIUS,
          y: rel.joint.y - SOCKET_RADIUS,
          width: SOCKET_RADIUS * 2,
          height: SOCKET_RADIUS * 2,
        },
        LAYER_LINK,
        {
          shapeType: 'arc',
          fill: 'transparent',
          stroke: INK,
          strokeWidth: STROKE_ENTITY,
          strokeDash: [],
          // The cup's material is the half facing away from the ball.
          rotation: rel.angle + 90,
        },
      );
      shape(
        e,
        {
          x: rel.joint.x - BALL_RADIUS,
          y: rel.joint.y - BALL_RADIUS,
          width: BALL_RADIUS * 2,
          height: BALL_RADIUS * 2,
        },
        LAYER_LINK,
        {
          shapeType: 'circle',
          fill: PAPER,
          stroke: INK,
          strokeWidth: STROKE_ENTITY,
          strokeDash: [],
        },
      );
      if (rel.label) label(e, rel.joint.x, rel.joint.y - 24, rel.label, FONT_LABEL, false, MUTED);
      continue;
    }

    // Delegation and dependency both terminate in an arrowhead; an undirected
    // link (Mermaid's `---`) is the one case that must not grow one.
    line(e, rel.from, rel.to, rel.arrowhead !== false, rel.dashed);
    if (rel.label) {
      label(
        e,
        (rel.from.x + rel.to.x) / 2,
        (rel.from.y + rel.to.y) / 2 - 12,
        rel.label,
        FONT_LABEL,
        false,
        MUTED,
      );
    }
  }

  void index;
  return e.nodes;
}

/** Bounding box of a set of nodes, used to anchor the diagram overlay. */
export function boundsOfNodes(nodes: CanvasNode[]): Box | null {
  if (nodes.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const n of nodes) {
    const x0 = Math.min(n.x, n.x + n.width);
    const y0 = Math.min(n.y, n.y + n.height);
    const x1 = Math.max(n.x, n.x + n.width);
    const y1 = Math.max(n.y, n.y + n.height);
    minX = Math.min(minX, x0);
    minY = Math.min(minY, y0);
    maxX = Math.max(maxX, x1);
    maxY = Math.max(maxY, y1);
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

export { isPort };
