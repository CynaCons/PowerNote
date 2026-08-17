import { useState, useRef } from 'react';
import { Slash, Circle } from 'lucide-react';
import { PopoverPortal } from './PopoverPortal';
import './Popover.css';

interface EraserPopoverProps {
  mode: 'stroke' | 'zone';
  size: number;
  onModeChange: (mode: 'stroke' | 'zone') => void;
  onSizeChange: (size: number) => void;
}

export function EraserPopover({ mode, size, onModeChange, onSizeChange }: EraserPopoverProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  return (
    <div className="popover-anchor">
      <button
        ref={triggerRef}
        className="toolbar-popover-trigger"
        onClick={() => setOpen((o) => !o)}
        title="Eraser options"
        data-testid="eraser-options-trigger"
      >
        <span className="toolbar-popover-trigger__value">
          {mode === 'stroke' ? 'Stroke' : `${size}px`}
        </span>
      </button>

      <PopoverPortal
        open={open}
        anchorRef={triggerRef}
        onClose={() => setOpen(false)}
        className="toolbar-popover toolbar-popover--eraser"
        testId="eraser-popover"
      >
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
      </PopoverPortal>
    </div>
  );
}
