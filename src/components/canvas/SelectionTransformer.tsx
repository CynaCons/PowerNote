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

  return (
    <Transformer
      ref={transformerRef}
      borderStroke="#2563eb"
      borderStrokeWidth={1.5}
      padding={2}
      resizeEnabled={false}
      rotateEnabled={false}
      anchorSize={0}
    />
  );
}
