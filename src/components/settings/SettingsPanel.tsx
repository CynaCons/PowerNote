import type { BackgroundMode } from '../canvas/PageGuides';
import './SettingsPanel.css';

interface SettingsPanelProps {
  backgroundMode: BackgroundMode;
  onChangeBackgroundMode: (mode: BackgroundMode) => void;
}

export function SettingsPanel({ backgroundMode, onChangeBackgroundMode }: SettingsPanelProps) {
  return (
    <div className="settings-panel" data-testid="settings-panel">
      <h3 className="settings-panel__title">Settings</h3>

      <div className="settings-panel__section">
        <span className="settings-panel__label">Canvas background</span>

        <label className="settings-panel__radio">
          <input
            type="radio"
            name="bg-mode"
            checked={backgroundMode === 'pages'}
            onChange={() => onChangeBackgroundMode('pages')}
            data-testid="settings-bg-pages"
          />
          <span>Pages (A4 sheets)</span>
        </label>

        <label className="settings-panel__radio">
          <input
            type="radio"
            name="bg-mode"
            checked={backgroundMode === 'grid'}
            onChange={() => onChangeBackgroundMode('grid')}
            data-testid="settings-bg-grid"
          />
          <span>Grid lines</span>
        </label>

        <label className="settings-panel__radio">
          <input
            type="radio"
            name="bg-mode"
            checked={backgroundMode === 'none'}
            onChange={() => onChangeBackgroundMode('none')}
            data-testid="settings-bg-none"
          />
          <span>None</span>
        </label>
      </div>
    </div>
  );
}
