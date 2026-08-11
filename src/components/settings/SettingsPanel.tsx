import { useState } from 'react';
import type { BackgroundMode, CanvasBgColor } from '../../types/data';
import { APP_VERSION } from '../../version';
import { checkForUpdate, performUpdate, isLiveUpdateEnabled } from '../../utils/updateChecker';
import { isFSASupported } from '../../utils/fileSystemAccess';
import { getCurrentHandle } from '../../utils/fileHandleStore';
import { useWorkspaceStore } from '../../stores/useWorkspaceStore';
import { useCanvasStore } from '../../stores/useCanvasStore';
import { useDrawStore } from '../../stores/useDrawStore';
import { useBridgeStore, type BridgeStatus } from '../../stores/useBridgeStore';
import { DEFAULT_BRIDGE_URL } from '../../bridge/protocol';
import { showToast } from '../layout/Toast';
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

type UpdateStatus = 'idle' | 'checking' | 'available' | 'updating-live' | 'updating-download' | 'failed';

const BRIDGE_STATUS_LABEL: Record<BridgeStatus, { text: string; color: string }> = {
  off: { text: 'Off', color: '#64748b' },
  connecting: { text: 'Waiting for agent server…', color: '#d97706' },
  connected: { text: 'Connected', color: '#16a34a' },
  error: { text: 'Cannot reach server', color: '#dc2626' },
  displaced: { text: 'Another notebook took over', color: '#d97706' },
};

