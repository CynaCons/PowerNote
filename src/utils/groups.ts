import type { CanvasNode, Stroke } from '../types/data';
import { generateId } from './ids';

export interface GroupMembers {
  nodeIds: string[];
  strokeIds: string[];
  groupId: string;
}

export function getGroupMembers(
  groupId: string,
  nodes: CanvasNode[],
  strokes: Stroke[],
): GroupMembers {
  return {
    groupId,
    nodeIds: nodes.filter((n) => n.groupId === groupId).map((n) => n.id),
    strokeIds: strokes.filter((s) => s.groupId === groupId).map((s) => s.id),
  };
}

export function memberCount(m: GroupMembers): number {
  return m.nodeIds.length + m.strokeIds.length;
}

/** Selection is groupable: only shapes + strokes, at least 2 total. */
export function canGroupSelection(
  selectedNodes: CanvasNode[],
  selectedStrokeIds: string[],
): { ok: true } | { ok: false; reason: string } {
  const nonShape = selectedNodes.filter((n) => n.type !== 'shape');
  if (nonShape.length > 0) {
    return {
      ok: false,
      reason: 'Only shapes and drawings can be grouped',
    };
  }
  const total = selectedNodes.length + selectedStrokeIds.length;
  if (total < 2) {
    return { ok: false, reason: 'Select at least two shapes or drawings to group' };
  }
  return { ok: true };
}

export function buildNewGroupId(): string {
  return `grp_${generateId()}`;
}

/**
 * Assign groupId to selected shapes + strokes.
 * If any already belong to a group, they are reassigned (flat regroup).
 */
export function assignGroupIds(
  nodes: CanvasNode[],
  strokes: Stroke[],
  selectedNodeIds: string[],
  selectedStrokeIds: string[],
  groupId: string,
): { nodes: CanvasNode[]; strokes: Stroke[] } {
  const nSet = new Set(selectedNodeIds);
  const sSet = new Set(selectedStrokeIds);
  return {
    nodes: nodes.map((n) => (nSet.has(n.id) ? { ...n, groupId } : n)),
    strokes: strokes.map((s) => (sSet.has(s.id) ? { ...s, groupId } : s)),
  };
}

/** Clear groupId on all members of the given groups (or selected members). */
export function clearGroupIds(
  nodes: CanvasNode[],
  strokes: Stroke[],
  groupIds: Set<string>,
): { nodes: CanvasNode[]; strokes: Stroke[] } {
  return {
    nodes: nodes.map((n) =>
      n.groupId && groupIds.has(n.groupId) ? { ...n, groupId: null } : n,
    ),
    strokes: strokes.map((s) =>
      s.groupId && groupIds.has(s.groupId) ? { ...s, groupId: null } : s,
    ),
  };
}

export function expandSelectionForGroup(
  nodeId: string,
  nodes: CanvasNode[],
  strokes: Stroke[],
  additive: boolean,
  currentSelected: string[],
  currentStrokeSelected: string[],
): { nodeIds: string[]; strokeIds: string[] } {
  const node = nodes.find((n) => n.id === nodeId);
  if (!node?.groupId) {
    if (additive) {
      const already = currentSelected.includes(nodeId);
      return {
        nodeIds: already
          ? currentSelected.filter((id) => id !== nodeId)
          : [...currentSelected, nodeId],
        strokeIds: currentStrokeSelected,
      };
    }
    return { nodeIds: [nodeId], strokeIds: [] };
  }

  const members = getGroupMembers(node.groupId, nodes, strokes);
  if (additive) {
    // Toggle whole group in/out of selection
    const allIn = members.nodeIds.every((id) => currentSelected.includes(id));
    if (allIn) {
      const drop = new Set(members.nodeIds);
      return {
        nodeIds: currentSelected.filter((id) => !drop.has(id)),
        strokeIds: currentStrokeSelected.filter((id) => !members.strokeIds.includes(id)),
      };
    }
    return {
      nodeIds: Array.from(new Set([...currentSelected, ...members.nodeIds])),
      strokeIds: Array.from(new Set([...currentStrokeSelected, ...members.strokeIds])),
    };
  }
  return { nodeIds: members.nodeIds, strokeIds: members.strokeIds };
}
