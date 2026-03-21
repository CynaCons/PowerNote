import type { CanvasNode as CanvasNodeType } from '../../types/data';
import type { SnapLine } from './SnapGuides';
import { TextNode } from './TextNode';

interface CanvasNodeProps {
  node: CanvasNodeType;
  isSelected: boolean;
  onSelect: (id: string, additive: boolean) => void;
  stageScale: number;
  autoEdit?: boolean;
  onSnapChange: (lines: SnapLine[]) => void;
}

export function CanvasNode({ node, isSelected, onSelect, stageScale, autoEdit, onSnapChange }: CanvasNodeProps) {
  switch (node.type) {
    case 'text':
      return (
        <TextNode
          node={node}
          isSelected={isSelected}
          onSelect={onSelect}
          stageScale={stageScale}
          autoEdit={autoEdit}
          onSnapChange={onSnapChange}
        />
      );
    default:
      return null;
  }
}
