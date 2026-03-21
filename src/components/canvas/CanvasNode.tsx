import type { CanvasNode as CanvasNodeType } from '../../types/data';
import { TextNode } from './TextNode';

interface CanvasNodeProps {
  node: CanvasNodeType;
  isSelected: boolean;
  onSelect: (id: string, additive: boolean) => void;
  stageScale: number;
  autoEdit?: boolean;
}

export function CanvasNode({ node, isSelected, onSelect, stageScale, autoEdit }: CanvasNodeProps) {
  switch (node.type) {
    case 'text':
      return (
        <TextNode
          node={node}
          isSelected={isSelected}
          onSelect={onSelect}
          stageScale={stageScale}
          autoEdit={autoEdit}
        />
      );
    default:
      return null;
  }
}
