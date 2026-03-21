// ── Node types ──────────────────────────────────────────────

export type NodeType = 'text' | 'image' | 'shape';

export interface TextNodeData {
  text: string;
  fontSize: number;
  fontFamily: string;
  fontStyle: string; // 'normal' | 'bold' | 'italic' | 'bold italic'
  fill: string;
}

export interface ImageNodeData {
  src: string; // base64 data URI or URL
  alt: string;
  naturalWidth: number;
  naturalHeight: number;
}

export type NodeData = TextNodeData | ImageNodeData;

export interface CanvasNode {
  id: string;
  type: NodeType;
  x: number;
  y: number;
  width: number;
  height: number;
  data: NodeData;
}

// ── Hierarchy types ─────────────────────────────────────────

export interface Page {
  id: string;
  title: string;
  nodes: CanvasNode[];
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

export type ToolType = 'select' | 'text' | 'draw';

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
