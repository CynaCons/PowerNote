import { ChevronRight, Download, FolderOpen, Maximize, ChevronDown } from 'lucide-react';
import { useWorkspaceStore } from '../../stores/useWorkspaceStore';
import { useCanvasStore } from '../../stores/useCanvasStore';
import { useDrawStore } from '../../stores/useDrawStore';
import { extractDataFromHtml } from '../../utils/serialization';
import { workspaceToMarkdown } from '../../utils/exportMarkdown';
import {
  isFSASupported,
  openWithPicker,
} from '../../utils/fileSystemAccess';
import { setCurrentHandle, addRecentHandle } from '../../utils/fileHandleStore';
import { saveNotebook } from '../../utils/saveNotebook';
import { useRef, useState, useEffect } from 'react';
import { showToast } from './Toast';
import './TopBar.css';

export function TopBar() {
  const workspace = useWorkspaceStore((s) => s.workspace);
  const activeSectionId = useWorkspaceStore((s) => s.activeSectionId);
  const activePageId = useWorkspaceStore((s) => s.activePageId);
  const isDirty = useWorkspaceStore((s) => s.isDirty);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [editingFilename, setEditingFilename] = useState(false);
  const [filenameValue, setFilenameValue] = useState('');
  const [showExportMenu, setShowExportMenu] = useState(false);

  const activeSection = workspace.sections.find((s) => s.id === activeSectionId);
  const activePage = activeSection?.pages.find((p) => p.id === activePageId);

  // beforeunload warning for unsaved changes
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (useWorkspaceStore.getState().isDirty) {
        e.preventDefault();
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, []);

  const handleSave = async (forceSaveAs: boolean = false) => {
    await saveNotebook(forceSaveAs);
  };

  const handleOpen = async () => {
    // Try FSA open picker first
    if (isFSASupported()) {
      const result = await openWithPicker();
      if (result) {
        const data = extractDataFromHtml(result.text);
        if (data) {
          useWorkspaceStore.setState({
            workspace: data,
            activeSectionId: data.sections[0]?.id ?? '',
            activePageId: data.sections[0]?.pages[0]?.id ?? '',
            isDirty: false,
          });
          const firstPage = data.sections[0]?.pages[0];
          useCanvasStore.getState().loadPageNodes(firstPage?.nodes ?? []);
          useDrawStore.getState().loadPageStrokes(firstPage?.strokes ?? []);
          await setCurrentHandle(result.handle);
          await addRecentHandle(data.filename, result.handle);
          showToast(`Opened ${result.handle.name}`, 'info');
          return;
        }
        showToast('Not a valid PowerNote file', 'error');
        return;
      }
      // User cancelled — do nothing
      return;
    }

    // Fallback: legacy file input
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
        useWorkspaceStore.setState({
          workspace: data,
          activeSectionId: data.sections[0]?.id,
          activePageId: data.sections[0]?.pages[0]?.id,
          isDirty: false,
        });
        const firstPage = data.sections[0]?.pages[0];
        useCanvasStore.getState().loadPageNodes(firstPage?.nodes ?? []);
        useDrawStore.getState().loadPageStrokes(firstPage?.strokes ?? []);
        showToast('Notebook opened', 'info');
      } else {
        showToast('Not a valid PowerNote file', 'error');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleFilenameClick = () => {
    setFilenameValue(workspace.filename);
    setEditingFilename(true);
  };

  const commitFilename = () => {
    const name = filenameValue.trim();
    if (name && name !== workspace.filename) {
      useWorkspaceStore.setState((state) => ({
        isDirty: true,
        workspace: { ...state.workspace, filename: name },
      }));
    }
    setEditingFilename(false);
  };

  const handleZoomToFit = () => {
    useCanvasStore.getState().zoomToFit();
  };

  const handleExportMarkdown = () => {
    // Flush active page content
    const canvasNodes = useCanvasStore.getState().nodes;
    useWorkspaceStore.getState().savePageNodes(canvasNodes);
    useWorkspaceStore.getState().savePageStrokes(useDrawStore.getState().strokes);

    const ws = useWorkspaceStore.getState().workspace;
    const md = workspaceToMarkdown(ws);
    const filename = ws.filename.replace(/[^a-zA-Z0-9_\- ]/g, '_') + '.md';
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`Exported ${filename}`, 'success');
    setShowExportMenu(false);
  };

  return (
    <header className="top-bar" data-testid="topbar">
      <div className="top-bar__breadcrumb">
        {editingFilename ? (
          <input
            className="top-bar__filename-input"
            data-testid="topbar-filename-input"
            value={filenameValue}
            onChange={(e) => setFilenameValue(e.target.value)}
            onBlur={commitFilename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitFilename();
              if (e.key === 'Escape') setEditingFilename(false);
            }}
            autoFocus
          />
        ) : (
          <span
            className="top-bar__filename"
            data-testid="topbar-filename"
            onClick={handleFilenameClick}
            title="Click to rename notebook"
          >
            {workspace.filename}
            {isDirty && <span className="top-bar__dirty" data-testid="dirty-indicator"> *</span>}
          </span>
        )}
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
          onClick={handleZoomToFit}
          title="Zoom to fit content"
          data-testid="zoom-fit-btn"
        >
          <Maximize size={16} />
        </button>
        <button
          className="top-bar__action-btn"
          onClick={handleOpen}
          title="Open notebook"
          data-testid="open-btn"
        >
          <FolderOpen size={16} />
        </button>
        <div className="top-bar__save-group">
          <button
            className="top-bar__action-btn top-bar__action-btn--primary"
            onClick={() => handleSave(false)}
            title="Save (Ctrl+S)"
            data-testid="save-btn"
          >
            <Download size={16} />
          </button>
          <button
            className="top-bar__action-btn top-bar__action-btn--primary top-bar__save-chevron"
            onClick={() => setShowExportMenu((v) => !v)}
            title="Export options"
            data-testid="save-dropdown-btn"
          >
            <ChevronDown size={12} />
          </button>
          {showExportMenu && (
            <div className="top-bar__export-menu" data-testid="export-menu">
              <button
                className="top-bar__export-item"
                onClick={() => { handleSave(false); setShowExportMenu(false); }}
              >
                Save
              </button>
              {isFSASupported() && (
                <button
                  className="top-bar__export-item"
                  onClick={() => { handleSave(true); setShowExportMenu(false); }}
                  data-testid="save-as-btn"
                >
                  Save As...
                </button>
              )}
              <button
                className="top-bar__export-item"
                onClick={handleExportMarkdown}
                data-testid="export-markdown-btn"
              >
                Export as Markdown
              </button>
            </div>
          )}
        </div>
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
