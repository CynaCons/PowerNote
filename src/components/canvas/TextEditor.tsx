import { useEffect, useRef } from 'react';
import { Html } from 'react-konva-utils';
import type { CanvasNode } from '../../types/data';

interface TextEditorProps {
  node: CanvasNode;
  stageScale: number;
  onFinish: (newText: string) => void;
  onCancel: () => void;
}

export function TextEditor({ node, stageScale, onFinish, onCancel }: TextEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    // Focus and select all on mount
    textarea.focus();
    textarea.select();

    // Auto-height
    textarea.style.height = 'auto';
    textarea.style.height = textarea.scrollHeight + 'px';
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onFinish(textareaRef.current?.value ?? '');
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    }
    // Stop propagation so Konva doesn't capture keyboard events
    e.stopPropagation();
  };

  const handleBlur = () => {
    onFinish(textareaRef.current?.value ?? '');
  };

  const handleInput = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = textarea.scrollHeight + 'px';
  };

  // Scale factor — the textarea renders inside the Konva transform,
  // but we need it to appear at 1:1 for readability
  const inverseScale = 1 / stageScale;

  return (
    <Html
      groupProps={{
        x: node.x,
        y: node.y,
      }}
      divProps={{
        style: {
          // The Html component is already positioned by the group transform.
          // We just need to counteract the canvas scale for the textarea.
        },
      }}
    >
      <textarea
        ref={textareaRef}
        defaultValue={node.data.text}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        onInput={handleInput}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: node.data.width * stageScale,
          minHeight: 24 * stageScale,
          fontSize: node.data.fontSize * stageScale,
          fontFamily: node.data.fontFamily,
          fontStyle: node.data.fontStyle.includes('italic') ? 'italic' : 'normal',
          fontWeight: node.data.fontStyle.includes('bold') ? 'bold' : 'normal',
          color: node.data.fill,
          border: '2px solid #2563eb',
          borderRadius: 3,
          padding: `${4 * stageScale}px`,
          margin: 0,
          outline: 'none',
          resize: 'none',
          overflow: 'hidden',
          background: 'white',
          lineHeight: '1.2',
          transformOrigin: 'top left',
          transform: `scale(${inverseScale})`,
        }}
      />
    </Html>
  );
}
