import { useState, useRef, useEffect } from 'react';
import { Slash, Circle } from 'lucide-react';
import './Popover.css';

interface EraserPopoverProps {
  mode: 'stroke' | 'zone';
  size: number;
  onModeChange: (mode: 'stroke' | 'zone') => void;
  onSizeChange: (size: number) => void;
}

export function EraserPopover({ mode, size, onModeChange, onSizeChange }: EraserPopoverProps) {
  const [open, setOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

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

  return (
    <div className="popover-anchor" ref={popoverRef}>
      <button
        className="toolbar-popover-trigger"
        onClick={() => setOpen(!open)}
        title="Eraser options"
        data-testid="eraser-options-trigger"
      >
        <span className="toolbar-popover-trigger__value">
          {mode === 'stroke' ? 'Stroke' : `${size}px`}
        </span>
      </button>

      {open && (
        <div className="toolbar-popover toolbar-popover--eraser" data-testid="eraser-popover">
          <div className="toolbar-popover__title">Eraser Mode</div>

          {/* Mode toggle */}
          <div className="eraser-popover__modes">
            <button
              className={`eraser-popover__mode-btn ${mode === 'stroke' ? 'eraser-popover__mode-btn--active' : ''}`}
              onClick={() => onModeChange('stroke')}
              data-testid="eraser-mode-stroke"
            >
              <Slash size={14} />
              <span>Stroke</span>
              <small>Erases entire stroke on touch</small>
            </button>

            <button
              className={`eraser-popover__mode-btn ${mode === 'zone' ? 'eraser-popover__mode-btn--active' : ''}`}
              onClick={() => onModeChange('zone')}
              data-testid="eraser-mode-zone"
            >
              <Circle size={14} />
              <span>Zone</span>
              <small>Erases precisely under cursor</small>
            </button>
          </div>

          {/* Size slider (only for zone eraser) */}
          {mode === 'zone' && (
            <>
              <div className="toolbar-popover__divider" />
              <div className="toolbar-popover__title">Eraser Size</div>
              <div className="size-popover__slider">
                <input
                  type="range"
                  min={4}
                  max={60}
                  step={1}
                  value={size}
                  onChange={(e) => onSizeChange(Number(e.target.value))}
                  className="size-popover__range"
                  data-testid="eraser-size-slider"
                />
                <span className="size-popover__readout">{size}px</span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
