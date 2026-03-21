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
  const updateNode = useCanvasStore((s) => s.updateNode);

  // Check if any selected node is an image (images are resizable)
  const hasImageSelected = selectedNodeIds.some((id) => {
    const n = nodes.find((n) => n.id === id);
    return n?.type === 'image';
  });

  // Only text selected = no resize; any image = allow resize
  const resizeEnabled = hasImageSelected;

  useEffect(() => {
    const transformer = transformerRef.current;
    const stage = stageRef.current;
    if (!transformer || !stage) return;

    if (selectedNodeIds.length === 0) {
      transformer.nodes([]);
      transformer.getLayer()?.batchDraw();
      return;
    }

    const selectedKonvaNodes: Konva.Node[] = [];
    for (const nodeId of selectedNodeIds) {
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

  // Handle resize end — update node dimensions in store
  const handleTransformEnd = () => {
    const transformer = transformerRef.current;
    if (!transformer) return;

    for (const konvaNode of transformer.nodes()) {
      const id = konvaNode.findOne('Rect')?.id() || konvaNode.findOne('Image')?.id();
      if (!id) continue;

      // Get the actual pixel dimensions after transform
      const scaleX = konvaNode.scaleX();
      const scaleY = konvaNode.scaleY();
      const width = konvaNode.width() * scaleX;
      const height = konvaNode.height() * scaleY;

      // Reset scale (dimensions are now baked in)
      konvaNode.scaleX(1);
      konvaNode.scaleY(1);

      const storeNode = nodes.find((n) => n.id === id);
      if (storeNode) {
        updateNode(id, {
          x: konvaNode.x(),
          y: konvaNode.y(),
          width,
          height,
        });
      }
    }
  };

  return (
    <Transformer
      ref={transformerRef}
      borderStroke="#2563eb"
      borderStrokeWidth={1.5}
      padding={2}
      resizeEnabled={resizeEnabled}
      rotateEnabled={false}
      anchorSize={resizeEnabled ? 8 : 0}
      anchorFill="#ffffff"
      anchorStroke="#2563eb"
      anchorStrokeWidth={1}
      anchorCornerRadius={2}
      keepRatio={true}
      onTransformEnd={handleTransformEnd}
    />
  );
}
