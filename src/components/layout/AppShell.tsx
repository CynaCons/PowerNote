import { useState } from 'react';
import { NavRail } from './NavRail';
import { TopBar } from './TopBar';
import { InfiniteCanvas } from '../canvas/InfiniteCanvas';
import { HierarchyPanel } from '../sidebar/HierarchyPanel';
import { BottomToolbar } from '../toolbar/BottomToolbar';
import './AppShell.css';

export function AppShell() {
  const [isHierarchyOpen, setIsHierarchyOpen] = useState(false);

  return (
    <div className="app-shell">
      <NavRail
        onToggleHierarchy={() => setIsHierarchyOpen((prev) => !prev)}
        isHierarchyOpen={isHierarchyOpen}
      />
      <TopBar />
      <div className="canvas-area">
        <InfiniteCanvas />
        <HierarchyPanel isOpen={isHierarchyOpen} />
        <BottomToolbar />
      </div>
    </div>
  );
}
