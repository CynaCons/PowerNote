import { Layers, Type, Pen } from 'lucide-react';
import { useToolStore } from '../../stores/useToolStore';
import './NavRail.css';

interface NavRailProps {
  onToggleHierarchy: () => void;
  isHierarchyOpen: boolean;
}

export function NavRail({ onToggleHierarchy, isHierarchyOpen }: NavRailProps) {
  const activeTool = useToolStore((s) => s.activeTool);
  const setTool = useToolStore((s) => s.setTool);

  return (
    <nav className="nav-rail">
      <div className="nav-rail__top">
        <button
          className={`nav-rail__btn ${isHierarchyOpen ? 'nav-rail__btn--active' : ''}`}
          title="Notes hierarchy"
          aria-label="Notes hierarchy"
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
          onClick={() => setTool(activeTool === 'text' ? 'select' : 'text')}
        >
          <Type size={20} />
        </button>

        <button
          className="nav-rail__btn"
          title="Draw tool (coming soon)"
          aria-label="Draw tool"
          disabled
        >
          <Pen size={20} />
        </button>
      </div>
    </nav>
  );
}
