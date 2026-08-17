import { useEffect, useState } from 'react';
import { useCanvasStore } from '../../stores/useCanvasStore';
import { useDiagramStore } from '../../stores/useDiagramStore';
import { applyDiagramScrollFit, diagramMembers, diagramSourceOf, rebuildDiagram } from '../../diagram/canvasOps';
import { sniffFormat, type Diagnostic } from '../../diagram';
import { FORMAT_LABEL } from '../../diagram/formatLabels';
import type { DiagramNodeData } from '../../types/data';
import './DiagramNode.css';

/**
 * The source behind a diagram, shown over the canvas.
 *
 * Plain DOM, rendered as a sibling of the Konva Stage rather than inside a node,
 * because a react-konva subtree is reconciled by Konva's renderer and HTML
 * children there throw. Redrawing replaces the frame's contents in place and
 * refits the frame; a source that parses to nothing leaves the drawing alone.
 *
 * No format is passed to the redraw: the grammar follows whatever the user has
 * typed, so pasting Mermaid over PlantUML works rather than fighting the
 * language the frame was first created from.
 */
export function DiagramSourceDialog() {
  const editingId = useDiagramStore((s) => s.editingId);
  const closeSource = useDiagramStore((s) => s.closeSource);
  const [draft, setDraft] = useState('');
  const [diagnostics, setDiagnostics] = useState<Diagnostic[]>([]);

  useEffect(() => {
    if (!editingId) return;
    const frame = useCanvasStore.getState().nodes.find((n) => n.id === editingId);
    setDraft(frame ? diagramSourceOf(frame) : '');
    setDiagnostics([]);
  }, [editingId]);

  useEffect(() => {
    if (!editingId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeSource();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [editingId, closeSource]);

  if (!editingId) return null;

  const redraw = () => {
    const canvas = useCanvasStore.getState();
    const frame = canvas.nodes.find((n) => n.id === editingId);
    if (!frame) return;

    const result = applyDiagramScrollFit(frame, rebuildDiagram(frame, draft));
    const notes = result.warning
      ? [...result.diagnostics, { line: 0, severity: 'ignored' as const, message: result.warning }]
      : result.diagnostics;
    setDiagnostics(notes);
    if (result.contents.length === 0) return;

    for (const member of diagramMembers(canvas.nodes, editingId)) canvas.deleteNode(member.id);
    for (const content of result.contents) useCanvasStore.getState().addNode(content);
    useCanvasStore.getState().updateNode(editingId, {
      width: result.frame.width,
      height: result.frame.height,
      data: { ...(frame.data as DiagramNodeData), source: draft },
    });
  };

  const errors = diagnostics.filter((d) => d.severity === 'error').length;
  const draftFormat = sniffFormat(draft);

  return (
    <div className="diagram-modal-backdrop" onClick={closeSource}>
      <div
        className="diagram-modal"
        role="dialog"
        aria-label="Diagram source"
        data-testid="diagram-dialog"
        onClick={(e) => e.stopPropagation()}
      >
        <header>
          {/* Named from the DRAFT, not the saved source, so pasting one language
              over another shows what Redraw is about to do before you commit. */}
          <span data-testid="diagram-dialog-format" data-format={draftFormat}>
            {FORMAT_LABEL[draftFormat]} source
          </span>
          <button type="button" onClick={closeSource} aria-label="Close">
            ×
          </button>
        </header>

        <textarea
          value={draft}
          spellCheck={false}
          data-testid="diagram-source"
          onChange={(e) => setDraft(e.target.value)}
        />

        {diagnostics.length > 0 && (
          <ul className="diagram-diags" data-testid="diagram-diagnostics">
            {diagnostics.map((d, i) => (
              <li key={i} className={d.severity}>
                <span>{d.line ? `line ${d.line}` : '—'}</span>
                {d.message}
              </li>
            ))}
          </ul>
        )}

        <footer>
          <span className="diagram-count">
            {diagnostics.length === 0
              ? 'Every line understood.'
              : `${diagnostics.length} note${diagnostics.length === 1 ? '' : 's'}, ${errors} error${errors === 1 ? '' : 's'}`}
          </span>
          <button type="button" className="primary" data-testid="diagram-apply" onClick={redraw}>
            Redraw
          </button>
        </footer>
      </div>
    </div>
  );
}
