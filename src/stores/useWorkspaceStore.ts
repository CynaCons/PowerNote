import { create } from 'zustand';
import type { WorkspaceData, Section, Page, CanvasNode } from '../types/data';
import { createWorkspace, createSection, createPage } from '../utils/defaults';

interface WorkspaceState {
  workspace: WorkspaceData;
  activeSectionId: string;
  activePageId: string;
  isDirty: boolean;
  markDirty: () => void;
  markClean: () => void;
  updateWorkspace: (updates: Partial<WorkspaceData>) => void;

  // Getters
  getActiveSection: () => Section | undefined;
  getActivePage: () => Page | undefined;

  // Section actions
  addSection: (title?: string) => void;
  renameSection: (sectionId: string, title: string) => void;
  deleteSection: (sectionId: string) => void;

  // Page actions
  addPage: (sectionId: string, title?: string) => void;
  renamePage: (sectionId: string, pageId: string, title: string) => void;
  deletePage: (sectionId: string, pageId: string) => void;

  // Navigation
  setActiveSection: (sectionId: string) => void;
  setActivePage: (sectionId: string, pageId: string) => void;

  // Node/stroke sync: save back to the active page
  savePageNodes: (nodes: CanvasNode[]) => void;
  savePageStrokes: (strokes: import('../types/data').Stroke[]) => void;

