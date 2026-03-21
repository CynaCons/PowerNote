import { useCanvasStore } from '../../stores/useCanvasStore';
import './SettingsPanel.css';

interface SettingsPanelProps {
  showPageGuides: boolean;
  onTogglePageGuides: (show: boolean) => void;
}

export function SettingsPanel({ showPageGuides, onTogglePageGuides }: SettingsPanelProps) {
  return (
    <div className="settings-panel" data-testid="settings-panel">
      <h3 className="settings-panel__title">Settings</h3>

      <label className="settings-panel__row">
        <input
          type="checkbox"
          checked={showPageGuides}
          onChange={(e) => onTogglePageGuides(e.target.checked)}
          data-testid="settings-page-guides"
        />
        <span>Show A4 page guides</span>
      </label>
    </div>
  );
}
