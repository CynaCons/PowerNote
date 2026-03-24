import { useRef } from 'react';
import { Layers, Type, Pen, ImageIcon, BoxSelect, Shapes, Settings } from 'lucide-react';
import { useToolStore } from '../../stores/useToolStore';
import { useCanvasStore } from '../../stores/useCanvasStore';
import { generateId } from '../../utils/ids';
import type { CanvasNode, ImageNodeData } from '../../types/data';
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
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImagePick = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    let offsetY = 0;
    Array.from(files).forEach((file) => {
      if (!file.type.startsWith('image/')) return;
      const reader = new FileReader();
      const yPos = 200 + offsetY;
      offsetY += 20; // stagger multiple images
      reader.onload = () => {
        const src = reader.result as string;
        const img = new Image();
        img.onload = () => {
          const maxW = 600;
          let w = img.naturalWidth;
          let h = img.naturalHeight;
          if (w > maxW) {
            h = h * (maxW / w);
            w = maxW;
          }
          const node: CanvasNode = {
            id: generateId(),
            type: 'image',
            x: 200, y: yPos,
            width: w, height: h,
            layer: 3,
            data: {
              src,
              alt: file.name || 'image',
              naturalWidth: img.naturalWidth,
              naturalHeight: img.naturalHeight,
            } as ImageNodeData,
          };
          useCanvasStore.getState().addNode(node);
        };
        img.src = src;
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

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
          title="Insert image"
          aria-label="Insert image"
          data-testid="nav-image-tool"
          onClick={handleImagePick}
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

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          style={{ display: 'none' }}
          onChange={handleFileSelected}
          data-testid="image-file-input"
        />
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