  // Reorder
  reorderSection: (fromIndex: number, toIndex: number) => void;
  reorderPage: (sectionId: string, fromIndex: number, toIndex: number) => void;
  movePageToSection: (pageId: string, fromSectionId: string, toSectionId: string, toIndex: number) => void;
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => {
  const initial = createWorkspace();
  const firstSection = initial.sections[0];
  const firstPage = firstSection.pages[0];

  return {
    workspace: initial,
    activeSectionId: firstSection.id,
    activePageId: firstPage.id,
    isDirty: false,
    markDirty: () => set({ isDirty: true }),
    markClean: () => set({ isDirty: false }),
    updateWorkspace: (updates) =>
      set((state) => ({ workspace: { ...state.workspace, ...updates } })),

    getActiveSection: () => {
      const { workspace, activeSectionId } = get();
      return workspace.sections.find((s) => s.id === activeSectionId);
    },

    getActivePage: () => {
      const section = get().getActiveSection();
      if (!section) return undefined;
      return section.pages.find((p) => p.id === get().activePageId);
    },

    addSection: (title?: string) => {
      set((state) => {
        const section = createSection(title);
        return {
          isDirty: true,
          workspace: {
            ...state.workspace,
            sections: [...state.workspace.sections, section],
          },
        };
      });
    },

    renameSection: (sectionId, title) => {
      set((state) => ({
        isDirty: true,
        workspace: {
          ...state.workspace,
          sections: state.workspace.sections.map((s) =>
            s.id === sectionId ? { ...s, title } : s,
          ),
        },
      }));
    },

    deleteSection: (sectionId) => {
      set((state) => {
        const remaining = state.workspace.sections.filter(
          (s) => s.id !== sectionId,
        );
        // Guard: always keep at least 1 section
        if (remaining.length === 0) return state;
        return {
          isDirty: true,
          workspace: { ...state.workspace, sections: remaining },
          activeSectionId:
            state.activeSectionId === sectionId
              ? remaining[0].id
              : state.activeSectionId,
          activePageId:
            state.activeSectionId === sectionId
              ? remaining[0].pages[0].id
              : state.activePageId,
        };
      });
    },

    addPage: (sectionId, title?: string) => {
      set((state) => ({
        isDirty: true,
        workspace: {
          ...state.workspace,
          sections: state.workspace.sections.map((s) =>
            s.id === sectionId
              ? { ...s, pages: [...s.pages, createPage(title)] }
              : s,
          ),
        },
      }));
    },

    renamePage: (sectionId, pageId, title) => {
      set((state) => ({
        isDirty: true,
        workspace: {
          ...state.workspace,
          sections: state.workspace.sections.map((s) =>
            s.id === sectionId
              ? {
                  ...s,
                  pages: s.pages.map((p) =>
                    p.id === pageId ? { ...p, title } : p,
                  ),
                }
              : s,
          ),
        },
      }));
    },

    deletePage: (sectionId, pageId) => {
      set((state) => {
        const section = state.workspace.sections.find(
          (s) => s.id === sectionId,
        );
        if (!section) return state;
        const remaining = section.pages.filter((p) => p.id !== pageId);
        // Guard: always keep at least 1 page per section
        if (remaining.length === 0) return state;
        return {
          isDirty: true,
          workspace: {
            ...state.workspace,
            sections: state.workspace.sections.map((s) =>
              s.id === sectionId ? { ...s, pages: remaining } : s,
            ),
          },
          activePageId:
            state.activePageId === pageId
              ? remaining[0].id
              : state.activePageId,
        };
      });
    },

    setActiveSection: (sectionId) => {
      const section = get().workspace.sections.find(
        (s) => s.id === sectionId,
      );
      if (!section) return;
      set({
        activeSectionId: sectionId,
        activePageId: section.pages[0].id,
      });
    },

    setActivePage: (sectionId, pageId) => {
      set({
        activeSectionId: sectionId,
        activePageId: pageId,
      });
    },

    savePageNodes: (nodes) => {
      set((state) => ({
        isDirty: true,
        workspace: {
          ...state.workspace,
          sections: state.workspace.sections.map((s) =>
            s.id === state.activeSectionId
              ? {
                  ...s,
                  pages: s.pages.map((p) =>
                    p.id === state.activePageId ? { ...p, nodes } : p,
                  ),
                }
              : s,
          ),
        },
      }));
    },

    savePageStrokes: (strokes) => {
      set((state) => ({
        isDirty: true,
        workspace: {
          ...state.workspace,
          sections: state.workspace.sections.map((s) =>
            s.id === state.activeSectionId
              ? {
                  ...s,
                  pages: s.pages.map((p) =>
                    p.id === state.activePageId ? { ...p, strokes } : p,
                  ),
                }
              : s,
          ),
        },
      }));
    },

    reorderSection: (fromIndex, toIndex) => {
      set((state) => {
        const sections = [...state.workspace.sections];
        const [moved] = sections.splice(fromIndex, 1);
        sections.splice(toIndex, 0, moved);
        return { isDirty: true, workspace: { ...state.workspace, sections } };
      });
    },

    reorderPage: (sectionId, fromIndex, toIndex) => {
      set((state) => ({
        isDirty: true,
        workspace: {
          ...state.workspace,
          sections: state.workspace.sections.map((s) => {
            if (s.id !== sectionId) return s;
            const pages = [...s.pages];
            const [moved] = pages.splice(fromIndex, 1);
            pages.splice(toIndex, 0, moved);
            return { ...s, pages };
          }),
        },
      }));
    },

    movePageToSection: (pageId, fromSectionId, toSectionId, toIndex) => {
      set((state) => {
        let movedPage: Page | undefined;
        const sections = state.workspace.sections.map((s) => {
          if (s.id === fromSectionId) {
            const pages = s.pages.filter((p) => {
              if (p.id === pageId) {
                movedPage = p;
                return false;
              }
              return true;
            });
            // Guard: don't leave a section empty
            if (pages.length === 0) return s;
            return { ...s, pages };
          }
          return s;
        });

        if (!movedPage) return state;

        const finalSections = sections.map((s) => {
          if (s.id === toSectionId) {
            const pages = [...s.pages];
            pages.splice(toIndex, 0, movedPage!);
            return { ...s, pages };
          }
          return s;
        });

        return { isDirty: true, workspace: { ...state.workspace, sections: finalSections } };
      });
    },
  };
});
