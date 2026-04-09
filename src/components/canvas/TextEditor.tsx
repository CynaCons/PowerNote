import { useEffect, useRef } from 'react';
import { Html } from 'react-konva-utils';
import type { CanvasNode, TextNodeData } from '../../types/data';

interface TextEditorProps {
  node: CanvasNode;
  stageScale: number;
  onFinish: (newText: string) => void;
  onCancel: () => void;
}

export function TextEditor({ node, stageScale, onFinish, onCancel }: TextEditorProps) {
  const data = node.data as TextNodeData;
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Focus the textarea reliably — the Html portal renders async,
  // so we retry until it's in the DOM and focusable
  useEffect(() => {
    const focusTextarea = () => {
      const textarea = textareaRef.current;
      if (!textarea) return false;
      textarea.focus();
      textarea.select();
      textarea.style.height = 'auto';
      textarea.style.height = textarea.scrollHeight + 'px';
      return document.activeElement === textarea;
    };

    if (focusTextarea()) return;

    // Retry with increasing delays for async portal rendering
    const t1 = setTimeout(focusTextarea, 10);
    const t2 = setTimeout(focusTextarea, 50);
    const t3 = setTimeout(focusTextarea, 150);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    // Tab: indent current line
    if (e.key === 'Tab' && !e.shiftKey) {
      e.preventDefault();
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const value = textarea.value;

      // Find the start of the current line
      const lineStart = value.lastIndexOf('\n', start - 1) + 1;

      // Insert two spaces at the start of the line
      textarea.value = value.substring(0, lineStart) + '  ' + value.substring(lineStart);
      textarea.selectionStart = start + 2;
      textarea.selectionEnd = end + 2;
      autoHeight(textarea);
    }

    // Shift+Tab: unindent current line
    if (e.key === 'Tab' && e.shiftKey) {
      e.preventDefault();
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const value = textarea.value;

      const lineStart = value.lastIndexOf('\n', start - 1) + 1;
      const lineContent = value.substring(lineStart);

      if (lineContent.startsWith('  ')) {
        textarea.value = value.substring(0, lineStart) + value.substring(lineStart + 2);
        textarea.selectionStart = Math.max(lineStart, start - 2);
        textarea.selectionEnd = Math.max(lineStart, end - 2);
      }
      autoHeight(textarea);
    }

    // Enter: auto-continue bullet/numbered lists
    if (e.key === 'Enter' && !e.shiftKey) {
      const start = textarea.selectionStart;
      const value = textarea.value;
      const lineStart = value.lastIndexOf('\n', start - 1) + 1;
      const currentLine = value.substring(lineStart, start);

      // Check for checkbox pattern: "- [ ] text" or "- [x] text"
      const checkboxMatch = currentLine.match(/^(\s*)- \[[ x]\]\s/);
      if (checkboxMatch) {
        e.preventDefault();
        const indent = checkboxMatch[0].length > 6 ? checkboxMatch[1] : '';
        const contentAfter = currentLine.substring(checkboxMatch[0].length).trim();
        if (contentAfter === '') {
          textarea.value = value.substring(0, lineStart) + value.substring(start);
          textarea.selectionStart = lineStart;
          textarea.selectionEnd = lineStart;
        } else {
          const insert = `\n${indent}- [ ] `;
          textarea.value = value.substring(0, start) + insert + value.substring(start);
          textarea.selectionStart = start + insert.length;
          textarea.selectionEnd = start + insert.length;
        }
        autoHeight(textarea);
        return;
      }

      // Check for bullet point pattern: "  • text" or "  - text" or "  * text"
      const bulletMatch = currentLine.match(/^(\s*)([-*•])\s/);
      if (bulletMatch) {
        e.preventDefault();
        const indent = bulletMatch[1];
        const bullet = bulletMatch[2];
        // If the line is just the bullet with no content, remove it (end the list)
        const contentAfterBullet = currentLine.substring(bulletMatch[0].length).trim();
        if (contentAfterBullet === '') {
          // Remove the empty bullet line
          textarea.value = value.substring(0, lineStart) + value.substring(start);
          textarea.selectionStart = lineStart;
          textarea.selectionEnd = lineStart;
        } else {
          const insert = `\n${indent}${bullet} `;
          textarea.value = value.substring(0, start) + insert + value.substring(start);
          textarea.selectionStart = start + insert.length;
          textarea.selectionEnd = start + insert.length;
        }
        autoHeight(textarea);
        return;
      }

      // Check for numbered list pattern: "  1. text"
      const numberMatch = currentLine.match(/^(\s*)(\d+)\.\s/);
      if (numberMatch) {
        e.preventDefault();
        const indent = numberMatch[1];
        const num = parseInt(numberMatch[2], 10);
        const contentAfterNumber = currentLine.substring(numberMatch[0].length).trim();
        if (contentAfterNumber === '') {
          textarea.value = value.substring(0, lineStart) + value.substring(start);
          textarea.selectionStart = lineStart;
          textarea.selectionEnd = lineStart;
        } else {
          const insert = `\n${indent}${num + 1}. `;
          textarea.value = value.substring(0, start) + insert + value.substring(start);
          textarea.selectionStart = start + insert.length;
          textarea.selectionEnd = start + insert.length;
        }
        autoHeight(textarea);
        return;
      }

      // Default: Shift+Enter behavior (new line) since we use Enter for plain text too
      // Actually for a text editor, Enter should just create a new line
      // Let it pass through naturally
    }

    // Escape: cancel
    if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    }

    e.stopPropagation();
  };

  const handleBlur = () => {
    onFinish(textareaRef.current?.value ?? '');
  };

  const autoHeight = (textarea: HTMLTextAreaElement) => {
    textarea.style.height = 'auto';
    textarea.style.height = textarea.scrollHeight + 'px';
  };

  const handleInput = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    autoHeight(textarea);
  };

  return (
    <Html
      groupProps={{
        x: node.x,
        y: node.y,
      }}
      divProps={{
        style: {},
      }}
    >
      <textarea
        ref={textareaRef}
        defaultValue={data.text}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        onInput={handleInput}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          minWidth: Math.max(200, node.width) * stageScale,
          maxWidth: 800 * stageScale,
          minHeight: 24 * stageScale,
          fontSize: data.fontSize * stageScale,
          fontFamily: 'monospace',
          fontStyle: data.fontStyle.includes('italic') ? 'italic' : 'normal',
          fontWeight: data.fontStyle.includes('bold') ? 'bold' : 'normal',
          color: data.fill,
          border: '2px solid #2563eb',
          borderRadius: 3,
          padding: `${4 * stageScale}px`,
          margin: 0,
          outline: 'none',
          resize: 'none',
          overflow: 'hidden',
          background: 'white',
          lineHeight: '1.4',
          whiteSpace: 'pre-wrap',
          tabSize: 2,
          transformOrigin: 'top left',
          transform: `scale(${1 / stageScale})`,
        }}
      />
    </Html>
  );
}
