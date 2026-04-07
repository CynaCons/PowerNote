import { Layers, Type, Pen, ImageIcon, BoxSelect, Shapes, Settings } from 'lucide-react';
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
          className={`nav-rail__btn ${activeTool === 'image' ? 'nav-rail__btn--active' : ''}`}
          title="Image tool (I)"
          aria-label="Image tool"
          data-testid="nav-image-tool"
          onClick={() => setTool(activeTool === 'image' ? 'select' : 'image')}
        >
          <ImageIcon size={20} />
        </button>

        <button
          className={`nav-rail__btn ${activeTool === 'draw' ? 'nav-rail__btn--active' : ''}`}
          title="Draw tool (D)"
          aria-label="Draw tool"
          data-testid="nav-draw-tool"
          onClick={() => setTool(activeTool === 'draw' ? 'select' : 'draw')}
        >
          <Pen size={20} />
        </button>

        <button
          className={`nav-rail__btn ${activeTool === 'shape' ? 'nav-rail__btn--active' : ''}`}
          title="Shapes (S)"
          aria-label="Shapes"
          data-testid="nav-shape-tool"
          onClick={() => setTool(activeTool === 'shape' ? 'select' : 'shape')}
        >
          <Shapes size={20} />
        </button>

        <button
          className={`nav-rail__btn ${activeTool === 'lasso' ? 'nav-rail__btn--active' : ''}`}
          title="Lasso select (L)"
          aria-label="Lasso select"
          data-testid="nav-lasso-tool"
          onClick={() => setTool(activeTool === 'lasso' ? 'select' : 'lasso')}
        >
          <BoxSelect size={20} />
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
