import { useEffect, useRef } from 'react';
import { Copy, Trash2, CopyPlus, Layers } from 'lucide-react';
import { useCanvasStore } from '../../stores/useCanvasStore';
import './ContextMenu.css';

interface ContextMenuProps {
  x: number;
  y: number;
  nodeId: string;
  onClose: () => void;
}

const LAYERS = [1, 2, 3, 4, 5] as const;
const LAYER_LABELS = ['1 (Back)', '2', '3 (Default)', '4', '5 (Front)'];

export function ContextMenu({ x, y, nodeId, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const nodes = useCanvasStore((s) => s.nodes);
  const updateNode = useCanvasStore((s) => s.updateNode);
  const deleteNode = useCanvasStore((s) => s.deleteNode);
  const copySelectedNodes = useCanvasStore((s) => s.copySelectedNodes);
  const pasteNodes = useCanvasStore((s) => s.pasteNodes);
  const selectNode = useCanvasStore((s) => s.selectNode);

  const node = nodes.find((n) => n.id === nodeId);
  const currentLayer = node?.layer ?? 3;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  if (!node) return null;

  const handleCopy = () => {
    selectNode(nodeId, false);
    copySelectedNodes();
    onClose();
  };

  const handleDuplicate = () => {
    selectNode(nodeId, false);
    copySelectedNodes();
    pasteNodes(20, 20);
    onClose();
  };

  const handleDelete = () => {
    deleteNode(nodeId);
    onClose();
  };

  const handleLayerChange = (layer: number) => {
    updateNode(nodeId, { layer } as any);
    onClose();
  };

  return (
    <div
      ref={menuRef}
      className="context-menu"
      style={{ left: x, top: y }}
      data-testid="context-menu"
    >
      <button className="context-menu__item" onClick={handleCopy}>
        <Copy size={14} />
        <span>Copy</span>
      </button>
      <button className="context-menu__item" onClick={handleDuplicate}>
        <CopyPlus size={14} />
        <span>Duplicate</span>
      </button>
      <button className="context-menu__item context-menu__item--danger" onClick={handleDelete}>
        <Trash2 size={14} />
        <span>Delete</span>
      </button>

      <div className="context-menu__divider" />

      <div className="context-menu__label">
        <Layers size={12} />
        <span>Layer</span>
      </div>
      <div className="context-menu__layers">
        {LAYERS.map((layer, i) => (
          <button
            key={layer}
            className={`context-menu__layer-btn ${currentLayer === layer ? 'context-menu__layer-btn--active' : ''}`}
            onClick={() => handleLayerChange(layer)}
            title={`Layer ${LAYER_LABELS[i]}`}
            data-testid={`layer-${layer}`}
          >
            {layer}
          </button>
        ))}
      </div>
    </div>
  );
}
