import { useEffect, useRef, useState } from 'react';
import { undoBatchEnd, undoBatchStart, useCanvasStore } from '../../stores/useCanvasStore';
import { useDiagramStore } from '../../stores/useDiagramStore';
import { useWorkspaceStore } from '../../stores/useWorkspaceStore';
import {
  FRAME_MIN_H,
  FRAME_MIN_W,
  FRAME_PAD,
  FRAME_TITLE_H,
  applyDiagramScrollFit,
  diagramMembers,
  diagramSourceOf,
  rebuildDiagram,
} from '../../diagram/canvasOps';
import { fitFrameToScroll } from '../../diagram/fitToScroll';
import { renderDrawioSnapshot } from '../../diagram/drawioRender';
import { sniffFormat, normalizeDrawioSource, type Diagnostic } from '../../diagram';
import { FORMAT_LABEL } from '../../diagram/formatLabels';
import type { CanvasNode, DiagramNodeData } from '../../types/data';
import { useDrawStore } from '../../stores/useDrawStore';
import { livePageLike } from '../../utils/columnReflow';
import { planHeightChange } from '../../bridge/reflow';
import './DiagramNode.css';

/**
 * Column reflow after the frame's height changed under the dialog. Shared by
 * the member and snapshot commit paths so they cannot drift.
 */
