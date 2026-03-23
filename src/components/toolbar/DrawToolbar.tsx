import { useToolStore } from '../../stores/useToolStore';
import { ColorPopover } from './ColorPopover';
import { SizePopover } from './SizePopover';
import './BottomToolbar.css';

export function DrawToolbar() {
  const drawOptions = useToolStore((s) => s.drawOptions);
  const setDrawOptions = useToolStore((s) => s.setDrawOptions);

  return (
    <div className="text-toolbar" data-testid="draw-toolbar">
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
    </div>
  );
}
