/**
 * Turns a spec into geometry. Pure: same spec plus same measurer gives the same
 * boxes every time, which is what makes it testable without a DOM.
 *
 * Nesting falls out of measurement rather than needing a hierarchical layout
 * engine: a container's intrinsic size IS the bounding box of its laid-out
 * children, so `measure` recurses and the parent then treats it as one box. That
 * is why dagre-class layered layout is enough here and elkjs (~500KB, against a
 * single-file app) is not needed.
 */

import {
  ASSEMBLY_MIN_SPAN,
  ENTITY_HEIGHT,
  ENTITY_MIN_WIDTH,
  FONT_LABEL,
  FONT_NAME,
  FONT_STEREO,
  GAP,
  HEADER,
  PAD,
  PORT_SIZE,
  WEIGHT_NAME,
} from './tokens';
import { isPort } from './types';
import type {
  Box,
  ConnectorKind,
  DiagramEntity,
  DiagramPort,
  DiagramSpec,
  LaidOutRelationship,
  LayoutResult,
  MeasureText,
  Point,
} from './types';

/** Text shown inside an entity: a part reads `role : Type`, anything else its label. */
export function displayLabel(entity: DiagramEntity): string {
  return entity.isPart && entity.role && entity.typeName ? `${entity.role} : ${entity.typeName}` : entity.label;
}

interface Sized {
  width: number;
  height: number;
  /** Width of the laid-out child row, so `place` can centre it. */
  rowWidth: number;
  rowHeight: number;
}

function measure(entity: DiagramEntity, measureText: MeasureText, sizes: Map<string, Sized>): Sized {
  for (const child of entity.children) measure(child, measureText, sizes);

  if (entity.children.length === 0) {
    let width = Math.max(ENTITY_MIN_WIDTH, measureText(displayLabel(entity), FONT_NAME, WEIGHT_NAME) + 48);
    if (entity.stereotype) {
      width = Math.max(width, measureText(`«${entity.stereotype}»`, FONT_STEREO, 400) + 48);
    }
    if (entity.multiplicity) {
      width += measureText(`[${entity.multiplicity}]`, FONT_LABEL, 400) + 14;
    }
    const sized: Sized = { width: Math.round(width), height: ENTITY_HEIGHT, rowWidth: 0, rowHeight: 0 };
    sizes.set(entity.id, sized);
    return sized;
  }

  let rowWidth = 0;
  let rowHeight = 0;
  for (const child of entity.children) {
    const cs = sizes.get(child.id)!;
    rowWidth += cs.width;
    rowHeight = Math.max(rowHeight, cs.height);
  }
  rowWidth += GAP * (entity.children.length - 1);

  const headerWidth = measureText(entity.label, FONT_NAME, WEIGHT_NAME) + 2 * PAD + 48;
  const sized: Sized = {
    width: Math.round(Math.max(rowWidth + 2 * PAD, headerWidth)),
    height: Math.round(HEADER + rowHeight + PAD),
    rowWidth,
    rowHeight,
  };
  sizes.set(entity.id, sized);
  return sized;
}

function place(
  entity: DiagramEntity,
  x: number,
  y: number,
  sizes: Map<string, Sized>,
  boxes: Map<string, Box>,
): void {
  const sized = sizes.get(entity.id)!;
  boxes.set(entity.id, { x, y, width: sized.width, height: sized.height });

  if (entity.children.length > 0) {
    let cursor = x + (sized.width - sized.rowWidth) / 2;
    const top = y + HEADER;
    for (const child of entity.children) {
      const cs = sizes.get(child.id)!;
      place(child, cursor, top + (sized.rowHeight - cs.height) / 2, sizes, boxes);
      cursor += cs.width + GAP;
    }
  }

  // Public ports straddle the boundary: inbound left, outbound right.
  const inbound = entity.ports.filter((p) => p.direction === 'in');
  const outbound = entity.ports.filter((p) => p.direction === 'out');
  inbound.forEach((port, i) => {
    boxes.set(port.id, {
      x: x - PORT_SIZE / 2,
      y: y + (sized.height * (i + 1)) / (inbound.length + 1) - PORT_SIZE / 2,
      width: PORT_SIZE,
      height: PORT_SIZE,
    });
  });
  outbound.forEach((port, i) => {
    boxes.set(port.id, {
      x: x + sized.width - PORT_SIZE / 2,
      y: y + (sized.height * (i + 1)) / (outbound.length + 1) - PORT_SIZE / 2,
      width: PORT_SIZE,
      height: PORT_SIZE,
    });
  });
}

