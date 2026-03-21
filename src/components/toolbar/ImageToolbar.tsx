import { useState } from 'react';
import { Crop, RotateCcw } from 'lucide-react';
import type { CanvasNode, ImageNodeData, ImageCrop } from '../../types/data';
import { useCanvasStore } from '../../stores/useCanvasStore';
import './BottomToolbar.css';

interface ImageToolbarProps {
  node: CanvasNode;
}

export function ImageToolbar({ node }: ImageToolbarProps) {
  const data = node.data as ImageNodeData;
  const updateNode = useCanvasStore((s) => s.updateNode);
  const [cropMode, setCropMode] = useState(false);
  const [cropValues, setCropValues] = useState<ImageCrop>(
    data.crop || { x: 0, y: 0, width: 1, height: 1 },
  );

  const handleCropToggle = () => {
    if (cropMode) {
      // Apply crop
      updateNode(node.id, {
        data: { ...data, crop: cropValues },
      });
      setCropMode(false);
    } else {
      setCropValues(data.crop || { x: 0, y: 0, width: 1, height: 1 });
      setCropMode(true);
    }
  };

  const handleResetCrop = () => {
    updateNode(node.id, {
      data: { ...data, crop: undefined },
    });
    setCropValues({ x: 0, y: 0, width: 1, height: 1 });
    setCropMode(false);
  };

  const handleCropChange = (field: keyof ImageCrop, value: number) => {
    const v = Math.max(0, Math.min(1, value));
    const newCrop = { ...cropValues, [field]: v };
    // Ensure width/height don't exceed remaining space
    if (field === 'x') newCrop.width = Math.min(newCrop.width, 1 - v);
    if (field === 'y') newCrop.height = Math.min(newCrop.height, 1 - v);
    if (field === 'width') newCrop.width = Math.min(v, 1 - newCrop.x);
    if (field === 'height') newCrop.height = Math.min(v, 1 - newCrop.y);
    setCropValues(newCrop);

    // Live preview
    updateNode(node.id, {
      data: { ...data, crop: newCrop },
    });
  };

  return (
    <div className="text-toolbar" data-testid="image-toolbar">
      <button
        className={`text-toolbar__btn ${cropMode ? 'text-toolbar__btn--active' : ''}`}
        onClick={handleCropToggle}
        title={cropMode ? 'Apply crop' : 'Crop image'}
        data-testid="crop-btn"
      >
        <Crop size={16} />
        <span style={{ fontSize: 11, marginLeft: 4 }}>
          {cropMode ? 'Apply' : 'Crop'}
        </span>
      </button>

      {cropMode && (
        <>
          <div className="text-toolbar__divider" />
          <div className="image-toolbar__crop-controls">
            <label className="image-toolbar__slider">
              <span>L</span>
              <input
                type="range" min="0" max="0.9" step="0.01"
                value={cropValues.x}
                onChange={(e) => handleCropChange('x', parseFloat(e.target.value))}
                data-testid="crop-left"
              />
            </label>
            <label className="image-toolbar__slider">
              <span>T</span>
              <input
                type="range" min="0" max="0.9" step="0.01"
                value={cropValues.y}
                onChange={(e) => handleCropChange('y', parseFloat(e.target.value))}
                data-testid="crop-top"
              />
            </label>
            <label className="image-toolbar__slider">
              <span>W</span>
              <input
                type="range" min="0.1" max="1" step="0.01"
                value={cropValues.width}
                onChange={(e) => handleCropChange('width', parseFloat(e.target.value))}
                data-testid="crop-width"
              />
            </label>
            <label className="image-toolbar__slider">
              <span>H</span>
              <input
                type="range" min="0.1" max="1" step="0.01"
                value={cropValues.height}
                onChange={(e) => handleCropChange('height', parseFloat(e.target.value))}
                data-testid="crop-height"
              />
            </label>
          </div>
        </>
      )}

      {data.crop && !cropMode && (
        <>
          <div className="text-toolbar__divider" />
          <button
            className="text-toolbar__btn"
            onClick={handleResetCrop}
            title="Reset crop (show full image)"
            data-testid="reset-crop-btn"
          >
            <RotateCcw size={16} />
            <span style={{ fontSize: 11, marginLeft: 4 }}>Reset</span>
          </button>
        </>
      )}

      <div className="text-toolbar__divider" />
      <span style={{ fontSize: 11, color: '#94a3b8' }}>
        {Math.round(data.naturalWidth)}×{Math.round(data.naturalHeight)}
      </span>
    </div>
  );
}
