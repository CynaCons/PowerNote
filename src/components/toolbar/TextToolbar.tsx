import { Bold, Italic, Strikethrough, Code, Underline } from 'lucide-react';
import type { TextOptions } from '../../types/data';
import { useEditorStore } from '../../stores/useEditorStore';
import type { FormatKind } from '../../utils/markdownToggle';
import { ColorPopover } from './ColorPopover';
import { SizePopover } from './SizePopover';
import { getActiveTextEditor } from '../canvas/TextEditor';
import './BottomToolbar.css';

interface TextToolbarProps {
  options: TextOptions;
  onChange: (updates: Partial<TextOptions>) => void;
}

export function TextToolbar({ options, onChange }: TextToolbarProps) {
  const isBold = options.fontStyle.includes('bold');
  const isItalic = options.fontStyle.includes('italic');
  const applyFormat = useEditorStore((s) => s.applyFormat);
  const inlineDisabled = !applyFormat;

  // Prevent the click from stealing focus from the active textarea
  // (which would commit the edit and lose the user's selection).
  const preserveFocus = (e: React.MouseEvent) => e.preventDefault();

  const toggleBold = () => {
    // While a text block is being edited, bold only the selected text via inline
    // markdown (**...**) — never the whole block.
    const editor = getActiveTextEditor();
    if (editor) {
      editor.applyFormat('**');
      return;
    }
    // No active edit: toggle the whole selected block's fontStyle (legacy behavior)
    let style = options.fontStyle;
    if (isBold) {
      style = style.replace('bold', '').trim() || 'normal';
    } else {
      style = style === 'normal' ? 'bold' : `bold ${style}`;
    }
    onChange({ fontStyle: style });
  };

  const toggleItalic = () => {
    const editor = getActiveTextEditor();
    if (editor) {
      editor.applyFormat('*');
      return;
    }
    let style = options.fontStyle;
    if (isItalic) {
      style = style.replace('italic', '').trim() || 'normal';
    } else {
      style = style === 'normal' ? 'italic' : `${style} italic`;
    }
    onChange({ fontStyle: style });
  };

  const inlineOnly = (kind: FormatKind) => () => {
    applyFormat?.(kind);
  };

  return (
    <div className="text-toolbar">
      <SizePopover
        value={options.fontSize}
        onChange={(fontSize) => onChange({ fontSize })}
        min={8}
        max={72}
        label="Font Size"
        icon="text"
        unit="px"
      />

      <div className="text-toolbar__divider" />

      <button
        className={`text-toolbar__btn ${isBold ? 'text-toolbar__btn--active' : ''}`}
        onMouseDown={preserveFocus}
        onClick={toggleBold}
        title="Bold (Ctrl+B)"
        data-testid="format-bold"
      >
        <Bold size={16} />
      </button>

      <button
        className={`text-toolbar__btn ${isItalic ? 'text-toolbar__btn--active' : ''}`}
        onMouseDown={preserveFocus}
        onClick={toggleItalic}
        title="Italic (Ctrl+I)"
        data-testid="format-italic"
      >
        <Italic size={16} />
      </button>

      <button
        className="text-toolbar__btn"
        onMouseDown={preserveFocus}
        onClick={inlineOnly('underline')}
        disabled={inlineDisabled}
        title="Underline (Ctrl+U) — only while editing"
        data-testid="format-underline"
      >
        <Underline size={16} />
      </button>

      <button
        className="text-toolbar__btn"
        onMouseDown={preserveFocus}
        onClick={inlineOnly('strike')}
        disabled={inlineDisabled}
        title="Strikethrough (Ctrl+Shift+X) — only while editing"
        data-testid="format-strike"
      >
        <Strikethrough size={16} />
      </button>

      <button
        className="text-toolbar__btn"
        onMouseDown={preserveFocus}
        onClick={inlineOnly('code')}
        disabled={inlineDisabled}
        title="Inline code (Ctrl+E) — only while editing"
        data-testid="format-code"
      >
        <Code size={16} />
      </button>

      <div className="text-toolbar__divider" />

      <ColorPopover
        value={options.fill}
        onChange={(fill) => onChange({ fill })}
        label="Text Color"
      />
    </div>
  );
}
