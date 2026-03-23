// ── Node types ──────────────────────────────────────────────

export type NodeType = 'text' | 'image' | 'shape';

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
}

export type ShapeType = 'rect' | 'circle' | 'triangle' | 'arrow' | 'line';

export interface ShapeNodeData {
  shapeType: ShapeType;
  fill: string;           // hex color or 'transparent'
  stroke: string;         // hex color
  strokeWidth: number;    // 1-10
  strokeDash: number[];   // [] solid, [8,4] dashed, [2,2] dotted
}

export type NodeData = TextNodeData | ImageNodeData | ShapeNodeData;

export interface CanvasNode {
  id: string;
  type: NodeType;
  x: number;
  y: number;
  width: number;
  height: number;
  layer: number;          // z-index layer 1-5 (default: 3)
  data: NodeData;
}

// ── Drawing strokes ─────────────────────────────────────────

export interface Stroke {
  id: string;
  points: number[]; // flat [x1,y1,x2,y2,...] for Konva Line
  color: string;
  strokeWidth: number;
}

export interface DrawOptions {
  color: string;
  strokeWidth: number;
  eraserMode: 'stroke' | 'zone';
  eraserSize: number;
  isErasing: boolean;
}

// ── Hierarchy types ─────────────────────────────────────────

export interface Page {
  id: string;
  title: string;
  nodes: CanvasNode[];
  strokes?: Stroke[];
}

export interface Section {
  id: string;
  title: string;
  pages: Page[];
}

export interface WorkspaceData {
  version: string;
  filename: string;
  sections: Section[];
}

// ── Tool types ──────────────────────────────────────────────

export type ToolType = 'select' | 'text' | 'draw' | 'lasso' | 'shape';

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
