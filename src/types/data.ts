// ── Node types ──────────────────────────────────────────────

export type NodeType = 'text' | 'image' | 'shape' | 'gantt' | 'diagram';

export interface TextNodeData {
  text: string;
  fontSize: number;
  fontFamily: string;
  fontStyle: string; // 'normal' | 'bold' | 'italic' | 'bold italic'
  fill: string;
}

export interface ImageCrop {
  x: number; // crop offset from left (0-1 ratio)
  y: number; // crop offset from top (0-1 ratio)
  width: number; // visible width ratio (0-1)
  height: number; // visible height ratio (0-1)
}

export interface ImageNodeData {
  src: string; // base64 data URI or URL
  alt: string;
  naturalWidth: number;
  naturalHeight: number;
  crop?: ImageCrop; // PowerPoint-style non-destructive crop
  note?: string; // Optional caption/legend text
  rotation?: number; // Degrees (0, 90, 180, 270)
}

/**
 * `arc` is a stroked half-circle (v0.34+). It exists because a UML required
 * interface is a socket, and no combination of the other five can produce one.
 */
export type ShapeType = 'rect' | 'circle' | 'triangle' | 'arrow' | 'line' | 'arc';

export interface ShapeNodeData {
  shapeType: ShapeType;
  fill: string;           // hex color or 'transparent'
  stroke: string;         // hex color
  strokeWidth: number;    // 1-10
  strokeDash: number[];   // [] solid, [8,4] dashed, [2,2] dotted
  /** Rounded rect corners (v0.34+). UML states and node boxes are rounded. */
  cornerRadius?: number;
  /** Degrees (v0.34+). Orients an arc's opening and directional triangles. */
  rotation?: number;
}

// Gantt node — embeds a PowerPlanner chart document.
// The chart `doc` is the canonical GanttDocument schema; we store it inline
// so the notebook file remains fully self-contained.
export interface GanttNodeData {
  // Stored as `unknown` to avoid pulling the full GanttDocument type into
  // PowerNote's type system; the renderer validates at mount.
  doc: unknown;
  showCriticalPath?: boolean;
  showBaseline?: boolean;
  theme?: 'dark' | 'light' | 'print' | 'auto';
}

/**
 * A diagram frame (v0.34+) — a first-class canvas object, like an image.
 *
 * The node owns the PlantUML source; the marks it generates are ordinary shape
 * and text nodes carrying `groupId === <this node's id>`. So the frame is what
 * you select, move and delete, and its contents stay individually editable
 * underneath. Membership is derived from groupId, never stored.
 */
export interface DiagramNodeData {
  /** PlantUML text this diagram was built from. */
  source: string;
  /** Title shown on the frame band. */
  title: string;
}

export type NodeData =
  | TextNodeData
  | ImageNodeData
  | ShapeNodeData
  | GanttNodeData
  | DiagramNodeData;

export interface CanvasNode {
  id: string;
  type: NodeType;
  x: number;
  y: number;
  width: number;
  height: number;
  layer: number;          // z-index layer 1-5 (default: 3)
  data: NodeData;
  /** Flat group membership (v0.27+). Same id = same group. */
  groupId?: string | null;
}

// ── Drawing strokes ─────────────────────────────────────────

export interface Stroke {
  id: string;
  points: number[]; // flat [x1,y1,x2,y2,...] for Konva Line
  color: string;
  strokeWidth: number;
  /** Flat group membership (v0.27+), shared with shape nodes. */
  groupId?: string | null;
}

/** Optional group index entry (derived membership is canonical). */
export interface GroupRecord {
  id: string;
}

export interface DrawOptions {
  color: string;
  strokeWidth: number;
  eraserMode: 'stroke' | 'zone';
  eraserSize: number;
  isErasing: boolean;
}

// ── Hierarchy types ─────────────────────────────────────────

/**
 * A named vertical scroll — one column band on a page (v0.31+).
 *
 * The record owns IDENTITY only: a stable id and a title. Membership is
 * deliberately NOT stored. Which blocks belong to a scroll is derived from
 * their `x`, using the same band test the page guides draw with, so dragging a
 * block into another scroll's band moves it there — which is what dragging it
 * there means. Storing membership would let the two disagree, and an agent
 * appending to the "owning" scroll would then stack under a block that is no
 * longer visually in it.
 */
export interface ScrollRecord {
  id: string;
  /** Shown on the canvas header and in the sidebar. Empty = unnamed, no header drawn. */
  title: string;
  /** Band index. 0 is the leftmost scroll. */
  column: number;
}

export interface Page {
  id: string;
  title: string;
  nodes: CanvasNode[];
  strokes?: Stroke[];
  /** Optional group records for this page (ids only; members use groupId). */
  groups?: GroupRecord[];
  /** Named scroll bands (v0.31+). Hydrated for older pages on load. */
  scrolls?: ScrollRecord[];
}

export interface Section {
  id: string;
  title: string;
  pages: Page[];
}

/**
 * Canvas guide overlay: detached A4 page cards, one continuous vertical scroll
 * of A4 pages, dot/line grid, or blank.
 */
export type BackgroundMode = 'pages' | 'scroll' | 'grid' | 'none';

/** Canvas fill color presets (including paper texture tone) */
export type CanvasBgColor = '#ffffff' | '#f5f5f5' | '#e5e5e5' | 'paper';

/** Notebook-level UI preferences persisted inside `#powernote-data` */
export interface WorkspaceSettings {
  backgroundMode: BackgroundMode;
  bgColor: CanvasBgColor;
}

export interface WorkspaceData {
  version: string;
  filename: string;
  sections: Section[];
  editorVersion?: string; // App version that created/last updated this file
  saveRevision?: number;  // Incremented on each Ctrl+S save
  /** Canvas look — optional on older files; hydrated with defaults on load */
  settings?: WorkspaceSettings;
}

// ── Tool types ──────────────────────────────────────────────

export type ToolType = 'select' | 'text' | 'draw' | 'lasso' | 'shape' | 'image' | 'gantt' | 'diagram';

export interface ShapeOptions {
  shapeType: ShapeType;
  fill: string;
  stroke: string;
  strokeWidth: number;
  strokeDash: number[];
}

export interface TextOptions {
  fontSize: number;
  fontFamily: string;
  fontStyle: string;
  fill: string;
}

// ── Viewport ────────────────────────────────────────────────

export interface Viewport {
  x: number;
  y: number;
  scale: number;
}
