import { ChevronRight, Download, FolderOpen } from 'lucide-react';
import { useWorkspaceStore } from '../../stores/useWorkspaceStore';
import { useCanvasStore } from '../../stores/useCanvasStore';
import { buildExportHtml, downloadFile, extractDataFromHtml } from '../../utils/serialization';
import { useRef } from 'react';
import './TopBar.css';

export function TopBar() {
  const workspace = useWorkspaceStore((s) => s.workspace);
  const activeSectionId = useWorkspaceStore((s) => s.activeSectionId);
  const activePageId = useWorkspaceStore((s) => s.activePageId);
  const savePageNodes = useWorkspaceStore((s) => s.savePageNodes);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeSection = workspace.sections.find((s) => s.id === activeSectionId);
  const activePage = activeSection?.pages.find((p) => p.id === activePageId);

  const handleSave = async () => {
    // Save current page's canvas nodes to workspace first
    const canvasNodes = useCanvasStore.getState().nodes;
    savePageNodes(canvasNodes);

    // Get the freshest workspace state after saving
    const freshWorkspace = useWorkspaceStore.getState().workspace;

    const html = await buildExportHtml(freshWorkspace);
    const filename = freshWorkspace.filename.replace(/[^a-zA-Z0-9_-]/g, '_') + '.html';
    downloadFile(html, filename);
  };

  const handleOpen = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const htmlContent = reader.result as string;
      const data = extractDataFromHtml(htmlContent);
      if (data) {
        // Hydrate workspace
        useWorkspaceStore.setState({
          workspace: data,
          activeSectionId: data.sections[0]?.id,
          activePageId: data.sections[0]?.pages[0]?.id,
        });
        // Load first page nodes
        useCanvasStore.getState().loadPageNodes(data.sections[0]?.pages[0]?.nodes ?? []);
      } else {
        alert('Not a valid PowerNote file.');
      }
    };
    reader.readAsText(file);

    // Reset input so the same file can be re-selected
    e.target.value = '';
  };

  return (
    <header className="top-bar" data-testid="topbar">
      <div className="top-bar__breadcrumb">
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
      </div>

      <div className="top-bar__actions">
        <button
          className="top-bar__action-btn"
          onClick={handleOpen}
          title="Open notebook"
          data-testid="open-btn"
        >
          <FolderOpen size={16} />
        </button>
        <button
          className="top-bar__action-btn top-bar__action-btn--primary"
          onClick={handleSave}
          title="Save as HTML (Ctrl+S)"
          data-testid="save-btn"
        >
          <Download size={16} />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".html"
          style={{ display: 'none' }}
          onChange={handleFileSelected}
          data-testid="file-input"
        />
      </div>
    </header>
  );
}
