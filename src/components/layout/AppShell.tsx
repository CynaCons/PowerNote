import { useState, useEffect, useCallback } from 'react';
import { NavRail } from './NavRail';
import { TopBar } from './TopBar';
import { InfiniteCanvas } from '../canvas/InfiniteCanvas';
import { HierarchyPanel } from '../sidebar/HierarchyPanel';
import { BottomToolbar } from '../toolbar/BottomToolbar';
import { SearchPanel } from '../search/SearchPanel';
import { SettingsPanel } from '../settings/SettingsPanel';
import type { BackgroundMode } from '../canvas/PageGuides';
import type { CanvasBgColor } from '../canvas/InfiniteCanvas';
import { useWorkspaceStore } from '../../stores/useWorkspaceStore';
import { useCanvasStore } from '../../stores/useCanvasStore';
import { useDrawStore } from '../../stores/useDrawStore';
import { buildExportHtml, downloadFile } from '../../utils/serialization';
import { showToast } from './Toast';
import './AppShell.css';

export function AppShell() {
  const [isHierarchyOpen, setIsHierarchyOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchNotebookWide, setSearchNotebookWide] = useState(false);
  const [backgroundMode, setBackgroundMode] = useState<BackgroundMode>('pages');
  const [bgColor, setBgColor] = useState<CanvasBgColor>('#ffffff');

  // Ctrl+S / Ctrl+F / Ctrl+Shift+F keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+S: save
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        const canvasNodes = useCanvasStore.getState().nodes;
        useWorkspaceStore.getState().savePageNodes(canvasNodes);
        useWorkspaceStore.getState().savePageStrokes(useDrawStore.getState().strokes);
        const ws = useWorkspaceStore.getState().workspace;
        buildExportHtml(ws).then((html) => {
          downloadFile(html, ws.filename.replace(/[^a-zA-Z0-9_\- ]/g, '_') + '.html');
          useWorkspaceStore.getState().markClean();
          showToast('Notebook saved successfully', 'success');
        }).catch(() => {
          showToast('Failed to save notebook', 'error');
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

    ws.savePageNodes(canvas.nodes);
    ws.savePageStrokes(useDrawStore.getState().strokes);
    ws.setActivePage(sectionId, pageId);

    const section = ws.workspace.sections.find((s) => s.id === sectionId);
    const page = section?.pages.find((p) => p.id === pageId);
    canvas.loadPageNodes(page?.nodes ?? []);
    useDrawStore.getState().loadPageStrokes(page?.strokes ?? []);
    canvas.selectNode(nodeId, false);

    setSearchOpen(false);
  }, []);

  return (
    <div className="app-shell" data-testid="app-shell">
      <NavRail
        onToggleHierarchy={() => setIsHierarchyOpen((prev) => !prev)}
        isHierarchyOpen={isHierarchyOpen}
        onToggleSettings={() => setIsSettingsOpen((prev) => !prev)}
        isSettingsOpen={isSettingsOpen}
      />
      <TopBar />
      <div className="canvas-area">
        <HierarchyPanel isOpen={isHierarchyOpen} />
        <div className="canvas-area__content">
          <InfiniteCanvas backgroundMode={backgroundMode} bgColor={bgColor} />
          <BottomToolbar />
          <SearchPanel
            isOpen={searchOpen}
            isNotebookWide={searchNotebookWide}
            onClose={() => setSearchOpen(false)}
            onNavigateToResult={handleNavigateToResult}
          />
        </div>
      </div>
      {isSettingsOpen && (
        <SettingsPanel
          backgroundMode={backgroundMode}
          onChangeBackgroundMode={setBackgroundMode}
          bgColor={bgColor}
          onChangeBgColor={setBgColor}
        />
      )}
    </div>
  );
}
