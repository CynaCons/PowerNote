import { useState, useEffect, useCallback } from 'react';
import { NavRail } from './NavRail';
import { TopBar } from './TopBar';
import { InfiniteCanvas } from '../canvas/InfiniteCanvas';
import { HierarchyPanel } from '../sidebar/HierarchyPanel';
import { BottomToolbar } from '../toolbar/BottomToolbar';
import { SearchPanel } from '../search/SearchPanel';
import { useWorkspaceStore } from '../../stores/useWorkspaceStore';
import { useCanvasStore } from '../../stores/useCanvasStore';
import { buildExportHtml, downloadFile } from '../../utils/serialization';
import './AppShell.css';

export function AppShell() {
  const [isHierarchyOpen, setIsHierarchyOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchNotebookWide, setSearchNotebookWide] = useState(false);

  // Ctrl+F / Ctrl+Shift+F keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+S: save
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        const canvasNodes = useCanvasStore.getState().nodes;
        useWorkspaceStore.getState().savePageNodes(canvasNodes);
        const ws = useWorkspaceStore.getState().workspace;
        buildExportHtml(ws).then((html) => {
          downloadFile(html, ws.filename.replace(/[^a-zA-Z0-9_-]/g, '_') + '.html');
        });
      }

      // Ctrl+F / Ctrl+Shift+F: search
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        setSearchNotebookWide(e.shiftKey);
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleNavigateToResult = useCallback((sectionId: string, pageId: string, nodeId: string) => {
    const ws = useWorkspaceStore.getState();
    const canvas = useCanvasStore.getState();

    // Save current page nodes before navigating
    ws.savePageNodes(canvas.nodes);

    // Navigate to the target page
    ws.setActivePage(sectionId, pageId);

    // Load the target page's nodes
    const section = ws.workspace.sections.find((s) => s.id === sectionId);
    const page = section?.pages.find((p) => p.id === pageId);
    canvas.loadPageNodes(page?.nodes ?? []);

    // Select the matched node
    canvas.selectNode(nodeId, false);

    setSearchOpen(false);
  }, []);

  return (
    <div className="app-shell" data-testid="app-shell">
      <NavRail
        onToggleHierarchy={() => setIsHierarchyOpen((prev) => !prev)}
        isHierarchyOpen={isHierarchyOpen}
      />
      <TopBar />
      <div className="canvas-area">
        <HierarchyPanel isOpen={isHierarchyOpen} />
        <div className="canvas-area__content">
          <InfiniteCanvas />
          <BottomToolbar />
          <SearchPanel
            isOpen={searchOpen}
            isNotebookWide={searchNotebookWide}
            onClose={() => setSearchOpen(false)}
            onNavigateToResult={handleNavigateToResult}
          />
        </div>
      </div>
    </div>
  );
}
