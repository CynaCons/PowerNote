import { useState, useRef, useEffect } from 'react';
import { Palette } from 'lucide-react';
import { PopoverPortal } from './PopoverPortal';
import './Popover.css';

const PRESET_COLORS = [
  ['#1a1a1a', '#4b5563', '#9ca3af', '#d1d5db'],
  ['#dc2626', '#f97316', '#eab308', '#84cc16'],
  ['#16a34a', '#06b6d4', '#2563eb', '#7c3aed'],
  ['#9333ea', '#ec4899', '#f43f5e', '#ffffff'],
];

interface ColorPopoverProps {
  value: string;
  onChange: (color: string) => void;
  label?: string;
}

export function ColorPopover({ value, onChange, label = 'Color' }: ColorPopoverProps) {
  const [open, setOpen] = useState(false);
  const [hexInput, setHexInput] = useState(value);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setHexInput(value);
  }, [value]);

  const handleHexSubmit = () => {
    const hex = hexInput.startsWith('#') ? hexInput : `#${hexInput}`;
    if (/^#[0-9a-fA-F]{6}$/.test(hex)) {
      onChange(hex);
    }
  };

  return (
    <div className="popover-anchor">
      <button
        ref={triggerRef}
        className="toolbar-popover-trigger"
        onClick={() => setOpen((o) => !o)}
        title={label}
        data-testid="color-trigger"
      >
        <Palette size={16} />
        <div
          className="toolbar-popover-trigger__swatch"
          style={{ backgroundColor: value }}
        />
      </button>

      <PopoverPortal
        open={open}
        anchorRef={triggerRef}
        onClose={() => setOpen(false)}
        className="toolbar-popover"
        testId="color-popover"
      >
        <div className="toolbar-popover__title">{label}</div>

        {/* Preset color grid */}
        <div className="color-popover__grid">
          {PRESET_COLORS.map((row, ri) => (
            <div key={ri} className="color-popover__row">
              {row.map((color) => (
                <button
                  key={color}
                  className={`color-popover__swatch ${value === color ? 'color-popover__swatch--active' : ''}`}
                  style={{ backgroundColor: color, border: color === '#ffffff' ? '1px solid #d1d5db' : undefined }}
                  onClick={() => { onChange(color); }}
                  title={color}
                />
              ))}
            </div>
          ))}
        </div>

        <div className="toolbar-popover__divider" />

        {/* Custom hex input */}
        <div className="color-popover__custom">
          <input
            type="color"
            className="color-popover__native-picker"
            value={value}
            onChange={(e) => { onChange(e.target.value); setHexInput(e.target.value); }}
            title="Pick any color"
            data-testid="native-color-picker"
          />
          <input
            type="text"
            className="color-popover__hex-input"
            value={hexInput}
            onChange={(e) => setHexInput(e.target.value)}
            onBlur={handleHexSubmit}
            onKeyDown={(e) => { if (e.key === 'Enter') handleHexSubmit(); }}
            placeholder="#000000"
            maxLength={7}
            data-testid="hex-input"
          />
        </div>
      </PopoverPortal>
    </div>
  );
}
