import { ChevronRight } from 'lucide-react';
import { useWorkspaceStore } from '../../stores/useWorkspaceStore';
import './TopBar.css';

export function TopBar() {
  const workspace = useWorkspaceStore((s) => s.workspace);
  const activeSection = useWorkspaceStore((s) => s.getActiveSection());
  const activePage = useWorkspaceStore((s) => s.getActivePage());

  return (
    <header className="top-bar">
      <span className="top-bar__filename">{workspace.filename}</span>
      {activeSection && (
        <>
          <ChevronRight size={14} className="top-bar__separator" />
          <span className="top-bar__crumb">{activeSection.title}</span>
        </>
      )}
      {activePage && (
        <>
          <ChevronRight size={14} className="top-bar__separator" />
          <span className="top-bar__crumb top-bar__crumb--active">
            {activePage.title}
          </span>
        </>
      )}
    </header>
  );
}
