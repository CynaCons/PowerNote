import { ChevronRight } from 'lucide-react';
import { useWorkspaceStore } from '../../stores/useWorkspaceStore';
import './TopBar.css';

export function TopBar() {
  const workspace = useWorkspaceStore((s) => s.workspace);
  const activeSectionId = useWorkspaceStore((s) => s.activeSectionId);
  const activePageId = useWorkspaceStore((s) => s.activePageId);

  const activeSection = workspace.sections.find((s) => s.id === activeSectionId);
  const activePage = activeSection?.pages.find((p) => p.id === activePageId);

  return (
    <header className="top-bar" data-testid="topbar">
      <span className="top-bar__filename" data-testid="topbar-filename">{workspace.filename}</span>
      {activeSection && (
        <>
          <ChevronRight size={14} className="top-bar__separator" />
          <span className="top-bar__crumb" data-testid="topbar-section">{activeSection.title}</span>
        </>
      )}
      {activePage && (
        <>
          <ChevronRight size={14} className="top-bar__separator" />
          <span className="top-bar__crumb top-bar__crumb--active" data-testid="topbar-page">
            {activePage.title}
          </span>
        </>
      )}
    </header>
  );
}
