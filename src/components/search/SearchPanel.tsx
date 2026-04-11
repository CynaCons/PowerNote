import { useState, useRef, useEffect, useCallback } from 'react';
import { Search, X, Replace } from 'lucide-react';
import { useCanvasStore } from '../../stores/useCanvasStore';
import { useWorkspaceStore } from '../../stores/useWorkspaceStore';
import './SearchPanel.css';

interface SearchResult {
  sectionId: string;
  sectionTitle: string;
  pageId: string;
  pageTitle: string;
  nodeId: string;
  text: string;
  matchSnippet: string;
}

interface SearchPanelProps {
  isOpen: boolean;
  isNotebookWide: boolean;
  onClose: () => void;
  onNavigateToResult: (sectionId: string, pageId: string, nodeId: string) => void;
}

export function SearchPanel({ isOpen, isNotebookWide, onClose, onNavigateToResult }: SearchPanelProps) {
  const [query, setQuery] = useState('');
  const [replaceMode, setReplaceMode] = useState(false);
  const [replacement, setReplacement] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const nodes = useCanvasStore((s) => s.nodes);
  const updateNode = useCanvasStore((s) => s.updateNode);
  const workspace = useWorkspaceStore((s) => s.workspace);
  const setWorkspaceState = useWorkspaceStore.setState;
  const activeSectionId = useWorkspaceStore((s) => s.activeSectionId);
  const activePageId = useWorkspaceStore((s) => s.activePageId);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isOpen]);

  const getResults = useCallback((): SearchResult[] => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();

    if (!isNotebookWide) {
      // Page search: only current page's nodes
      return nodes
        .filter((n) => {
          if (n.type !== 'text') return false;
          const text = (n.data as any).text || '';
          return text.toLowerCase().includes(q);
        })
        .map((n) => {
          const text = (n.data as any).text || '';
          const idx = text.toLowerCase().indexOf(q);
          const start = Math.max(0, idx - 20);
          const end = Math.min(text.length, idx + query.length + 20);
          const snippet = (start > 0 ? '...' : '') + text.slice(start, end) + (end < text.length ? '...' : '');
          const section = workspace.sections.find((s) => s.id === activeSectionId);
          const page = section?.pages.find((p) => p.id === activePageId);
          return {
            sectionId: activeSectionId,
            sectionTitle: section?.title || '',
            pageId: activePageId,
            pageTitle: page?.title || '',
            nodeId: n.id,
            text,
            matchSnippet: snippet,
          };
        });
    }

    // Notebook-wide search: all sections, all pages
    // For the active page, use canvas store nodes (live data) instead of workspace store (stale)
    const results: SearchResult[] = [];
    for (const section of workspace.sections) {
      for (const page of section.pages) {
        const isActivePage = section.id === activeSectionId && page.id === activePageId;
        const pageNodes = isActivePage ? nodes : page.nodes;
        for (const node of pageNodes) {
          if (node.type !== 'text') continue;
          const text = (node.data as any).text || '';
          if (!text.toLowerCase().includes(q)) continue;
          const idx = text.toLowerCase().indexOf(q);
          const start = Math.max(0, idx - 20);
          const end = Math.min(text.length, idx + query.length + 20);
          const snippet = (start > 0 ? '...' : '') + text.slice(start, end) + (end < text.length ? '...' : '');
          results.push({
            sectionId: section.id,
            sectionTitle: section.title,
            pageId: page.id,
            pageTitle: page.title,
            nodeId: node.id,
            text,
            matchSnippet: snippet,
          });
        }
      }
    }
    return results;
  }, [query, isNotebookWide, nodes, workspace, activeSectionId, activePageId]);

  const replaceAll = useCallback(() => {
    if (!query.trim()) return;
    const q = query;

    // Replace in active page's canvas nodes (live store)
    const activeNodesToUpdate = nodes.filter((n) => {
      if (n.type !== 'text') return false;
      const text = (n.data as any).text || '';
      return text.includes(q);
    });
    for (const n of activeNodesToUpdate) {
      const oldText = (n.data as any).text || '';
      const newText = oldText.split(q).join(replacement);
      updateNode(n.id, { data: { ...n.data, text: newText } as any });
    }

    // For notebook-wide replace, also update non-active pages via workspace store
    if (isNotebookWide) {
      const ws = workspace;
      const updatedSections = ws.sections.map((section) => ({
        ...section,
        pages: section.pages.map((page) => {
          const isActivePage = section.id === activeSectionId && page.id === activePageId;
          if (isActivePage) return page; // already handled via canvas store above
          const updatedNodes = page.nodes.map((node) => {
            if (node.type !== 'text') return node;
            const text = (node.data as any).text || '';
            if (!text.includes(q)) return node;
            return { ...node, data: { ...node.data, text: text.split(q).join(replacement) } };
          });
          return { ...page, nodes: updatedNodes };
        }),
      }));
      setWorkspaceState({ workspace: { ...ws, sections: updatedSections }, isDirty: true });
    }
  }, [query, replacement, nodes, updateNode, workspace, activeSectionId, activePageId, isNotebookWide, setWorkspaceState]);

  if (!isOpen) return null;

  const results = getResults();

  return (
    <div className="search-panel" data-testid="search-panel">
      <div className="search-panel__header">
        <Search size={16} />
        <input
          ref={inputRef}
          className="search-panel__input"
          placeholder={isNotebookWide ? 'Search notebook...' : 'Search this page...'}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') onClose();
          }}
          data-testid="search-input"
        />
        <span className="search-panel__count">
          {query.trim() ? `${results.length} result${results.length !== 1 ? 's' : ''}` : ''}
        </span>
        <button
          className={`search-panel__toggle ${replaceMode ? 'search-panel__toggle--active' : ''}`}
          onClick={() => setReplaceMode((v) => !v)}
          title="Toggle Replace"
          data-testid="search-replace-toggle"
        >
          <Replace size={14} />
        </button>
        <button className="search-panel__close" onClick={onClose}>
          <X size={16} />
        </button>
      </div>
      {replaceMode && (
        <div className="search-panel__replace-row" data-testid="search-replace-row">
          <input
            className="search-panel__input"
            placeholder="Replace with..."
            value={replacement}
            onChange={(e) => setReplacement(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') onClose();
            }}
            data-testid="search-replace-input"
          />
          <button
            className="search-panel__btn"
            onClick={replaceAll}
            disabled={!query.trim()}
            data-testid="search-replace-all"
          >
            Replace All
          </button>
        </div>
      )}
      {query.trim() && (
        <div className="search-panel__results">
          {results.length === 0 && (
            <div className="search-panel__empty">No results found</div>
          )}
          {results.map((r, i) => (
            <button
              key={`${r.nodeId}-${i}`}
              className="search-panel__result"
              onClick={() => onNavigateToResult(r.sectionId, r.pageId, r.nodeId)}
              data-testid="search-result"
            >
              {isNotebookWide && (
                <span className="search-panel__result-path">
                  {r.sectionTitle} &gt; {r.pageTitle}
                </span>
              )}
              <span className="search-panel__result-snippet">{r.matchSnippet}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
