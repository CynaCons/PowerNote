import { Bold, Italic } from 'lucide-react';
import type { TextOptions } from '../../types/data';
import './BottomToolbar.css';

interface TextToolbarProps {
  options: TextOptions;
  onChange: (updates: Partial<TextOptions>) => void;
}

const FONT_SIZES = [12, 14, 16, 20, 24, 32, 48];
const COLORS = [
  { value: '#1a1a1a', label: 'Black' },
  { value: '#dc2626', label: 'Red' },
  { value: '#2563eb', label: 'Blue' },
  { value: '#16a34a', label: 'Green' },
  { value: '#9333ea', label: 'Purple' },
  { value: '#737373', label: 'Gray' },
];

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
      <select
        className="text-toolbar__select"
        value={options.fontSize}
        onChange={(e) => onChange({ fontSize: Number(e.target.value) })}
        title="Font size"
      >
        {FONT_SIZES.map((size) => (
          <option key={size} value={size}>
            {size}px
          </option>
        ))}
      </select>

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

      <div className="text-toolbar__colors">
        {COLORS.map((color) => (
          <button
            key={color.value}
            className={`text-toolbar__color ${options.fill === color.value ? 'text-toolbar__color--active' : ''}`}
            style={{ backgroundColor: color.value }}
            onClick={() => onChange({ fill: color.value })}
            title={color.label}
          />
        ))}
      </div>
    </div>
  );
}
