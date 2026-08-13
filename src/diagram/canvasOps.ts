/**
 * The bridge between the pure pipeline and the canvas store.
 *
 * Kept out of the React component so the rules — where contents sit inside the
 * frame, what counts as a member, how the frame sizes itself — are testable and
 * reusable rather than tangled in render code.
 */

import type { CanvasNode, DiagramNodeData } from '../types/data';
import { buildDiagram } from './index';
import type { DiagramFormat } from './index';
import type { Diagnostic } from './types';

/** Space between the frame edge and its contents. */
export const FRAME_PAD = 20;
/** Title band across the top of the frame. */
export const FRAME_TITLE_H = 34;
export const FRAME_MIN_W = 260;
export const FRAME_MIN_H = 120;

/**
 * Members are the nodes carrying the frame's id as their groupId, excluding the
 * frame itself. Derived, never stored — drag a mark out of the group and it
 * stops being part of the diagram.
 */
export function diagramMembers(nodes: CanvasNode[], frameId: string): CanvasNode[] {
  return nodes.filter((n) => n.groupId === frameId && n.id !== frameId);
}

export interface RebuildResult {
  /** Replacement contents. Empty when nothing could be understood. */
  contents: CanvasNode[];
  /** Frame size that fits those contents. */
  frame: { width: number; height: number };
  diagnostics: Diagnostic[];
}

/**
 * Rebuilds a frame's contents from its source and sizes the frame to fit.
 *
 * Pure: it reads the frame's position and returns what should replace its
 * contents. The caller decides whether to commit, which is what lets a source
 * that parses to nothing leave the existing drawing alone.
 *
 * `format` is for a caller that was told the language. A redraw from the source
 * editor leaves it off so the grammar follows whatever the user typed, rather
 * than what the frame was first created from.
 */
export function rebuildDiagram(
  frame: CanvasNode,
  source: string,
  format?: DiagramFormat,
): RebuildResult {
  const built = buildDiagram(source, {
    groupId: frame.id,
    origin: { x: frame.x + FRAME_PAD, y: frame.y + FRAME_TITLE_H + FRAME_PAD },
    format,
  });

  if (built.nodes.length === 0 || !built.bounds) {
    return {
      contents: [],
      frame: { width: frame.width, height: frame.height },
      diagnostics: built.diagnostics,
    };
  }

  // The frame wraps whatever the layout produced, plus padding on every side.
  const width = Math.max(FRAME_MIN_W, Math.round(built.bounds.width + FRAME_PAD * 2));
  const height = Math.max(
    FRAME_MIN_H,
    Math.round(built.bounds.height + FRAME_TITLE_H + FRAME_PAD * 2),
  );

  return { contents: built.nodes, frame: { width, height }, diagnostics: built.diagnostics };
}

/** Reads the source off a frame node, tolerating a node of the wrong type. */
export function diagramSourceOf(node: CanvasNode): string {
  const data = node.data as DiagramNodeData;
  return typeof data?.source === 'string' ? data.source : '';
}

export const STARTER_DIAGRAM = `@startuml
component "gateway" as gw {
  portin telemetry
  portout storage
  component "broker : MqttBroker [1]" as broker
  component "buffer : StoreForward [1..*]" as buffer
  broker --> buffer : Queue
  telemetry --> broker
  buffer --> storage
}
@enduml`;
