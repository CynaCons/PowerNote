import type { CanvasNode, ImageNodeData } from '../types/data';

export const DEFAULT_MINI_WIDTH = 160;
export const MIN_MINI_WIDTH = 48;
export const MAX_MINI_WIDTH = 480;

export function clampMiniWidth(width: number): number {
  if (!Number.isFinite(width)) return DEFAULT_MINI_WIDTH;
  return Math.min(MAX_MINI_WIDTH, Math.max(MIN_MINI_WIDTH, width));
}

function isImageData(data: CanvasNode['data']): data is ImageNodeData {
  return 'src' in data && 'naturalWidth' in data;
}

/**
 * Toggle Mini on or off. Returns a single `updateNode` patch so stash +
 * display-size change is one undoable step. Node width/height always become
 * the currently displayed size.
 */
export function imageMiniTogglePatch(node: CanvasNode): Partial<CanvasNode> | null {
  if (node.type !== 'image' || !isImageData(node.data)) return null;
  const data = node.data;

  if (data.mini) {
    const nextData: ImageNodeData = { ...data, mini: false };
    delete nextData.fullWidth;
    delete nextData.fullHeight;
    return {
      width: data.fullWidth ?? node.width,
      height: data.fullHeight ?? node.height,
      data: nextData,
    };
  }

  const fullWidth = node.width;
  const fullHeight = node.height;
  const aspect = fullWidth > 0 ? fullHeight / fullWidth : 1;
  const miniWidth = clampMiniWidth(data.miniWidth ?? DEFAULT_MINI_WIDTH);
  return {
    width: miniWidth,
    height: miniWidth * aspect,
    data: {
      ...data,
      mini: true,
      miniWidth,
      fullWidth,
      fullHeight,
    },
  };
}

/**
 * While mini, any width write (transformer, corner handles, tests simulating
 * them) also writes `miniWidth` and clamps display size to [48, 480].
 */
export function syncImageMiniOnUpdate(
  node: CanvasNode,
  updates: Partial<CanvasNode>,
): CanvasNode {
  const next: CanvasNode = { ...node, ...updates };
  if (next.type !== 'image' || !isImageData(next.data)) return next;

  const data: ImageNodeData = { ...next.data };
  if (!data.mini) return next;
  if (updates.width === undefined) return next;

  const requested = updates.width;
  const clamped = clampMiniWidth(requested);
  if (clamped !== next.width && requested !== 0) {
    if (updates.height !== undefined) {
      next.height = updates.height * (clamped / requested);
    }
    next.width = clamped;
  } else {
    next.width = clamped;
  }
  data.miniWidth = clamped;
  next.data = data;
  return next;
}
