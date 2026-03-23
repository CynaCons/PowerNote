import { useState, useRef, useEffect } from 'react';
import { ALargeSmall, Minus } from 'lucide-react';
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
  const popoverRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const Icon = icon === 'text' ? ALargeSmall : Minus;

  return (
    <div className="popover-anchor" ref={popoverRef}>
      <button
        className="toolbar-popover-trigger"
        onClick={() => setOpen(!open)}
        title={label}
        data-testid="size-trigger"
      >
        <Icon size={16} />
        <span className="toolbar-popover-trigger__value">{value}</span>
      </button>

      {open && (
        <div className="toolbar-popover toolbar-popover--size" data-testid="size-popover">
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
        </div>
      )}
    </div>
  );
}

function getPresets(min: number, max: number, icon: string): number[] {
  if (icon === 'stroke') {
    return [1, 2, 4, 8, 12, 20];
  }
  return [10, 12, 14, 16, 20, 24, 32, 48, 64];
}
