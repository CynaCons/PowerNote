import { useState } from 'react';
import { ChevronDown, ChevronRight, Plus } from 'lucide-react';
import type { Section } from '../../types/data';
import { PageItem } from './PageItem';
import './HierarchyPanel.css';

interface SectionItemProps {
  section: Section;
  activePageId: string;
  onNavigate: (sectionId: string, pageId: string) => void;
  onAddPage: (sectionId: string) => void;
}

export function SectionItem({ section, activePageId, onNavigate, onAddPage }: SectionItemProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <div className="hierarchy-section">
      <div className="hierarchy-section__header">
        <button
          className="hierarchy-section__toggle"
          onClick={() => setIsExpanded((prev) => !prev)}
        >
          {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          <span className="hierarchy-section__title">{section.title}</span>
        </button>
        <button
          className="hierarchy-section__add"
          onClick={() => onAddPage(section.id)}
          title="Add page"
        >
          <Plus size={14} />
        </button>
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
            />
          ))}
        </div>
      )}
    </div>
  );
}
