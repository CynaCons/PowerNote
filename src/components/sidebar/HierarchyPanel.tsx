import { Plus } from 'lucide-react';
import { useWorkspaceStore } from '../../stores/useWorkspaceStore';
import { useCanvasStore } from '../../stores/useCanvasStore';
import { useDrawStore } from '../../stores/useDrawStore';
import { SectionItem } from './SectionItem';
import './HierarchyPanel.css';

interface HierarchyPanelProps {
  isOpen: boolean;
}

export function HierarchyPanel({ isOpen }: HierarchyPanelProps) {
  const workspace = useWorkspaceStore((s) => s.workspace);
  const activePageId = useWorkspaceStore((s) => s.activePageId);
  const setActivePage = useWorkspaceStore((s) => s.setActivePage);
  const savePageNodes = useWorkspaceStore((s) => s.savePageNodes);
  const addSection = useWorkspaceStore((s) => s.addSection);
  const addPage = useWorkspaceStore((s) => s.addPage);
  const renameSection = useWorkspaceStore((s) => s.renameSection);
  const deleteSection = useWorkspaceStore((s) => s.deleteSection);
  const renamePage = useWorkspaceStore((s) => s.renamePage);
  const deletePage = useWorkspaceStore((s) => s.deletePage);
  const reorderSection = useWorkspaceStore((s) => s.reorderSection);
  const reorderPage = useWorkspaceStore((s) => s.reorderPage);

  const canvasNodes = useCanvasStore((s) => s.nodes);
  const loadPageNodes = useCanvasStore((s) => s.loadPageNodes);
  const savePageStrokes = useWorkspaceStore((s) => s.savePageStrokes);

  const handleNavigate = (sectionId: string, pageId: string) => {
    if (pageId === activePageId) return;

    // Save current page's nodes + strokes
    savePageNodes(canvasNodes);
    savePageStrokes(useDrawStore.getState().strokes);

    // Switch to new page
    setActivePage(sectionId, pageId);

    // Load new page's nodes + strokes
    const section = workspace.sections.find((s) => s.id === sectionId);
    const page = section?.pages.find((p) => p.id === pageId);
    loadPageNodes(page?.nodes ?? []);
    useDrawStore.getState().loadPageStrokes(page?.strokes ?? []);
  };

  const handleDeleteSection = (sectionId: string) => {
    savePageNodes(canvasNodes);
    savePageStrokes(useDrawStore.getState().strokes);
    deleteSection(sectionId);
    const state = useWorkspaceStore.getState();
    const newSection = state.workspace.sections.find((s) => s.id === state.activeSectionId);
    const newPage = newSection?.pages.find((p) => p.id === state.activePageId);
    loadPageNodes(newPage?.nodes ?? []);
    useDrawStore.getState().loadPageStrokes(newPage?.strokes ?? []);
  };

  const handleDeletePage = (sectionId: string, pageId: string) => {
    if (pageId === activePageId) {
      savePageNodes(canvasNodes);
      savePageStrokes(useDrawStore.getState().strokes);
    }
    deletePage(sectionId, pageId);
    if (pageId === activePageId) {
      const state = useWorkspaceStore.getState();
      const section = state.workspace.sections.find((s) => s.id === sectionId);
      const newPage = section?.pages.find((p) => p.id === state.activePageId);
      loadPageNodes(newPage?.nodes ?? []);
      useDrawStore.getState().loadPageStrokes(newPage?.strokes ?? []);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="hierarchy-panel" data-testid="hierarchy-panel">
      <div className="hierarchy-panel__header">
        <span className="hierarchy-panel__title">Notes</span>
        <button
          className="hierarchy-panel__add-section"
          onClick={() => addSection()}
          title="Add section"
          data-testid="add-section-btn"
        >
          <Plus size={16} />
        </button>
      </div>
      <div className="hierarchy-panel__content">
        {workspace.sections.map((section, sectionIndex) => (
          <SectionItem
            key={section.id}
            section={section}
            sectionIndex={sectionIndex}
            activePageId={activePageId}
            onNavigate={handleNavigate}
            onAddPage={(sid) => addPage(sid)}
            onRenameSection={renameSection}
            onDeleteSection={handleDeleteSection}
            onRenamePage={renamePage}
            onDeletePage={handleDeletePage}
            onReorderSection={reorderSection}
            onReorderPage={reorderPage}
          />
        ))}
      </div>
    </div>
  );
}
