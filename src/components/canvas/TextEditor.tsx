import { useEffect, useRef } from 'react';
import { Html } from 'react-konva-utils';
import type { CanvasNode, TextNodeData } from '../../types/data';

/**
 * Replace the textarea's selected range with new text using a native-compatible
 * approach that integrates with the browser's undo stack.
 *
 * Falls back to direct value assignment if execCommand is not supported.
 */
function replaceSelection(
  ta: HTMLTextAreaElement,
  selStart: number,
  selEnd: number,
  newText: string,
): void {
  ta.focus();
  ta.setSelectionRange(selStart, selEnd);
  try {
    const ok = document.execCommand('insertText', false, newText);
    if (ok) return;
  } catch {
    // Ignore — fall through to fallback
  }
  // Fallback: direct mutation (no undo history)
  const before = ta.value.substring(0, selStart);
  const after = ta.value.substring(selEnd);
  ta.value = before + newText + after;
}

interface TextEditorProps {
  node: CanvasNode;
  stageScale: number;
  onFinish: (newText: string) => void;
  onCancel: () => void;
}

export function TextEditor({ node, stageScale: _stageScale, onFinish, onCancel }: TextEditorProps) {
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

    // Tab / Shift+Tab: indent / unindent (supports single-line + multi-line selection)
    if (e.key === 'Tab') {
      e.preventDefault();
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const value = textarea.value;

      // First line's start (at or before the cursor/selection anchor)
      const firstLineStart = value.lastIndexOf('\n', start - 1) + 1;
      // If selection spans multiple lines, we indent every line in the range
      const selectionSpansLines = value.substring(firstLineStart, end).includes('\n');

      if (!e.shiftKey) {
        // ── INDENT (Tab) ─────────────────────────────────
        if (selectionSpansLines) {
          // Multi-line: prepend 2 spaces to every line in the selection range
          const selected = value.substring(firstLineStart, end);
          const indented = selected.replace(/^/gm, '  ');
          replaceSelection(textarea, firstLineStart, end, indented);
          textarea.selectionStart = firstLineStart;
          textarea.selectionEnd = firstLineStart + indented.length;
        } else {
          // Single line: insert 2 spaces at line start
          replaceSelection(textarea, firstLineStart, firstLineStart, '  ');
          textarea.selectionStart = start + 2;
          textarea.selectionEnd = end + 2;
        }
      } else {
        // ── UNINDENT (Shift+Tab) ─────────────────────────
        if (selectionSpansLines) {
          const selected = value.substring(firstLineStart, end);
          // Remove up to 2 leading spaces from every line
          const unindented = selected.replace(/^( {1,2})/gm, '');
          if (unindented !== selected) {
            replaceSelection(textarea, firstLineStart, end, unindented);
            textarea.selectionStart = firstLineStart;
            textarea.selectionEnd = firstLineStart + unindented.length;
          }
        } else {
          // Single line: remove up to 2 leading spaces from the current line
          const lineContent = value.substring(firstLineStart);
          const match = lineContent.match(/^( {1,2})/);
          if (match) {
            const removed = match[1].length;
            replaceSelection(textarea, firstLineStart, firstLineStart + removed, '');
            textarea.selectionStart = Math.max(firstLineStart, start - removed);
            textarea.selectionEnd = Math.max(firstLineStart, end - removed);
          }
        }
      }
      autoHeight(textarea);
      return;
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

  // Mirror TextNode's rendered div exactly so the editing experience
  // visually matches the committed text. <Html> handles the stage-scale
  // transform automatically — do NOT manually multiply by stageScale.
  // Offset by -2 to compensate for the 2px border so the text baseline
  // lines up pixel-perfect with where the rendered div showed it.
  return (
    <Html
      groupProps={{
        x: node.x - 2,
        y: node.y - 2,
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
          minWidth: 60,
          maxWidth: 800,
          width: Math.max(node.width, 60),
          minHeight: 24,
          fontSize: data.fontSize,
          fontFamily: data.fontFamily,
          fontStyle: data.fontStyle.includes('italic') ? 'italic' : 'normal',
          fontWeight: data.fontStyle.includes('bold') ? 'bold' : 'normal',
          color: data.fill,
          border: '2px solid #2563eb',
          borderRadius: 3,
          padding: 4,
          margin: 0,
          outline: 'none',
          resize: 'none',
          overflow: 'hidden',
          background: '#ffffff',
          lineHeight: '1.4',
          whiteSpace: 'pre-wrap',
          wordWrap: 'break-word',
          overflowWrap: 'break-word',
          tabSize: 2,
          boxSizing: 'content-box',
        }}
      />
    </Html>
  );
}
