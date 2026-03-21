import type { BackgroundMode } from '../canvas/PageGuides';
import type { CanvasBgColor } from '../canvas/InfiniteCanvas';
import './SettingsPanel.css';

interface SettingsPanelProps {
  backgroundMode: BackgroundMode;
  onChangeBackgroundMode: (mode: BackgroundMode) => void;
  bgColor: CanvasBgColor;
  onChangeBgColor: (color: CanvasBgColor) => void;
}

const BG_COLORS: { value: CanvasBgColor; label: string; preview: string }[] = [
  { value: '#ffffff', label: 'White', preview: '#ffffff' },
  { value: '#f5f5f5', label: 'Light gray', preview: '#f5f5f5' },
  { value: '#e5e5e5', label: 'Gray', preview: '#e5e5e5' },
  { value: 'paper', label: 'Paper', preview: '#f5f0e8' },
];

export function SettingsPanel({ backgroundMode, onChangeBackgroundMode, bgColor, onChangeBgColor }: SettingsPanelProps) {
  return (
    <div className="settings-panel" data-testid="settings-panel">
      <h3 className="settings-panel__title">Settings</h3>

      <div className="settings-panel__columns">
        <div className="settings-panel__section">
          <span className="settings-panel__label">Guide style</span>

          <label className="settings-panel__radio">
            <input
              type="radio" name="bg-mode"
              checked={backgroundMode === 'pages'}
              onChange={() => onChangeBackgroundMode('pages')}
              data-testid="settings-bg-pages"
            />
            <span>Pages</span>
          </label>

          <label className="settings-panel__radio">
            <input
              type="radio" name="bg-mode"
              checked={backgroundMode === 'grid'}
              onChange={() => onChangeBackgroundMode('grid')}
              data-testid="settings-bg-grid"
            />
            <span>Grid</span>
          </label>

          <label className="settings-panel__radio">
            <input
              type="radio" name="bg-mode"
              checked={backgroundMode === 'none'}
              onChange={() => onChangeBackgroundMode('none')}
              data-testid="settings-bg-none"
            />
            <span>None</span>
          </label>
        </div>

        <div className="settings-panel__section">
          <span className="settings-panel__label">Background</span>

          <div className="settings-panel__color-grid">
            {BG_COLORS.map((c) => (
              <button
                key={c.value}
                className={`settings-panel__color-swatch ${bgColor === c.value ? 'settings-panel__color-swatch--active' : ''}`}
                style={{ backgroundColor: c.preview }}
                onClick={() => onChangeBgColor(c.value)}
                title={c.label}
                data-testid={`settings-bg-color-${c.value}`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
