import { useRef, useState } from 'react';
import { Plus, Crop, RotateCw, RotateCcw, Type } from 'lucide-react';
import type { CanvasNode, ImageNodeData, ImageCrop } from '../../types/data';
import { useCanvasStore } from '../../stores/useCanvasStore';
import { generateId } from '../../utils/ids';
import './BottomToolbar.css';

interface ImageToolbarProps {
  node?: CanvasNode; // undefined when image tool is active but no image selected
}

export function ImageToolbar({ node }: ImageToolbarProps) {
  const data = node ? (node.data as ImageNodeData) : null;
  const updateNode = useCanvasStore((s) => s.updateNode);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [cropMode, setCropMode] = useState(false);
  const [cropValues, setCropValues] = useState<ImageCrop>(
    data?.crop || { x: 0, y: 0, width: 1, height: 1 },
  );

  const handleImport = () => {
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
      offsetY += 20;
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
          useCanvasStore.getState().addNode({
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
          });
        };
        img.src = src;
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  const handleCropToggle = () => {
    if (!node || !data) return;
    if (cropMode) {
      updateNode(node.id, { data: { ...data, crop: cropValues } });
      setCropMode(false);
    } else {
      setCropValues(data.crop || { x: 0, y: 0, width: 1, height: 1 });
      setCropMode(true);
    }
  };

  const handleResetCrop = () => {
    if (!node || !data) return;
    updateNode(node.id, { data: { ...data, crop: undefined } });
    setCropValues({ x: 0, y: 0, width: 1, height: 1 });
    setCropMode(false);
  };

  const handleCropChange = (field: keyof ImageCrop, value: number) => {
    if (!node || !data) return;
    const v = Math.max(0, Math.min(1, value));
    const newCrop = { ...cropValues, [field]: v };
    if (field === 'x') newCrop.width = Math.min(newCrop.width, 1 - v);
    if (field === 'y') newCrop.height = Math.min(newCrop.height, 1 - v);
    if (field === 'width') newCrop.width = Math.min(v, 1 - newCrop.x);
    if (field === 'height') newCrop.height = Math.min(v, 1 - newCrop.y);
    setCropValues(newCrop);
    updateNode(node.id, { data: { ...data, crop: newCrop } });
  };

  const handleRotate = (degrees: number) => {
    if (!node || !data) return;
    const current = data.rotation || 0;
    updateNode(node.id, {
      data: { ...data, rotation: (current + degrees + 360) % 360 },
    });
  };

  const handleToggleNote = () => {
    if (!node || !data) return;
    if (data.note !== undefined) {
      // Remove note
      updateNode(node.id, { data: { ...data, note: undefined } });
    } else {
      // Add empty note — triggers the inline editor in ImageNode
      updateNode(node.id, { data: { ...data, note: '' } });
    }
  };

  return (
    <div className="text-toolbar" data-testid="image-toolbar">
      {/* Import button — always visible */}
      <button
        className="text-toolbar__btn"
        onClick={handleImport}
        title="Import image"
        data-testid="image-import-btn"
      >
        <Plus size={16} />
        <span style={{ fontSize: 11, marginLeft: 4 }}>Import</span>
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

      {/* Selected image controls */}
      {node && data && (
        <>
          <div className="text-toolbar__divider" />

          {/* Crop */}
          <button
            className={`text-toolbar__btn ${cropMode ? 'text-toolbar__btn--active' : ''}`}
            onClick={handleCropToggle}
            title={cropMode ? 'Apply crop' : 'Crop image'}
            data-testid="crop-btn"
          >
            <Crop size={16} />
          </button>

          {data.crop && !cropMode && (
            <button
              className="text-toolbar__btn"
              onClick={handleResetCrop}
              title="Reset crop"
              data-testid="reset-crop-btn"
            >
              <RotateCcw size={14} />
            </button>
          )}

          <div className="text-toolbar__divider" />

          {/* Rotate */}
          <button
            className="text-toolbar__btn"
            onClick={() => handleRotate(-90)}
            title="Rotate left (CCW)"
            data-testid="rotate-ccw-btn"
          >
            <RotateCcw size={16} />
          </button>
          <button
            className="text-toolbar__btn"
            onClick={() => handleRotate(90)}
            title="Rotate right (CW)"
            data-testid="rotate-cw-btn"
          >
            <RotateCw size={16} />
          </button>

          <div className="text-toolbar__divider" />

          {/* Note */}
          <button
            className={`text-toolbar__btn ${data.note !== undefined ? 'text-toolbar__btn--active' : ''}`}
            onClick={handleToggleNote}
            title={data.note !== undefined ? 'Remove note' : 'Add note'}
            data-testid="image-note-btn"
          >
            <Type size={16} />
          </button>

          <div className="text-toolbar__divider" />

          {/* Dimensions */}
          <span style={{ fontSize: 11, color: '#94a3b8' }}>
            {Math.round(data.naturalWidth)}x{Math.round(data.naturalHeight)}
            {data.rotation ? ` ${data.rotation}°` : ''}
          </span>
        </>
      )}

      {/* Crop sliders */}
      {cropMode && node && (
        <>
          <div className="text-toolbar__divider" />
          <div className="image-toolbar__crop-controls">
            {(['x', 'y', 'width', 'height'] as const).map((field) => (
              <label key={field} className="image-toolbar__slider">
                <span>{field[0].toUpperCase()}</span>
                <input
                  type="range"
                  min={field === 'width' || field === 'height' ? '0.1' : '0'}
                  max={field === 'width' || field === 'height' ? '1' : '0.9'}
                  step="0.01"
                  value={cropValues[field]}
                  onChange={(e) => handleCropChange(field, parseFloat(e.target.value))}
                  data-testid={`crop-${field}`}
                />
              </label>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
