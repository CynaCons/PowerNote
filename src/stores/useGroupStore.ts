import { create } from 'zustand';

interface GroupUiState {
  /** When set, isolation mode is active for this group. */
  editingGroupId: string | null;
  enterIsolation: (groupId: string) => void;
  exitIsolation: () => void;
}

export const useGroupStore = create<GroupUiState>((set) => ({
  editingGroupId: null,
  enterIsolation: (groupId) => set({ editingGroupId: groupId }),
  exitIsolation: () => set({ editingGroupId: null }),
}));
