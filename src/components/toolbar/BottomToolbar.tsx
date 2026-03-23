import { useToolStore } from '../../stores/useToolStore';
import { useCanvasStore } from '../../stores/useCanvasStore';
import { TextToolbar } from './TextToolbar';
import { ImageToolbar } from './ImageToolbar';
import { DrawToolbar } from './DrawToolbar';
import { ShapeToolbar } from './ShapeToolbar';
import type { TextOptions, ShapeOptions, ShapeNodeData } from '../../types/data';
import './BottomToolbar.css';

export function BottomToolbar() {
  const activeTool = useToolStore((s) => s.activeTool);
  const textOptions = useToolStore((s) => s.textOptions);
  const setTextOptions = useToolStore((s) => s.setTextOptions);
  const shapeOptions = useToolStore((s) => s.shapeOptions);
  const setShapeOptions = useToolStore((s) => s.setShapeOptions);

  const selectedNodeIds = useCanvasStore((s) => s.selectedNodeIds);
  const nodes = useCanvasStore((s) => s.nodes);
  const updateNode = useCanvasStore((s) => s.updateNode);

  // Find the first selected node
  const selectedNode = selectedNodeIds.length === 1
    ? nodes.find((n) => n.id === selectedNodeIds[0])
    : null;

  const selectedTextNode = selectedNode?.type === 'text' ? selectedNode : null;
  const selectedImageNode = selectedNode?.type === 'image' ? selectedNode : null;
  const selectedShapeNode = selectedNode?.type === 'shape' ? selectedNode : null;

  const isTextContext = activeTool === 'text' || !!selectedTextNode;
  const isImageContext = !!selectedImageNode;
  const isDrawContext = activeTool === 'draw';
  const isShapeContext = activeTool === 'shape' || !!selectedShapeNode;

  if (!isTextContext && !isImageContext && !isDrawContext && !isShapeContext) return null;

  if (isDrawContext) {
    return (
      <div className="bottom-toolbar" data-testid="bottom-toolbar">
        <DrawToolbar />
      </div>
    );
  }

  if (isShapeContext) {
    const currentShapeOptions: ShapeOptions = selectedShapeNode
      ? {
          shapeType: (selectedShapeNode.data as ShapeNodeData).shapeType,
          fill: (selectedShapeNode.data as ShapeNodeData).fill,
          stroke: (selectedShapeNode.data as ShapeNodeData).stroke,
          strokeWidth: (selectedShapeNode.data as ShapeNodeData).strokeWidth,
          strokeDash: (selectedShapeNode.data as ShapeNodeData).strokeDash,
        }
      : shapeOptions;

    const handleShapeChange = (updates: Partial<ShapeOptions>) => {
      if (selectedShapeNode) {
        updateNode(selectedShapeNode.id, {
          data: { ...selectedShapeNode.data, ...updates },
        });
      } else {
        setShapeOptions(updates);
      }
    };

    return (
      <div className="bottom-toolbar" data-testid="bottom-toolbar">
        <ShapeToolbar options={currentShapeOptions} onChange={handleShapeChange} />
      </div>
    );
  }

  if (isImageContext && selectedImageNode) {
    return (
      <div className="bottom-toolbar" data-testid="bottom-toolbar">
        <ImageToolbar node={selectedImageNode} />
      </div>
    );
  }

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
