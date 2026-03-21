import { Trash2, Copy, ClipboardPaste } from 'lucide-react';
import { useCanvasStore } from '../../stores/useCanvasStore';
import './TrashButton.css';

export function SelectionActions() {
  const selectedCount = useCanvasStore((s) => s.selectedNodeIds.length);
  const deleteSelectedNodes = useCanvasStore((s) => s.deleteSelectedNodes);
  const copySelectedNodes = useCanvasStore((s) => s.copySelectedNodes);
  const pasteNodes = useCanvasStore((s) => s.pasteNodes);

  if (selectedCount === 0) return null;

  return (
    <div className="selection-actions" data-testid="selection-actions">
      <span className="selection-actions__count">
        {selectedCount} selected
      </span>
      <div className="selection-actions__divider" />
      <button
        className="selection-actions__btn"
        onClick={() => copySelectedNodes()}
        title="Copy (Ctrl+C)"
      >
        <Copy size={16} />
      </button>
      <button
        className="selection-actions__btn"
        onClick={() => {
          copySelectedNodes();
          pasteNodes();
        }}
        title="Duplicate"
      >
        <ClipboardPaste size={16} />
      </button>
      <button
        className="selection-actions__btn selection-actions__btn--danger"
        onClick={deleteSelectedNodes}
        title="Delete (Del)"
        data-testid="trash-button"
      >
        <Trash2 size={16} />
      </button>
    </div>
  );
}

// Keep backward compat export
export const TrashButton = SelectionActions;
