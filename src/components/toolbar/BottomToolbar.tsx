import { useToolStore } from '../../stores/useToolStore';
import { useCanvasStore } from '../../stores/useCanvasStore';
import { TextToolbar } from './TextToolbar';
import type { TextOptions } from '../../types/data';
import './BottomToolbar.css';

export function BottomToolbar() {
  const activeTool = useToolStore((s) => s.activeTool);
  const textOptions = useToolStore((s) => s.textOptions);
  const setTextOptions = useToolStore((s) => s.setTextOptions);

  const selectedNodeId = useCanvasStore((s) => s.selectedNodeId);
  const nodes = useCanvasStore((s) => s.nodes);
  const updateNode = useCanvasStore((s) => s.updateNode);

  const selectedNode = selectedNodeId
    ? nodes.find((n) => n.id === selectedNodeId)
    : null;

  const isTextContext =
    activeTool === 'text' || (selectedNode && selectedNode.type === 'text');

  if (!isTextContext) return null;

  // If a text node is selected, use its data; otherwise use tool defaults
  const currentOptions: TextOptions = selectedNode
    ? {
        fontSize: selectedNode.data.fontSize,
        fontFamily: selectedNode.data.fontFamily,
        fontStyle: selectedNode.data.fontStyle,
        fill: selectedNode.data.fill,
      }
    : textOptions;

  const handleChange = (updates: Partial<TextOptions>) => {
    if (selectedNode) {
      // Update the selected node directly
      updateNode(selectedNode.id, {
        data: { ...selectedNode.data, ...updates },
      });
    } else {
      // Update tool defaults for next text block
      setTextOptions(updates);
    }
  };

  return (
    <div className="bottom-toolbar">
      <TextToolbar options={currentOptions} onChange={handleChange} />
    </div>
  );
}
