import { useToolStore } from '../../stores/useToolStore';
import { useCanvasStore } from '../../stores/useCanvasStore';
import { TextToolbar } from './TextToolbar';
import type { TextOptions } from '../../types/data';
import './BottomToolbar.css';

export function BottomToolbar() {
  const activeTool = useToolStore((s) => s.activeTool);
  const textOptions = useToolStore((s) => s.textOptions);
  const setTextOptions = useToolStore((s) => s.setTextOptions);

  const selectedNodeIds = useCanvasStore((s) => s.selectedNodeIds);
  const nodes = useCanvasStore((s) => s.nodes);
  const updateNode = useCanvasStore((s) => s.updateNode);

  // Find the first selected text node (if any)
  const selectedTextNode = selectedNodeIds.length === 1
    ? nodes.find((n) => n.id === selectedNodeIds[0] && n.type === 'text')
    : null;

  const isTextContext =
    activeTool === 'text' || !!selectedTextNode;

  if (!isTextContext) return null;

  const currentOptions: TextOptions = selectedTextNode
    ? {
        fontSize: (selectedTextNode.data as any).fontSize,
        fontFamily: (selectedTextNode.data as any).fontFamily,
        fontStyle: (selectedTextNode.data as any).fontStyle,
        fill: (selectedTextNode.data as any).fill,
      }
    : textOptions;

  const handleChange = (updates: Partial<TextOptions>) => {
    if (selectedTextNode) {
      updateNode(selectedTextNode.id, {
        data: { ...selectedTextNode.data, ...updates },
      });
    } else {
      setTextOptions(updates);
    }
  };

  return (
    <div className="bottom-toolbar" data-testid="bottom-toolbar">
      <TextToolbar options={currentOptions} onChange={handleChange} />
    </div>
  );
}
