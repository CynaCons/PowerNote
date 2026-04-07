import { useEffect } from 'react';
import { useCanvasStore } from '../stores/useCanvasStore';
import { useToolStore } from '../stores/useToolStore';
import { useDrawStore } from '../stores/useDrawStore';

/**
 * Hook for all keyboard event handlers on the canvas.
 * Handles: Delete, Escape, T, D, S, E, L shortcuts,
 * Ctrl+Z (undo), Ctrl+Shift+Z/Ctrl+Y (redo),
 * Ctrl+C (copy), Ctrl+V (paste), Ctrl+A (select all).
 */
export function useCanvasKeyboard(
  clearSelection: () => void,
) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      // Delete / Backspace: delete selected nodes
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const store = useCanvasStore.getState();
        if (store.selectedNodeIds.length > 0) {
          e.preventDefault();
          store.deleteSelectedNodes();
        }
      }

      // Escape: clear selection
      if (e.key === 'Escape') {
        clearSelection();
      }

      // T: toggle text tool
      if (e.key === 't' || e.key === 'T') {
        const toolStore = useToolStore.getState();
        toolStore.setTool(toolStore.activeTool === 'text' ? 'select' : 'text');
      }

      // D: toggle draw tool
      if (e.key === 'd' || e.key === 'D') {
        const toolStore = useToolStore.getState();
        toolStore.setTool(toolStore.activeTool === 'draw' ? 'select' : 'draw');
      }

      // S: toggle shape tool
      if (e.key === 's' || e.key === 'S') {
        if (!e.ctrlKey && !e.metaKey) {
          const toolStore = useToolStore.getState();
          toolStore.setTool(toolStore.activeTool === 'shape' ? 'select' : 'shape');
        }
      }

      // E: toggle eraser mode in draw tool
      if (e.key === 'e' || e.key === 'E') {
        const toolStore = useToolStore.getState();
        if (toolStore.activeTool === 'draw') {
          toolStore.setDrawOptions({ isErasing: !toolStore.drawOptions.isErasing });
        } else {
          toolStore.setTool('draw');
          toolStore.setDrawOptions({ isErasing: true });
        }
      }

      // L: toggle lasso
      if (e.key === 'l' || e.key === 'L') {
        const toolStore = useToolStore.getState();
        toolStore.setTool(toolStore.activeTool === 'lasso' ? 'select' : 'lasso');
      }

      // Ctrl+C: copy
      if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        const store = useCanvasStore.getState();
        if (store.selectedNodeIds.length > 0) {
          e.preventDefault();
          store.copySelectedNodes();
        }
      }

      // Ctrl+V: paste internal nodes if clipboard non-empty,
      // otherwise let the browser paste event fire for external images
      if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        if (useCanvasStore.getState().hasClipboard()) {
          e.preventDefault();
          useCanvasStore.getState().pasteNodes();
        }
        // When internal clipboard is empty, don't preventDefault —
        // the browser paste event will fire and useCanvasDragDrop handles images
      }

      // Ctrl+A: select all
      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        e.preventDefault();
        const store = useCanvasStore.getState();
        const allIds = store.nodes.map((n) => n.id);
        useCanvasStore.setState({ selectedNodeIds: allIds });
      }

      // Ctrl+Z: undo (route to draw store if drawing tools active)
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        const tool = useToolStore.getState().activeTool;
        if (tool === 'draw' || tool === 'lasso') {
          useDrawStore.getState().undo();
        } else {
          useCanvasStore.getState().undo();
        }
      }

      // Ctrl+Shift+Z / Ctrl+Y: redo
      if ((e.ctrlKey || e.metaKey) && ((e.key === 'z' && e.shiftKey) || e.key === 'y')) {
        e.preventDefault();
        const tool = useToolStore.getState().activeTool;
        if (tool === 'draw' || tool === 'lasso') {
          useDrawStore.getState().redo();
        } else {
          useCanvasStore.getState().redo();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [clearSelection]);
}
