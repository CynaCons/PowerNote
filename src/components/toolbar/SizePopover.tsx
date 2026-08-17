import { useState, useRef } from 'react';
import { ALargeSmall, Minus } from 'lucide-react';
import { PopoverPortal } from './PopoverPortal';
import './Popover.css';

interface SizePopoverProps {
  value: number;
  onChange: (size: number) => void;
  min?: number;
  max?: number;
  step?: number;
  label?: string;
  icon?: 'text' | 'stroke';
  unit?: string;
}

export function SizePopover({
  value,
  onChange,
  min = 8,
  max = 72,
  step = 1,
  label = 'Size',
  icon = 'text',
  unit = 'px',
}: SizePopoverProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const Icon = icon === 'text' ? ALargeSmall : Minus;

  return (
    <div className="popover-anchor">
      <button
        ref={triggerRef}
        className="toolbar-popover-trigger"
        onClick={() => setOpen((o) => !o)}
        title={label}
        data-testid="size-trigger"
      >
        <Icon size={16} />
        <span className="toolbar-popover-trigger__value">{value}</span>
      </button>

      <PopoverPortal
        open={open}
        anchorRef={triggerRef}
        onClose={() => setOpen(false)}
        className="toolbar-popover toolbar-popover--size"
        testId="size-popover"
      >
        <div className="toolbar-popover__title">{label}</div>

        {/* Slider */}
        <div className="size-popover__slider">
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={(e) => onChange(Number(e.target.value))}
            className="size-popover__range"
            data-testid="size-slider"
          />
          <span className="size-popover__readout">{value}{unit}</span>
        </div>

        <div className="toolbar-popover__divider" />

        {/* Quick presets */}
        <div className="size-popover__presets">
          {getPresets(min, max, icon).map((preset) => (
            <button
              key={preset}
              className={`size-popover__preset ${value === preset ? 'size-popover__preset--active' : ''}`}
              onClick={() => onChange(preset)}
            >
              {preset}{unit}
            </button>
          ))}
        </div>
      </PopoverPortal>
    </div>
  );
}

function getPresets(_min: number, _max: number, icon: string): number[] {
  if (icon === 'stroke') {
    return [1, 2, 4, 8, 12, 20];
  }
  return [10, 12, 14, 16, 20, 24, 32, 48, 64];
}
