import { useRef, useEffect } from 'react';
import { Transformer } from 'react-konva';
import type Konva from 'konva';
import { useCanvasStore } from '../../stores/useCanvasStore';

interface SelectionTransformerProps {
  selectedNodeId: string | null;
  stageRef: React.RefObject<Konva.Stage | null>;
}

export function SelectionTransformer({ selectedNodeId, stageRef }: SelectionTransformerProps) {
  const transformerRef = useRef<Konva.Transformer>(null);
  const updateNode = useCanvasStore((s) => s.updateNode);
  const nodes = useCanvasStore((s) => s.nodes);

  useEffect(() => {
    const transformer = transformerRef.current;
    const stage = stageRef.current;
    if (!transformer || !stage) return;

    if (!selectedNodeId) {
      transformer.nodes([]);
      transformer.getLayer()?.batchDraw();
      return;
    }

    // Find the Konva node on the stage by id
    const selectedNode = stage.findOne(`#${selectedNodeId}`);
    if (selectedNode) {
      transformer.nodes([selectedNode]);
      transformer.getLayer()?.batchDraw();
    } else {
      transformer.nodes([]);
      transformer.getLayer()?.batchDraw();
    }
  }, [selectedNodeId, stageRef, nodes]);

  const handleTransformEnd = () => {
    const transformer = transformerRef.current;
    if (!transformer || !selectedNodeId) return;

    const node = transformer.nodes()[0];
    if (!node) return;

    const scaleX = node.scaleX();
    const scaleY = node.scaleY();

    // Reset scale and apply it to width/height instead
    node.scaleX(1);
    node.scaleY(1);

    const storeNode = useCanvasStore.getState().nodes.find((n) => n.id === selectedNodeId);
    if (!storeNode) return;

    const newWidth = Math.max(50, node.width() * scaleX);

    if (storeNode.type === 'text') {
      // For text: only resize width, let Konva recalculate height from text reflow
      node.width(newWidth);
      const reflowedHeight = node.height();

      updateNode(selectedNodeId, {
        x: node.x(),
        y: node.y(),
        width: newWidth,
        height: reflowedHeight,
        data: { ...storeNode.data },
      });
    } else {
      // For other node types: resize both dimensions
      const newHeight = Math.max(20, node.height() * scaleY);
      updateNode(selectedNodeId, {
        x: node.x(),
        y: node.y(),
        width: newWidth,
        height: newHeight,
      });
    }
  };

  return (
    <Transformer
      ref={transformerRef}
      boundBoxFunc={(_oldBox, newBox) => {
        // Minimum size constraint
        if (newBox.width < 50 || newBox.height < 20) {
          return _oldBox;
        }
        return newBox;
      }}
      onTransformEnd={handleTransformEnd}
      borderStroke="#2563eb"
      borderStrokeWidth={1.5}
      anchorStroke="#2563eb"
      anchorFill="white"
      anchorSize={8}
      anchorCornerRadius={2}
      padding={2}
    />
  );
}
