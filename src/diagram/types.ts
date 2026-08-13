/**
 * Shared vocabulary for agent- and user-authored diagrams.
 *
 * The split this file encodes is the whole design: a SPEC says what exists and
 * what connects to what, and carries no geometry at all. Every coordinate is
 * computed downstream by `layout.ts` from real text metrics. Authors — human or
 * agent — that supply coordinates produce overlapping boxes and overflowing
 * labels, so they are not given the chance.
 */

/** What an entity is drawn as. `none` is unanchored floating text. */
export type EntityShape = 'component' | 'container' | 'interface' | 'none';

export type PortDirection = 'in' | 'out';

/**
 * UML derives connector kind from a rule rather than letting the author declare
 * it: an end on a port that is not on a part is a delegation, otherwise an
 * assembly. `deriveConnectorKind` in `layout.ts` applies it.
 */
export type ConnectorKind = 'assembly' | 'delegation' | 'dependency';

export interface DiagramPort {
  id: string;
  label: string;
  direction: PortDirection;
  /** Entity this port sits on the boundary of. */
  ownerId: string;
}

export interface DiagramEntity {
  id: string;
  /** Display text as written by the author, before any part split. */
  label: string;
  shape: EntityShape;
  /** Rendered in guillemets above the name. */
  stereotype?: string;
  /** Set when `label` parsed as a composite-structure part: `role : Type [mult]`. */
  isPart: boolean;
  role?: string;
  typeName?: string;
  multiplicity?: string;
  children: DiagramEntity[];
  ports: DiagramPort[];
}

export interface DiagramRelationship {
  fromId: string;
  toId: string;
  label?: string;
  dashed: boolean;
  /** Source line, so a diagnostic can point back at what the author wrote. */
  sourceLine: number;
}

export interface DiagramSpec {
  roots: DiagramEntity[];
  relationships: DiagramRelationship[];
}

export type DiagnosticSeverity = 'error' | 'ignored';

export interface Diagnostic {
  /** 1-based source line; 0 when the note is about the input as a whole. */
  line: number;
  severity: DiagnosticSeverity;
  message: string;
}

export interface ParseResult {
  spec: DiagramSpec;
  diagnostics: Diagnostic[];
  /** Flat index of every entity and port, keyed by id. */
  index: Map<string, DiagramEntity | DiagramPort>;
}

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface LaidOutRelationship extends DiagramRelationship {
  kind: ConnectorKind;
  from: Point;
  to: Point;
  /** Midpoint of an assembly, where the ball nests in the socket. */
  joint?: Point;
  /** Degrees, pointing from `from` toward `to`. Orients sockets and arrowheads. */
  angle: number;
}

export interface LayoutResult {
  /** Entity and port ids to their placed box. */
  boxes: Map<string, Box>;
  relationships: LaidOutRelationship[];
  /** Union of everything placed, before any translation onto the canvas. */
  bounds: Box;
}

/**
 * Injected so layout stays pure and testable. The browser implementation
 * measures with a canvas 2d context; tests pass a deterministic stub.
 */
export type MeasureText = (text: string, fontSize: number, fontWeight: number) => number;

export function isPort(v: DiagramEntity | DiagramPort | undefined): v is DiagramPort {
  return !!v && 'direction' in v;
}
