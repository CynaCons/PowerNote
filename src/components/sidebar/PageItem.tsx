import { useState, useRef, useEffect } from 'react';
import { FileText, Pencil, X } from 'lucide-react';
import type { Page } from '../../types/data';
import './HierarchyPanel.css';

interface PageItemProps {
  page: Page;
  sectionId: string;
  isActive: boolean;
  onNavigate: (sectionId: string, pageId: string) => void;
  onRenamePage: (sectionId: string, pageId: string, title: string) => void;
  onDeletePage: (sectionId: string, pageId: string) => void;
}

export function PageItem({
  page,
  sectionId,
  isActive,
  onNavigate,
  onRenamePage,
  onDeletePage,
}: PageItemProps) {
  const [isRenaming, setIsRenaming] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isRenaming && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isRenaming]);

  const handleRenameCommit = () => {
    const val = inputRef.current?.value.trim();
    if (val && val !== page.title) {
      onRenamePage(sectionId, page.id, val);
    }
    setIsRenaming(false);
  };

  const handleRenameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleRenameCommit();
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      setIsRenaming(false);
    }
  };

  if (isRenaming) {
    return (
      <div className="hierarchy-page hierarchy-page--renaming" data-testid={`page-${page.id}`}>
        <FileText size={14} />
        <input
          ref={inputRef}
          className="hierarchy-page__rename-input"
          defaultValue={page.title}
          onBlur={handleRenameCommit}
          onKeyDown={handleRenameKeyDown}
          data-testid="page-rename-input"
        />
      </div>
    );
  }

  return (
    <div
      className={`hierarchy-page ${isActive ? 'hierarchy-page--active' : ''}`}
      data-testid={`page-${page.id}`}
    >
      <button
        className="hierarchy-page__nav"
        onClick={() => onNavigate(sectionId, page.id)}
        title={page.title}
      >
        <FileText size={14} />
        <span className="hierarchy-page__title" data-testid="page-title">{page.title}</span>
      </button>
      <div className="hierarchy-page__actions">
        <button
          className="hierarchy-page__action-btn"
          onClick={(e) => {
            e.stopPropagation();
            setIsRenaming(true);
          }}
          title="Rename page"
          data-testid="rename-page-btn"
        >
          <Pencil size={12} />
        </button>
        <button
          className="hierarchy-page__action-btn hierarchy-page__action-btn--danger"
          onClick={(e) => {
            e.stopPropagation();
            onDeletePage(sectionId, page.id);
          }}
          title="Delete page"
          data-testid="delete-page-btn"
        >
          <X size={12} />
        </button>
      </div>
    </div>
  );
}
