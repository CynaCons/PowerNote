import { create } from 'zustand';

/**
 * Agent bridge connection state.
 *
 * `enabled` lives in localStorage, NOT in WorkspaceSettings: it is a property
 * of this machine, not of the notebook. Persisting it into the notebook would
 * mean a file you send to someone else arrives trying to dial a socket on
 * their box.
 */

const ENABLED_KEY = 'powernote-bridge-enabled';
const URL_KEY = 'powernote-bridge-url';

export type BridgeStatus = 'off' | 'connecting' | 'connected' | 'error' | 'displaced';

function readEnabled(): boolean {
  try {
    return localStorage.getItem(ENABLED_KEY) === 'true';
  } catch {
    return false;
  }
}

function readUrl(fallback: string): string {
  try {
    return localStorage.getItem(URL_KEY) || fallback;
  } catch {
    return fallback;
  }
}

function persist(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // ignored — private mode / quota errors are non-fatal
  }
}

interface BridgeState {
  enabled: boolean;
  url: string;
  status: BridgeStatus;
  lastError: string | null;
  /** Commands served since page load — cheap "it's actually working" signal. */
  commandCount: number;
  lastCommand: string | null;

  setEnabled: (enabled: boolean) => void;
  setUrl: (url: string) => void;
  setStatus: (status: BridgeStatus, error?: string | null) => void;
  noteCommand: (cmd: string) => void;
}

export const useBridgeStore = create<BridgeState>((set) => ({
  enabled: readEnabled(),
  url: readUrl(''),
  status: 'off',
  lastError: null,
  commandCount: 0,
  lastCommand: null,

  setEnabled: (enabled) => {
    persist(ENABLED_KEY, String(enabled));
    set({ enabled, ...(enabled ? {} : { status: 'off' as BridgeStatus, lastError: null }) });
  },

  setUrl: (url) => {
    persist(URL_KEY, url);
    set({ url });
  },

  setStatus: (status, error = null) => set({ status, lastError: error }),

  noteCommand: (cmd) =>
    set((state) => ({ commandCount: state.commandCount + 1, lastCommand: cmd })),
}));
