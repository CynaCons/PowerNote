import { FileText } from 'lucide-react';
import type { Page } from '../../types/data';
import './HierarchyPanel.css';

interface PageItemProps {
  page: Page;
  sectionId: string;
  isActive: boolean;
  onNavigate: (sectionId: string, pageId: string) => void;
}

export function PageItem({ page, sectionId, isActive, onNavigate }: PageItemProps) {
  return (
    <button
      className={`hierarchy-page ${isActive ? 'hierarchy-page--active' : ''}`}
      onClick={() => onNavigate(sectionId, page.id)}
      title={page.title}
    >
      <FileText size={14} />
      <span className="hierarchy-page__title">{page.title}</span>
    </button>
  );
}
