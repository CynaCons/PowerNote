import { useCallback, useEffect, useRef, useState } from 'react';
import { Minus, Plus, Maximize, ChevronDown, Check } from 'lucide-react';
import { useCanvasStore, MIN_SCALE, MAX_SCALE } from '../../stores/useCanvasStore';
import './ZoomBar.css';

/** Step applied per +/- click. Coarser than the wheel's 1.05 so clicks feel useful. */
const STEP = 1.25;

const PRESETS = [0.25, 0.5, 0.75, 1, 1.5, 2, 4];

export function ZoomBar() {
  const scale = useCanvasStore((s) => s.viewport.scale);
  const setZoom = useCanvasStore((s) => s.setZoom);
  const zoomToFit = useCanvasStore((s) => s.zoomToFit);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Steps read the live scale rather than the render closure, so several
  // clicks landing in one frame each apply instead of collapsing into one.
  const step = useCallback(
    (factor: number) => setZoom(useCanvasStore.getState().viewport.scale * factor),
    [setZoom],
  );

  // Dismiss the menu on outside click or Escape
  useEffect(() => {
    if (!isMenuOpen) return;
    const onPointerDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setIsMenuOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setIsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown, true);
    };
  }, [isMenuOpen]);

  const percent = Math.round(scale * 100);
  const atMin = scale <= MIN_SCALE + 0.001;
  const atMax = scale >= MAX_SCALE - 0.001;

  const runAndClose = (fn: () => void) => () => {
    fn();
    setIsMenuOpen(false);
  };

  return (
    <div className="zoom-bar" ref={ref} data-testid="zoom-bar">
      <button
        className="zoom-bar__btn"
        onClick={() => step(1 / STEP)}
        disabled={atMin}
        title="Zoom out"
        aria-label="Zoom out"
        data-testid="zoom-out-btn"
      >
        <Minus size={15} />
      </button>

      <button
        className="zoom-bar__value"
        onClick={() => setIsMenuOpen((v) => !v)}
        title="Zoom options"
        aria-haspopup="menu"
        aria-expanded={isMenuOpen}
        data-testid="zoom-value-btn"
      >
        <span data-testid="zoom-percent">{percent}%</span>
        <ChevronDown
          size={12}
          className={`zoom-bar__chevron${isMenuOpen ? ' zoom-bar__chevron--open' : ''}`}
        />
      </button>

      <button
        className="zoom-bar__btn"
        onClick={() => step(STEP)}
        disabled={atMax}
        title="Zoom in"
        aria-label="Zoom in"
        data-testid="zoom-in-btn"
      >
        <Plus size={15} />
      </button>

      {isMenuOpen && (
        <div className="zoom-bar__menu" role="menu" data-testid="zoom-menu">
          <button
            className="zoom-bar__item"
            role="menuitem"
            onClick={runAndClose(zoomToFit)}
            data-testid="zoom-menu-fit"
          >
            <Maximize size={13} />
            Zoom to fit
            <kbd>Shift+1</kbd>
          </button>
          <button
            className="zoom-bar__item"
            role="menuitem"
            onClick={runAndClose(() => setZoom(1))}
            data-testid="zoom-menu-actual"
          >
            <span className="zoom-bar__check">
              {Math.abs(scale - 1) < 0.005 && <Check size={13} />}
            </span>
            Actual size
            <kbd>Shift+0</kbd>
          </button>

          <div className="zoom-bar__separator" />

          {PRESETS.map((preset) => (
            <button
              key={preset}
              className="zoom-bar__item zoom-bar__item--preset"
              role="menuitem"
              onClick={runAndClose(() => setZoom(preset))}
              data-testid={`zoom-preset-${preset * 100}`}
            >
              <span className="zoom-bar__check">
                {Math.abs(scale - preset) < 0.005 && <Check size={13} />}
              </span>
              {preset * 100}%
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
