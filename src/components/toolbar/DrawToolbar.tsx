import type { DrawOptions } from '../../types/data';
import { useToolStore } from '../../stores/useToolStore';
import './BottomToolbar.css';

const STROKE_WIDTHS = [
  { value: 2, label: 'Thin' },
  { value: 4, label: 'Medium' },
  { value: 8, label: 'Thick' },
  { value: 16, label: 'Marker' },
];

const COLORS = [
  { value: '#1a1a1a', label: 'Black' },
  { value: '#dc2626', label: 'Red' },
  { value: '#2563eb', label: 'Blue' },
  { value: '#16a34a', label: 'Green' },
  { value: '#9333ea', label: 'Purple' },
  { value: '#f97316', label: 'Orange' },
];

export function DrawToolbar() {
  const drawOptions = useToolStore((s) => s.drawOptions);
  const setDrawOptions = useToolStore((s) => s.setDrawOptions);

  return (
    <div className="text-toolbar" data-testid="draw-toolbar">
      {/* Stroke width buttons */}
      <div className="draw-toolbar__widths">
        {STROKE_WIDTHS.map((sw) => (
          <button
            key={sw.value}
            className={`draw-toolbar__width-btn ${drawOptions.strokeWidth === sw.value ? 'draw-toolbar__width-btn--active' : ''}`}
            onClick={() => setDrawOptions({ strokeWidth: sw.value })}
            title={sw.label}
            data-testid={`draw-width-${sw.value}`}
          >
            <div
              className="draw-toolbar__width-preview"
              style={{
                width: Math.min(sw.value * 2, 20),
                height: Math.min(sw.value * 2, 20),
                borderRadius: '50%',
                backgroundColor: drawOptions.color,
              }}
            />
          </button>
        ))}
      </div>

      <div className="text-toolbar__divider" />

      {/* Color swatches */}
      <div className="text-toolbar__colors">
        {COLORS.map((color) => (
          <button
            key={color.value}
            className={`text-toolbar__color ${drawOptions.color === color.value ? 'text-toolbar__color--active' : ''}`}
            style={{ backgroundColor: color.value }}
            onClick={() => setDrawOptions({ color: color.value })}
            title={color.label}
          />
        ))}
        <input
          type="color"
          className="text-toolbar__color-picker"
          value={drawOptions.color}
          onChange={(e) => setDrawOptions({ color: e.target.value })}
          title="Custom color"
        />
      </div>
    </div>
  );
}
