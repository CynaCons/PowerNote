import { Bold, Italic } from 'lucide-react';
import type { TextOptions } from '../../types/data';
import { ColorPopover } from './ColorPopover';
import { SizePopover } from './SizePopover';
import './BottomToolbar.css';

interface TextToolbarProps {
  options: TextOptions;
  onChange: (updates: Partial<TextOptions>) => void;
}

export function TextToolbar({ options, onChange }: TextToolbarProps) {
  const isBold = options.fontStyle.includes('bold');
  const isItalic = options.fontStyle.includes('italic');

  const toggleBold = () => {
    let style = options.fontStyle;
    if (isBold) {
      style = style.replace('bold', '').trim() || 'normal';
    } else {
      style = style === 'normal' ? 'bold' : `bold ${style}`;
    }
    onChange({ fontStyle: style });
  };

  const toggleItalic = () => {
    let style = options.fontStyle;
    if (isItalic) {
      style = style.replace('italic', '').trim() || 'normal';
    } else {
      style = style === 'normal' ? 'italic' : `${style} italic`;
    }
    onChange({ fontStyle: style });
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
        onClick={toggleBold}
        title="Bold"
      >
        <Bold size={16} />
      </button>

      <button
        className={`text-toolbar__btn ${isItalic ? 'text-toolbar__btn--active' : ''}`}
        onClick={toggleItalic}
        title="Italic"
      >
        <Italic size={16} />
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
