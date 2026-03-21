// ── Node types ──────────────────────────────────────────────

export type NodeType = 'text' | 'image' | 'shape' | 'container';

export interface TextNodeData {
  text: string;
  fontSize: number;
  fontFamily: string;
  fontStyle: string; // 'normal' | 'bold' | 'italic' | 'bold italic'
  fill: string;
}

export interface ContainerNodeData {
  title: string;
  isCollapsed: boolean;
  headerHeight: number;
  fill: string;
  borderColor: string;
}

export type NodeData = TextNodeData | ContainerNodeData;

export interface CanvasNode {
  id: string;
  type: NodeType;
  x: number;
  y: number;
  width: number;
  height: number;
  parentContainerId?: string | null;
  data: NodeData;
}

// ── Type guards ─────────────────────────────────────────────

export function isTextNode(node: CanvasNode): node is CanvasNode & { data: TextNodeData } {
  return node.type === 'text';
}

export function isContainerNode(node: CanvasNode): node is CanvasNode & { data: ContainerNodeData } {
  return node.type === 'container';
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

export type ToolType = 'select' | 'text' | 'draw' | 'container';

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
