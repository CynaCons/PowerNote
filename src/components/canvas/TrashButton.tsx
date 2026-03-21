import { Trash2 } from 'lucide-react';
import { useCanvasStore } from '../../stores/useCanvasStore';
import './TrashButton.css';

export function TrashButton() {
  const deleteSelectedNodes = useCanvasStore((s) => s.deleteSelectedNodes);
  const selectedCount = useCanvasStore((s) => s.selectedNodeIds.length);

  return (
    <button
      className="trash-button"
      onClick={deleteSelectedNodes}
      title={`Delete ${selectedCount} selected element${selectedCount > 1 ? 's' : ''}`}
      data-testid="trash-button"
    >
      <Trash2 size={16} />
    </button>
  );
}
