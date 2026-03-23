import { Eraser, PenLine } from 'lucide-react';
import { useToolStore } from '../../stores/useToolStore';
import { ColorPopover } from './ColorPopover';
import { SizePopover } from './SizePopover';
import { EraserPopover } from './EraserPopover';
import './BottomToolbar.css';

export function DrawToolbar() {
  const drawOptions = useToolStore((s) => s.drawOptions);
  const setDrawOptions = useToolStore((s) => s.setDrawOptions);

  return (
    <div className="text-toolbar" data-testid="draw-toolbar">
      {/* Pen section */}
      <button
        className={`text-toolbar__btn ${!drawOptions.isErasing ? 'text-toolbar__btn--active' : ''}`}
        onClick={() => setDrawOptions({ isErasing: false })}
        title="Pen"
        data-testid="draw-pen-btn"
      >
        <PenLine size={16} />
      </button>

      {!drawOptions.isErasing && (
        <>
          <SizePopover
            value={drawOptions.strokeWidth}
            onChange={(strokeWidth) => setDrawOptions({ strokeWidth })}
            min={1}
            max={24}
            step={1}
            label="Stroke Width"
            icon="stroke"
            unit="px"
          />

          <div className="text-toolbar__divider" />

          <ColorPopover
            value={drawOptions.color}
            onChange={(color) => setDrawOptions({ color })}
            label="Pen Color"
          />
        </>
      )}

      <div className="text-toolbar__divider" />

      {/* Eraser section */}
      <button
        className={`text-toolbar__btn ${drawOptions.isErasing ? 'text-toolbar__btn--active' : ''}`}
        onClick={() => setDrawOptions({ isErasing: true })}
        title="Eraser"
        data-testid="draw-eraser-btn"
      >
        <Eraser size={16} />
      </button>

      {drawOptions.isErasing && (
        <EraserPopover
          mode={drawOptions.eraserMode}
          size={drawOptions.eraserSize}
          onModeChange={(eraserMode) => setDrawOptions({ eraserMode })}
          onSizeChange={(eraserSize) => setDrawOptions({ eraserSize })}
        />
      )}
    </div>
  );
}
