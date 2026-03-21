import { useState, useRef, useEffect } from 'react';
import { ChevronDown, ChevronRight, Plus, Trash2 } from 'lucide-react';
import type { Section } from '../../types/data';
import { PageItem } from './PageItem';
import './HierarchyPanel.css';

interface SectionItemProps {
  section: Section;
  activePageId: string;
  onNavigate: (sectionId: string, pageId: string) => void;
  onAddPage: (sectionId: string) => void;
  onRenameSection: (sectionId: string, title: string) => void;
  onDeleteSection: (sectionId: string) => void;
  onRenamePage: (sectionId: string, pageId: string, title: string) => void;
  onDeletePage: (sectionId: string, pageId: string) => void;
}

export function SectionItem({
  section,
  activePageId,
  onNavigate,
  onAddPage,
  onRenameSection,
  onDeleteSection,
  onRenamePage,
  onDeletePage,
}: SectionItemProps) {
  const [isExpanded, setIsExpanded] = useState(true);
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
    if (val && val !== section.title) {
      onRenameSection(section.id, val);
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

  return (
    <div className="hierarchy-section" data-testid={`section-${section.id}`}>
      <div className="hierarchy-section__header">
        <button
          className="hierarchy-section__toggle"
          onClick={() => setIsExpanded((prev) => !prev)}
        >
          {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          {isRenaming ? (
            <input
              ref={inputRef}
              className="hierarchy-section__rename-input"
              defaultValue={section.title}
              onBlur={handleRenameCommit}
              onKeyDown={handleRenameKeyDown}
              data-testid="section-rename-input"
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span
              className="hierarchy-section__title"
              onDoubleClick={(e) => {
                e.stopPropagation();
                setIsRenaming(true);
              }}
              data-testid="section-title"
            >
              {section.title}
            </span>
          )}
        </button>
        <div className="hierarchy-section__actions">
          <button
            className="hierarchy-section__action-btn"
            onClick={() => onAddPage(section.id)}
            title="Add page"
            data-testid="add-page-btn"
          >
            <Plus size={14} />
          </button>
          <button
            className="hierarchy-section__action-btn hierarchy-section__action-btn--danger"
            onClick={() => onDeleteSection(section.id)}
            title="Delete section"
            data-testid="delete-section-btn"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
      {isExpanded && (
        <div className="hierarchy-section__pages">
          {section.pages.map((page) => (
            <PageItem
              key={page.id}
              page={page}
              sectionId={section.id}
              isActive={page.id === activePageId}
              onNavigate={onNavigate}
              onRenamePage={onRenamePage}
              onDeletePage={onDeletePage}
            />
          ))}
        </div>
      )}
    </div>
  );
}
