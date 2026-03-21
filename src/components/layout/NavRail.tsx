import { Layers, Type, Pen, Settings } from 'lucide-react';
import { useToolStore } from '../../stores/useToolStore';
import './NavRail.css';

interface NavRailProps {
  onToggleHierarchy: () => void;
  isHierarchyOpen: boolean;
  onToggleSettings: () => void;
  isSettingsOpen: boolean;
}

export function NavRail({ onToggleHierarchy, isHierarchyOpen, onToggleSettings, isSettingsOpen }: NavRailProps) {
  const activeTool = useToolStore((s) => s.activeTool);
  const setTool = useToolStore((s) => s.setTool);

  return (
    <nav className="nav-rail" data-testid="nav-rail">
      <div className="nav-rail__top">
        <button
          className={`nav-rail__btn ${isHierarchyOpen ? 'nav-rail__btn--active' : ''}`}
          title="Notes hierarchy"
          aria-label="Notes hierarchy"
          data-testid="nav-hierarchy"
          onClick={onToggleHierarchy}
        >
          <Layers size={20} />
        </button>
      </div>

      <div className="nav-rail__tools">
        <button
          className={`nav-rail__btn ${activeTool === 'text' ? 'nav-rail__btn--active' : ''}`}
          title="Text tool (T)"
          aria-label="Text tool"
          data-testid="nav-text-tool"
          onClick={() => setTool(activeTool === 'text' ? 'select' : 'text')}
        >
          <Type size={20} />
        </button>

        <button
          className="nav-rail__btn"
          title="Draw tool (coming soon)"
          aria-label="Draw tool"
          data-testid="nav-draw-tool"
          disabled
        >
          <Pen size={20} />
        </button>
      </div>

      <div className="nav-rail__bottom">
        <button
          className={`nav-rail__btn ${isSettingsOpen ? 'nav-rail__btn--active' : ''}`}
          title="Settings"
          aria-label="Settings"
          data-testid="nav-settings"
          onClick={onToggleSettings}
        >
          <Settings size={20} />
        </button>
      </div>
    </nav>
  );
}