function reflowFrameHeight(frameId: string, oldHeight: number, width: number, height: number): void {
  if (Math.abs(height - oldHeight) < 2) return;
  const page = livePageLike();
  const planned = planHeightChange(
    {
      ...page,
      nodes: page.nodes.map((n) => (n.id === frameId ? { ...n, height: oldHeight } : n)),
    },
    frameId,
    height,
  );
  if (planned.ok && planned.dy !== 0) {
    useCanvasStore.setState({
      nodes: planned.nextNodes.map((n) => (n.id === frameId ? { ...n, height, width } : n)),
    });
    useDrawStore.setState({ strokes: planned.nextStrokes });
  }
}

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
  const [pending, setPending] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

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

  /** Member (transpile) commit — the pre-v0.64 path, now also clearing any
   *  snapshot: pasting PlantUML over a drawio render must not leave the old
   *  image behind the new members. One undo restores everything. */
  const commitMembers = (frame: CanvasNode, extraNotes: Diagnostic[]) => {
    const canvas = useCanvasStore.getState();
    const result = applyDiagramScrollFit(frame, rebuildDiagram(frame, draft));
    const notes = result.warning
      ? [...result.diagnostics, { line: 0, severity: 'ignored' as const, message: result.warning }]
      : result.diagnostics;
    setDiagnostics([...extraNotes, ...notes]);
    if (result.contents.length === 0) return;

    const oldHeight = frame.height;
    undoBatchStart(canvas.nodes);
    for (const member of diagramMembers(canvas.nodes, editingId!)) canvas.deleteNode(member.id);
    for (const content of result.contents) useCanvasStore.getState().addNode(content);
    const { render: _render, ...dataRest } = frame.data as DiagramNodeData;
    useCanvasStore.getState().updateNode(editingId!, {
      width: result.frame.width,
      height: result.frame.height,
      data: { ...dataRest, source: draft },
    });
    reflowFrameHeight(editingId!, oldHeight, result.frame.width, result.frame.height);
    undoBatchEnd();
  };

  const redraw = async () => {
    if (pending) return;
    const frame0 = useCanvasStore.getState().nodes.find((n) => n.id === editingId);
    if (!frame0) return;

    if (sniffFormat(draft) !== 'drawio') {
      commitMembers(frame0, []);
      return;
    }

    // drawio: exact snapshot by default, transpile as the fallback.
    setPending(true);
    let rendered: Awaited<ReturnType<typeof renderDrawioSnapshot>>;
    try {
      rendered = await renderDrawioSnapshot(draft);
    } finally {
      setPending(false);
    }
    // The render awaited the viewer — the frame may be gone by now (deleted,
    // page switched). Re-fetch by id and abort rather than resurrect it.
    const canvas = useCanvasStore.getState();
    const frame = canvas.nodes.find((n) => n.id === editingId);
    if (!frame) return;

    if (!rendered.ok) {
      commitMembers(frame, [
        {
          line: 0,
          severity: 'ignored',
          message: `draw.io renderer unavailable (${rendered.reason}) — drawn with the built-in converter.`,
        },
      ]);
      return;
    }

    const snapshot = rendered.snapshot;
    const width = Math.max(FRAME_MIN_W, Math.round(snapshot.naturalWidth + FRAME_PAD * 2));
    const height = Math.max(
      FRAME_MIN_H,
      Math.round(snapshot.naturalHeight + FRAME_TITLE_H + FRAME_PAD * 2),
    );
    const scrolls = useWorkspaceStore.getState().getActivePage()?.scrolls;
    const fitted = fitFrameToScroll({ x: frame.x, y: frame.y, width, height }, scrolls);
    setDiagnostics(
      fitted.warning ? [{ line: 0, severity: 'ignored', message: fitted.warning }] : [],
    );

    const oldHeight = frame.height;
    undoBatchStart(canvas.nodes);
    for (const member of diagramMembers(canvas.nodes, editingId!)) canvas.deleteNode(member.id);
    const nextW = Math.round(fitted.width);
    const nextH = Math.round(fitted.height);
    useCanvasStore.getState().updateNode(editingId!, {
      width: nextW,
      height: nextH,
      data: { ...(frame.data as DiagramNodeData), source: draft, render: snapshot },
    });
    reflowFrameHeight(editingId!, oldHeight, nextW, nextH);
    undoBatchEnd();
  };

  const errors = diagnostics.filter((d) => d.severity === 'error').length;
  const notes = diagnostics.filter((d) => d.severity !== 'error').length;
  const draftFormat = sniffFormat(draft);
  const shownDiags = diagnostics.slice(0, 8);
  const hiddenDiags = diagnostics.length - shownDiags.length;

  const openFile = async (file: File) => {
    const raw = await file.text();
    const next = draftFormat === 'drawio' || /\.drawio(\.xml)?$/i.test(file.name) || /\.dio$/i.test(file.name)
      ? await normalizeDrawioSource(raw)
      : raw;
    setDraft(next);
    setDiagnostics([]);
  };

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

        {draftFormat === 'drawio' && (
          <p className="diagram-hint" data-testid="diagram-drawio-hint">
            Paste XML from diagrams.net, or open a .drawio file. Redraw renders it
            exactly with the draw.io viewer; without the viewer it falls back to
            the built-in converter.
          </p>
        )}

        <textarea
          value={draft}
          spellCheck={false}
          data-testid="diagram-source"
          onChange={(e) => setDraft(e.target.value)}
        />

        {diagnostics.length > 0 && (
          <ul className="diagram-diags" data-testid="diagram-diagnostics">
            {shownDiags.map((d, i) => (
              <li key={i} className={d.severity}>
                <span>{d.line ? `line ${d.line}` : '—'}</span>
                {d.message}
              </li>
            ))}
            {hiddenDiags > 0 && (
              <li className="more">+{hiddenDiags} more</li>
            )}
          </ul>
        )}

        <footer>
          <span className="diagram-count">
            {diagnostics.length === 0
              ? 'Every line understood.'
              : `${notes} note${notes === 1 ? '' : 's'}, ${errors} skipped`}
          </span>
          <div>
            <input
              ref={fileRef}
              type="file"
              accept=".drawio,.dio,.xml,.svg,.drawio.xml,application/xml,text/xml,text/plain"
              hidden
              data-testid="diagram-open-file"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (file) void openFile(file);
              }}
            />
            <button
              type="button"
              data-testid="diagram-open-file-btn"
              onClick={() => fileRef.current?.click()}
            >
              Open file
            </button>
            <button
              type="button"
              className="primary"
              data-testid="diagram-apply"
              data-pending={pending ? 'true' : undefined}
              disabled={pending}
              onClick={() => void redraw()}
            >
              {pending ? 'Rendering…' : 'Redraw'}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
