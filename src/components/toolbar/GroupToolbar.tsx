import { Group as GroupIcon, Check, Code2 } from 'lucide-react';
import { useCanvasStore } from '../../stores/useCanvasStore';
import { useDrawStore } from '../../stores/useDrawStore';
import { useGroupStore } from '../../stores/useGroupStore';
import { useDiagramStore } from '../../stores/useDiagramStore';
import { getGroupMembers } from '../../utils/groups';
import { sniffFormat } from '../../diagram';
import { FORMAT_LABEL } from '../../diagram/formatLabels';
import { diagramSourceOf } from '../../diagram/canvasOps';
import type { CanvasNode } from '../../types/data';

/**
 * What the group segment has to offer for the current selection, or null when
 * it has nothing.
 *
 * Split out from the component so the toolbar can ask the question before it
 * renders its wrapper — an always-present empty bar would make "no toolbar" and
 * "an empty toolbar" the same thing to a test.
 */
export type GroupControls =
  | { mode: 'editing'; groupId: string; frame: CanvasNode | null }
  | { mode: 'enter'; groupId: string; node: CanvasNode }
  | null;

export function useGroupControls(): GroupControls {
  const editingGroupId = useGroupStore((s) => s.editingGroupId);
  const selectedNodeIds = useCanvasStore((s) => s.selectedNodeIds);
  const nodes = useCanvasStore((s) => s.nodes);
  const selectedStrokeIds = useDrawStore((s) => s.selectedStrokeIds);
  const strokes = useDrawStore((s) => s.strokes);

  // Inside a group the way out is offered whatever member is selected, so you
  // are never stuck having to reselect the frame to get back.
  if (editingGroupId) {
    return {
      mode: 'editing',
      groupId: editingGroupId,
      frame: nodes.find((n) => n.id === editingGroupId && n.type === 'diagram') ?? null,
    };
  }

  // A stroke in the selection means the target group is ambiguous, and a
  // multi-node selection may straddle groups. Both stay out of it.
  if (selectedNodeIds.length !== 1 || selectedStrokeIds.length > 0) return null;

  const node = nodes.find((n) => n.id === selectedNodeIds[0]);
  const groupId = node?.groupId;
  if (!node || !groupId) return null;

  // A group of one is the frame by itself — nothing to step into.
  const members = getGroupMembers(groupId, nodes, strokes);
  if (members.nodeIds.length + members.strokeIds.length < 2) return null;

  return { mode: 'enter', groupId, node };
}

/**
 * Group-edit controls for the selection toolbar.
 *
 * Isolation mode already existed, but every way into it was hidden — double
 * click, Ctrl+Enter, or the context menu — so nothing on screen said the mode
 * was there. This is the visible way in, and a way out that does not depend on
 * which member you happen to have selected.
 *
 * Rendered independently of the node-type contexts, because the case that
 * needed it most was a diagram: `'diagram'` matches no toolbar context, so
 * selecting one produced an empty bar.
 */
export function GroupToolbar() {
  const controls = useGroupControls();
  if (!controls) return null;

  if (controls.mode === 'editing') {
    const leave = () => {
      const gid = controls.groupId;
      useGroupStore.getState().exitIsolation();
      const canvas = useCanvasStore.getState();
      const draw = useDrawStore.getState();
      const members = getGroupMembers(gid, canvas.nodes, draw.strokes);
      useCanvasStore.setState({ selectedNodeIds: members.nodeIds });
      draw.selectStrokes(members.strokeIds);
    };

    return (
      <div
        className="group-toolbar group-toolbar--editing"
        data-testid="toolbar-group-segment"
        data-mode="editing"
      >
        <span className="group-toolbar__label" data-testid="group-isolation-bar">
          Editing {controls.frame ? 'diagram' : 'group'}
        </span>
        {controls.frame && <SourceButton frame={controls.frame} />}
        <button
          type="button"
          className="group-toolbar__btn group-toolbar__btn--primary"
          data-testid="group-isolation-done"
          title="Stop editing this group's contents (Esc)"
          onClick={leave}
        >
          <Check size={15} />
          <span>Done</span>
        </button>
      </div>
    );
  }

  const { node, groupId } = controls;
  const isDiagram = node.type === 'diagram';

  const enter = () => {
    useGroupStore.getState().enterIsolation(groupId);
    useCanvasStore.setState({ selectedNodeIds: [node.id] });
    useDrawStore.getState().selectStrokes([]);
  };

  return (
    <div className="group-toolbar" data-testid="toolbar-group-segment" data-mode="idle">
      {isDiagram && <SourceButton frame={node} />}
      <button
        type="button"
        className="group-toolbar__btn"
        data-testid="toolbar-group-edit"
        title={
          isDiagram
            ? 'Edit the shapes and labels inside this diagram'
            : "Edit this group's members one by one"
        }
        onClick={enter}
      >
        <GroupIcon size={15} />
        <span>{isDiagram ? 'Edit contents' : 'Edit group'}</span>
      </button>
    </div>
  );
}

/** Opens the source dialog, labelled with the language the source is in. */
function SourceButton({ frame }: { frame: CanvasNode }) {
  const format = sniffFormat(diagramSourceOf(frame));
  return (
    <button
      type="button"
      className="group-toolbar__btn"
      data-testid="toolbar-diagram-source"
      data-format={format}
      title={`Show the ${FORMAT_LABEL[format]} this diagram was built from`}
      onClick={() => useDiagramStore.getState().openSource(frame.id)}
    >
      <Code2 size={15} />
      <span>{FORMAT_LABEL[format]}</span>
    </button>
  );
}