export function SettingsPanel({ backgroundMode, onChangeBackgroundMode, bgColor, onChangeBgColor }: SettingsPanelProps) {
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>('idle');
  const [updateInfo, setUpdateInfo] = useState<{ version: string; url?: string; releaseUrl?: string } | null>(null);

  const bridgeEnabled = useBridgeStore((s) => s.enabled);
  const bridgeStatus = useBridgeStore((s) => s.status);
  const bridgeUrl = useBridgeStore((s) => s.url);
  const bridgeCommandCount = useBridgeStore((s) => s.commandCount);
  const bridgeLastCommand = useBridgeStore((s) => s.lastCommand);
  const setBridgeEnabled = useBridgeStore((s) => s.setEnabled);
  const setBridgeUrl = useBridgeStore((s) => s.setUrl);

  const handleCheckUpdate = async () => {
    setUpdateStatus('checking');
    const result = await checkForUpdate(APP_VERSION);
    if (result?.available && result.latestVersion) {
      setUpdateStatus('available');
      setUpdateInfo({ version: result.latestVersion, url: result.downloadUrl, releaseUrl: result.releaseUrl });
    } else if (result && !result.available) {
      setUpdateStatus('idle');
      setUpdateInfo(null);
      showToast('Already up to date', 'info');
    } else {
      setUpdateStatus('failed');
    }
  };

  const handleUpdate = async () => {
    if (!updateInfo?.url) {
      if (updateInfo?.releaseUrl) window.open(updateInfo.releaseUrl, '_blank');
      return;
    }

    // Prefer live-swap messaging when a writable FSA handle is likely available
    let preferLive = false;
    if (isLiveUpdateEnabled() && isFSASupported()) {
      const handle = await getCurrentHandle();
      preferLive = !!handle;
    }
    setUpdateStatus(preferLive ? 'updating-live' : 'updating-download');

    const wsStore = useWorkspaceStore.getState();
    wsStore.savePageNodes(useCanvasStore.getState().nodes);
    wsStore.savePageStrokes(useDrawStore.getState().strokes);
    const ws = wsStore.workspace;

    const result = await performUpdate(updateInfo.url, ws, APP_VERSION, updateInfo.version);
    if (!result.ok) {
      setUpdateStatus('failed');
      if (updateInfo.releaseUrl) window.open(updateInfo.releaseUrl, '_blank');
      return;
    }

    if (result.mode === 'live-swap') {
      // Page is reloading — leave status as updating-live
      return;
    }

    showToast('Updated notebook downloaded — open it to use the new version', 'success');
    setUpdateStatus('idle');
    setUpdateInfo(null);
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
              checked={backgroundMode === 'scroll'}
              onChange={() => onChangeBackgroundMode('scroll')}
              data-testid="settings-bg-scroll"
            />
            <span>Scroll</span>
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
        <span className="settings-panel__label">Agent bridge</span>

        <label className="settings-panel__radio" style={{ marginTop: 4 }}>
          <input
            type="checkbox"
            checked={bridgeEnabled}
            onChange={(e) => setBridgeEnabled(e.target.checked)}
            data-testid="settings-bridge-toggle"
          />
          <span>Let a local agent write into this notebook</span>
        </label>

        <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 6 }}>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              backgroundColor: BRIDGE_STATUS_LABEL[bridgeStatus].color,
              flexShrink: 0,
            }}
          />
          <span
            style={{ fontSize: 12, color: BRIDGE_STATUS_LABEL[bridgeStatus].color }}
            data-testid="settings-bridge-status"
            data-status={bridgeStatus}
          >
            {BRIDGE_STATUS_LABEL[bridgeStatus].text}
          </span>
          {bridgeCommandCount > 0 && (
            <span style={{ fontSize: 12, color: '#64748b' }} data-testid="settings-bridge-count">
              · {bridgeCommandCount} command{bridgeCommandCount === 1 ? '' : 's'}
              {bridgeLastCommand ? ` (last: ${bridgeLastCommand})` : ''}
            </span>
          )}
        </div>

        {bridgeEnabled && (
          <input
            type="text"
            value={bridgeUrl}
            placeholder={DEFAULT_BRIDGE_URL}
            onChange={(e) => setBridgeUrl(e.target.value)}
            data-testid="settings-bridge-url"
            style={{
              marginTop: 6,
              width: '100%',
              fontSize: 12,
              padding: '4px 6px',
              border: '1px solid #e2e8f0',
              borderRadius: 4,
              fontFamily: 'ui-monospace, monospace',
            }}
          />
        )}

        {bridgeStatus === 'displaced' && (
          <span
            style={{ fontSize: 11, color: '#d97706', marginTop: 6, display: 'block' }}
            data-testid="settings-bridge-displaced-hint"
          >
            Another notebook connected to the bridge, so this one stopped. Tick the
            box again to take the connection back.
          </span>
        )}

        <span style={{ fontSize: 11, color: '#94a3b8', marginTop: 6, display: 'block' }}>
          Off by default. Only enable on your own machine — anything that can reach
          this port can edit the notebook.
        </span>
      </div>

      <div className="settings-panel__section" style={{ marginTop: 12, borderTop: '1px solid #e2e8f0', paddingTop: 10 }}>
        <span className="settings-panel__label" data-testid="settings-app-version">PowerNote v{APP_VERSION}</span>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4, flexWrap: 'wrap' }}>
          {updateStatus === 'idle' && (
            <button
              className="settings-panel__btn"
              onClick={handleCheckUpdate}
              data-testid="check-update-btn"
            >
              Check for updates
            </button>
          )}
          {updateStatus === 'checking' && (
            <span style={{ fontSize: 12, color: '#64748b' }} data-testid="update-status-checking">Checking...</span>
          )}
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
          {updateStatus === 'updating-live' && (
            <span style={{ fontSize: 12, color: '#2563eb' }} data-testid="update-status-live">
              Updating this file…
            </span>
          )}
          {updateStatus === 'updating-download' && (
            <span style={{ fontSize: 12, color: '#2563eb' }} data-testid="update-status-download">
              Downloading backup + update…
            </span>
          )}
          {updateStatus === 'failed' && (
            <>
              <span style={{ fontSize: 12, color: '#dc2626' }}>Update failed (rate limited or offline)</span>
              <button className="settings-panel__btn" onClick={handleCheckUpdate}>Retry</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
