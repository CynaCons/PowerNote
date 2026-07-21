/**
 * Coordinated group / ungroup across canvas + draw stores.
 */
import { useCanvasStore, undoBatchStart, undoBatchEnd } from '../stores/useCanvasStore';
import { useDrawStore, pushStrokeUndo, replaceStrokesSilent } from '../stores/useDrawStore';
import { useGroupStore } from '../stores/useGroupStore';
import { useWorkspaceStore } from '../stores/useWorkspaceStore';
import {
  assignGroupIds,
  buildNewGroupId,
  canGroupSelection,
  clearGroupIds,
  getGroupMembers,
} from './groups';
import { showToast } from '../components/layout/Toast';

export function groupSelection(): boolean {
  const canvas = useCanvasStore.getState();
  const draw = useDrawStore.getState();
  const selectedNodes = canvas.nodes.filter((n) =>
    canvas.selectedNodeIds.includes(n.id),
  );
  const check = canGroupSelection(selectedNodes, draw.selectedStrokeIds);
  if (!check.ok) {
    showToast(check.reason, 'error');
    return false;
  }

  const groupId = buildNewGroupId();
  undoBatchStart(canvas.nodes);
  pushStrokeUndo(draw.strokes);

  const next = assignGroupIds(
    canvas.nodes,
    draw.strokes,
    canvas.selectedNodeIds,
    draw.selectedStrokeIds,
    groupId,
  );

  useCanvasStore.setState({ nodes: next.nodes });
  replaceStrokesSilent(next.strokes);
  useWorkspaceStore.getState().markDirty();
  undoBatchEnd();

  // Select full group
  const members = getGroupMembers(groupId, next.nodes, next.strokes);
  useCanvasStore.setState({ selectedNodeIds: members.nodeIds });
  draw.selectStrokes(members.strokeIds);
  showToast('Grouped', 'success');
  return true;
}

export function ungroupSelection(): boolean {
  const canvas = useCanvasStore.getState();
  const draw = useDrawStore.getState();
  const groupIds = new Set<string>();

  for (const id of canvas.selectedNodeIds) {
    const n = canvas.nodes.find((nn) => nn.id === id);
    if (n?.groupId) groupIds.add(n.groupId);
  }
  for (const id of draw.selectedStrokeIds) {
    const s = draw.strokes.find((ss) => ss.id === id);
    if (s?.groupId) groupIds.add(s.groupId);
  }

  if (groupIds.size === 0) {
    showToast('Nothing to ungroup', 'info');
    return false;
  }

  undoBatchStart(canvas.nodes);
  pushStrokeUndo(draw.strokes);
  const next = clearGroupIds(canvas.nodes, draw.strokes, groupIds);
  useCanvasStore.setState({ nodes: next.nodes });
  replaceStrokesSilent(next.strokes);
  useWorkspaceStore.getState().markDirty();
  undoBatchEnd();

  useGroupStore.getState().exitIsolation();
  showToast('Ungrouped', 'success');
  return true;
}
