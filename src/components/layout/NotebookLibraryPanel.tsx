import { useState, useEffect } from 'react';
import { X, Trash2, FolderOpen as Open } from 'lucide-react';
import {
  loadLibrary,
  deleteFromLibrary,
  formatRelativeTime,
  type LibraryEntry,
} from '../../utils/notebookLibrary';
import { useWorkspaceStore } from '../../stores/useWorkspaceStore';
import { useCanvasStore } from '../../stores/useCanvasStore';
import { useDrawStore } from '../../stores/useDrawStore';
import { showToast } from './Toast';
import './NotebookLibraryPanel.css';

interface NotebookLibraryPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function NotebookLibraryPanel({ isOpen, onClose }: NotebookLibraryPanelProps) {
  const [entries, setEntries] = useState<LibraryEntry[]>([]);

  useEffect(() => {
    if (isOpen) {
      setEntries(loadLibrary());
    }
  }, [isOpen]);

  const refresh = () => setEntries(loadLibrary());

  const handleLoad = (entry: LibraryEntry) => {
    const isDirty = useWorkspaceStore.getState().isDirty;
    if (isDirty) {
      const confirmed = window.confirm(
        'You have unsaved changes. Loading another notebook will discard them. Continue?',
      );
      if (!confirmed) return;
    }

    const ws = entry.workspace;
    useWorkspaceStore.setState({
      workspace: ws,
      activeSectionId: ws.sections[0]?.id ?? '',
      activePageId: ws.sections[0]?.pages[0]?.id ?? '',
      isDirty: false,
    });
    const firstPage = ws.sections[0]?.pages[0];
    useCanvasStore.getState().loadPageNodes(firstPage?.nodes ?? []);
    useDrawStore.getState().loadPageStrokes(firstPage?.strokes ?? []);
    showToast(`Loaded "${entry.name}"`, 'info');
    onClose();
  };

  const handleDelete = (entry: LibraryEntry, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm(`Delete "${entry.name}" from library?`)) return;
    deleteFromLibrary(entry.id);
    refresh();
  };

  if (!isOpen) return null;

  return (
    <div className="library-panel" data-testid="library-panel">
      <div className="library-panel__header">
        <h3 className="library-panel__title">Notebook Library</h3>
        <button className="library-panel__close" onClick={onClose} aria-label="Close">
          <X size={16} />
        </button>
      </div>
      <div className="library-panel__body">
        {entries.length === 0 ? (
          <div className="library-panel__empty">
            No notebooks yet. Your notebooks will auto-save here as you edit.
          </div>
        ) : (
          entries.map((entry) => (
            <div
              key={entry.id}
              className="library-panel__entry"
              data-testid="library-entry"
            >
              <div className="library-panel__entry-info">
                <div className="library-panel__entry-name">{entry.name}</div>
                <div className="library-panel__entry-time">
                  {formatRelativeTime(entry.updatedAt)}
                  {' · '}
                  {entry.workspace.sections.length} section
                  {entry.workspace.sections.length !== 1 ? 's' : ''}
                </div>
              </div>
              <div className="library-panel__entry-actions">
                <button
                  className="library-panel__btn"
                  onClick={() => handleLoad(entry)}
                  title="Load notebook"
                  data-testid="library-load-btn"
                >
                  <Open size={14} />
                </button>
                <button
                  className="library-panel__btn library-panel__btn--danger"
                  onClick={(e) => handleDelete(entry, e)}
                  title="Delete from library"
                  data-testid="library-delete-btn"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
