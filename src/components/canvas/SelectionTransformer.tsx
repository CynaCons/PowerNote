import { useRef, useEffect } from 'react';
import { Transformer } from 'react-konva';
import type Konva from 'konva';
import { useCanvasStore } from '../../stores/useCanvasStore';

interface SelectionTransformerProps {
  selectedNodeIds: string[];
  stageRef: React.RefObject<Konva.Stage | null>;
}

export function SelectionTransformer({ selectedNodeIds, stageRef }: SelectionTransformerProps) {
  const transformerRef = useRef<Konva.Transformer>(null);
  const updateNode = useCanvasStore((s) => s.updateNode);
  const nodes = useCanvasStore((s) => s.nodes);

  useEffect(() => {
    const transformer = transformerRef.current;
    const stage = stageRef.current;
    if (!transformer || !stage) return;

    if (selectedNodeIds.length === 0) {
      transformer.nodes([]);
      transformer.getLayer()?.batchDraw();
      return;
    }

    // Find all selected Konva nodes on the stage
    // Nodes are inside Groups, so we need to find the Groups by looking for the Text id
    const selectedKonvaNodes: Konva.Node[] = [];
    for (const nodeId of selectedNodeIds) {
      // The Text element has the id, but we want its parent Group
      const found: Konva.Node | undefined = stage.findOne(`#${nodeId}`);
      if (found) {
        const group: Konva.Node | null = found.parent;
        if (group && group !== stage) {
          selectedKonvaNodes.push(group);
        }
      }
    }

    transformer.nodes(selectedKonvaNodes);
    transformer.getLayer()?.batchDraw();
  }, [selectedNodeIds, stageRef, nodes]);

  const handleTransformEnd = () => {
    const transformer = transformerRef.current;
    if (!transformer || selectedNodeIds.length === 0) return;

    // Only handle single-node resize (multi-select can't resize)
    if (selectedNodeIds.length !== 1) return;

    const node = transformer.nodes()[0];
    if (!node) return;

    const scaleX = node.scaleX();
    const scaleY = node.scaleY();

    node.scaleX(1);
    node.scaleY(1);

    const storeNode = useCanvasStore.getState().nodes.find((n) => n.id === selectedNodeIds[0]);
    if (!storeNode) return;

    const newWidth = Math.max(50, node.width() * scaleX);

    if (storeNode.type === 'text') {
      node.width(newWidth);
      const reflowedHeight = node.height();

      updateNode(selectedNodeIds[0], {
        x: node.x(),
        y: node.y(),
        width: newWidth,
        height: reflowedHeight,
        data: { ...storeNode.data },
      });
    } else {
      const newHeight = Math.max(20, node.height() * scaleY);
      updateNode(selectedNodeIds[0], {
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
      // Disable resize for multi-select
      resizeEnabled={selectedNodeIds.length === 1}
      rotateEnabled={false}
    />
  );
}
