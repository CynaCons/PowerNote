import type { CanvasNode as CanvasNodeType } from '../../types/data';
import { TextNode } from './TextNode';
import { ContainerNode } from './ContainerNode';

interface CanvasNodeProps {
  node: CanvasNodeType;
  isSelected: boolean;
  onSelect: (id: string) => void;
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
    case 'container':
      return (
        <ContainerNode
          node={node}
          isSelected={isSelected}
          onSelect={onSelect}
          stageScale={stageScale}
        />
      );
    default:
      return null;
  }
}
