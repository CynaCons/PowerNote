import { useGroupStore } from '../../stores/useGroupStore';
import { useCanvasStore } from '../../stores/useCanvasStore';
import { useDrawStore } from '../../stores/useDrawStore';
import { getGroupMembers } from '../../utils/groups';
import './GroupIsolationBar.css';

/**
 * Breadcrumb shown while editing a group's members in isolation.
 */
export function GroupIsolationBar() {
  const editingGroupId = useGroupStore((s) => s.editingGroupId);
  if (!editingGroupId) return null;

  const handleDone = () => {
    const gid = editingGroupId;
    useGroupStore.getState().exitIsolation();
    const canvas = useCanvasStore.getState();
    const draw = useDrawStore.getState();
    const members = getGroupMembers(gid, canvas.nodes, draw.strokes);
    useCanvasStore.setState({ selectedNodeIds: members.nodeIds });
    draw.selectStrokes(members.strokeIds);
  };

  return (
    <div className="group-isolation-bar" data-testid="group-isolation-bar">
      <span className="group-isolation-bar__label">Editing group</span>
      <span className="group-isolation-bar__hint">Esc to exit</span>
      <button
        type="button"
        className="group-isolation-bar__done"
        data-testid="group-isolation-done"
        onClick={handleDone}
      >
        Done
      </button>
    </div>
  );
}