function centre(box: Box): Point {
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/** Where a link meets a box: its boundary along the line toward the other end. */
function boundaryPoint(box: Box, toward: Point, exact: boolean): Point {
  const c = centre(box);
  if (exact) return c;
  const dx = toward.x - c.x;
  const dy = toward.y - c.y;
  if (dx === 0 && dy === 0) return c;
  const sx = dx === 0 ? Infinity : box.width / 2 / Math.abs(dx);
  const sy = dy === 0 ? Infinity : box.height / 2 / Math.abs(dy);
  const s = Math.min(sx, sy);
  return { x: c.x + dx * s, y: c.y + dy * s };
}

/**
 * UML's rule, applied rather than asked for: a connector with an end on a port
 * that is not on a part is a delegation; otherwise it is an assembly. Authors
 * name endpoints, the app decides what it drew.
 */
export function deriveConnectorKind(
  from: DiagramEntity | DiagramPort | undefined,
  to: DiagramEntity | DiagramPort | undefined,
  index: Map<string, DiagramEntity | DiagramPort>,
  hasLabel: boolean,
): ConnectorKind {
  if (!from || !to) return 'dependency';
  const port = isPort(from) ? from : isPort(to) ? to : null;
  if (port) {
    const owner = index.get(port.ownerId);
    const ownerIsPart = !!owner && !isPort(owner) && owner.children.length === 0;
    return ownerIsPart ? 'assembly' : 'delegation';
  }
  return hasLabel ? 'assembly' : 'dependency';
}

export function layoutDiagram(
  spec: DiagramSpec,
  index: Map<string, DiagramEntity | DiagramPort>,
  measureText: MeasureText,
): LayoutResult {
  const sizes = new Map<string, Sized>();
  const boxes = new Map<string, Box>();

  let cursor = 0;
  for (const root of spec.roots) {
    measure(root, measureText, sizes);
    place(root, cursor, 0, sizes, boxes);
    cursor += sizes.get(root.id)!.width + GAP + 24;
  }

  const relationships: LaidOutRelationship[] = [];
  for (const rel of spec.relationships) {
    const fromBox = boxes.get(rel.fromId);
    const toBox = boxes.get(rel.toId);
    if (!fromBox || !toBox) continue;

    const fromEntity = index.get(rel.fromId);
    const toEntity = index.get(rel.toId);
    // A flow edge is an arrow whatever it is labelled; only UML connectors get
    // their kind derived from where their ends land.
    const kind = rel.flow
      ? 'dependency'
      : deriveConnectorKind(fromEntity, toEntity, index, !!rel.label);

    const from = boundaryPoint(fromBox, centre(toBox), isPort(fromEntity));
    const to = boundaryPoint(toBox, centre(fromBox), isPort(toEntity));
    const span = Math.hypot(to.x - from.x, to.y - from.y);
    const angle = (Math.atan2(to.y - from.y, to.x - from.x) * 180) / Math.PI;

    relationships.push({
      ...rel,
      kind,
      from,
      to,
      angle,
      joint:
        kind === 'assembly' && span > ASSEMBLY_MIN_SPAN
          ? { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 }
          : undefined,
    });
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const box of boxes.values()) {
    minX = Math.min(minX, box.x);
    minY = Math.min(minY, box.y);
    maxX = Math.max(maxX, box.x + box.width);
    maxY = Math.max(maxY, box.y + box.height);
  }
  if (!Number.isFinite(minX)) {
    minX = 0;
    minY = 0;
    maxX = 0;
    maxY = 0;
  }

  return { boxes, relationships, bounds: { x: minX, y: minY, width: maxX - minX, height: maxY - minY } };
}

/** Browser text measurement. Cached context — creating one per call is slow. */
let sharedContext: CanvasRenderingContext2D | null = null;

export const canvasMeasureText: MeasureText = (text, fontSize, fontWeight) => {
  if (typeof document === 'undefined') return text.length * fontSize * 0.55;
  if (!sharedContext) sharedContext = document.createElement('canvas').getContext('2d');
  if (!sharedContext) return text.length * fontSize * 0.55;
  sharedContext.font = `${fontWeight} ${fontSize}px Inter, system-ui, sans-serif`;
  return sharedContext.measureText(text ?? '').width;
};
