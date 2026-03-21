import { Plus } from 'lucide-react';
import { useWorkspaceStore } from '../../stores/useWorkspaceStore';
import { useCanvasStore } from '../../stores/useCanvasStore';
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

  const canvasNodes = useCanvasStore((s) => s.nodes);
  const loadPageNodes = useCanvasStore((s) => s.loadPageNodes);

  const handleNavigate = (sectionId: string, pageId: string) => {
    if (pageId === activePageId) return;

    // Save current page's nodes
    savePageNodes(canvasNodes);

    // Switch to new page
    setActivePage(sectionId, pageId);

    // Load new page's nodes
    const section = workspace.sections.find((s) => s.id === sectionId);
    const page = section?.pages.find((p) => p.id === pageId);
    loadPageNodes(page?.nodes ?? []);
  };

  const handleAddPage = (sectionId: string) => {
    addPage(sectionId);
  };

  const handleAddSection = () => {
    addSection();
  };

  if (!isOpen) return null;

  return (
    <div className="hierarchy-panel">
      <div className="hierarchy-panel__header">
        <span className="hierarchy-panel__title">Notes</span>
        <button
          className="hierarchy-panel__add-section"
          onClick={handleAddSection}
          title="Add section"
        >
          <Plus size={16} />
        </button>
      </div>
      <div className="hierarchy-panel__content">
        {workspace.sections.map((section) => (
          <SectionItem
            key={section.id}
            section={section}
            activePageId={activePageId}
            onNavigate={handleNavigate}
            onAddPage={handleAddPage}
          />
        ))}
      </div>
    </div>
  );
}
