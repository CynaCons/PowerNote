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

  // Check if any selected node is resizable (images and shapes)
  const hasResizableSelected = selectedNodeIds.some((id) => {
    const n = nodes.find((n) => n.id === id);
    return n?.type === 'image' || n?.type === 'shape';
  });

  const resizeEnabled = hasResizableSelected;

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
      // Skip arrows/lines — they use custom vertex handles in ShapeNode
      const storeNode = nodes.find((n) => n.id === nodeId);
      if (storeNode?.type === 'shape') {
        const shapeData = storeNode.data as any;
        if (shapeData.shapeType === 'arrow' || shapeData.shapeType === 'line') {
          continue;
        }
      }

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
      // Try to find the node ID from any child element
      const id = (konvaNode as any).findOne('Rect')?.id()
        || (konvaNode as any).findOne('Image')?.id()
        || (konvaNode as any).findOne('Ellipse')?.id()
        || (konvaNode as any).findOne('Line')?.id()
        || (konvaNode as any).findOne('Arrow')?.id();
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

  const isMultiSelect = selectedNodeIds.length > 1;

  return (
    <Transformer
      key={resizeEnabled ? 'resize' : 'no-resize'}
      ref={transformerRef}
      borderStroke="#2563eb"
      borderStrokeWidth={isMultiSelect ? 2.5 : 1.5}
      borderDash={isMultiSelect ? [8, 4] : undefined}
      padding={isMultiSelect ? 6 : 2}
      resizeEnabled={resizeEnabled}
      rotateEnabled={false}
      anchorSize={resizeEnabled && !isMultiSelect ? 8 : 0}
      anchorFill="#ffffff"
      anchorStroke="#2563eb"
      anchorStrokeWidth={1}
      anchorCornerRadius={2}
      keepRatio={false}
      onTransformEnd={handleTransformEnd}
    />
  );
}
