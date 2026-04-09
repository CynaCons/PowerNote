import { useState } from 'react';
import type { BackgroundMode } from '../canvas/PageGuides';
import type { CanvasBgColor } from '../canvas/InfiniteCanvas';
import { APP_VERSION } from '../../version';
import { checkForUpdate, performUpdate } from '../../utils/updateChecker';
import { useWorkspaceStore } from '../../stores/useWorkspaceStore';
import { useCanvasStore } from '../../stores/useCanvasStore';
import { useDrawStore } from '../../stores/useDrawStore';
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
  const [updateStatus, setUpdateStatus] = useState<'idle' | 'checking' | 'available' | 'updating' | 'failed'>('idle');
  const [updateInfo, setUpdateInfo] = useState<{ version: string; url?: string; releaseUrl?: string } | null>(null);

  const handleCheckUpdate = async () => {
    setUpdateStatus('checking');
    const result = await checkForUpdate(APP_VERSION);
    if (result?.available && result.latestVersion) {
      setUpdateStatus('available');
      setUpdateInfo({ version: result.latestVersion, url: result.downloadUrl, releaseUrl: result.releaseUrl });
    } else if (result && !result.available) {
      setUpdateStatus('idle');
      setUpdateInfo(null);
    } else {
      setUpdateStatus('failed');
    }
  };

  const handleUpdate = async () => {
    if (!updateInfo?.url) {
      // Can't fetch — open release page instead
      if (updateInfo?.releaseUrl) window.open(updateInfo.releaseUrl, '_blank');
      return;
    }
    setUpdateStatus('updating');
    // Flush current data
    const wsStore = useWorkspaceStore.getState();
    wsStore.savePageNodes(useCanvasStore.getState().nodes);
    wsStore.savePageStrokes(useDrawStore.getState().strokes);
    const ws = wsStore.workspace;
    const success = await performUpdate(updateInfo.url, ws);
    if (!success) {
      setUpdateStatus('failed');
      // Fallback: open release page
      if (updateInfo.releaseUrl) window.open(updateInfo.releaseUrl, '_blank');
    }
  };

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

      <div className="settings-panel__section" style={{ marginTop: 12, borderTop: '1px solid #e2e8f0', paddingTop: 10 }}>
        <span className="settings-panel__label">PowerNote v{APP_VERSION}</span>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 }}>
          {updateStatus === 'idle' && (
            <button
              className="settings-panel__btn"
              onClick={handleCheckUpdate}
              data-testid="check-update-btn"
            >
              Check for updates
            </button>
          )}
          {updateStatus === 'checking' && <span style={{ fontSize: 12, color: '#64748b' }}>Checking...</span>}
          {updateStatus === 'available' && updateInfo && (
            <>
              <span style={{ fontSize: 12, color: '#16a34a' }}>v{updateInfo.version} available!</span>
              <button
                className="settings-panel__btn settings-panel__btn--primary"
                onClick={handleUpdate}
                data-testid="update-btn"
              >
                Update
              </button>
            </>
          )}
          {updateStatus === 'updating' && <span style={{ fontSize: 12, color: '#2563eb' }}>Updating...</span>}
          {updateStatus === 'failed' && (
            <>
              <span style={{ fontSize: 12, color: '#dc2626' }}>Check failed (rate limited or offline)</span>
              <button className="settings-panel__btn" onClick={handleCheckUpdate}>Retry</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
