import { useMemo } from 'react';
import { useCanvasStore } from '../../stores/useCanvasStore';
import { useWorkspaceStore } from '../../stores/useWorkspaceStore';
import { deriveOutline, groupOutline, type OutlineEntry } from '../../utils/outline';
import { focusHeading } from '../../utils/viewportFocus';

/**
 * Document outline for the ACTIVE SCROLL, rendered inside the sidebar.
 *
 * Derived from the markdown on the canvas rather than stored, so it cannot go
 * stale. Living in the sidebar rather than floating over the canvas means it
 * never covers the content it describes, and it inherits the panel's
 * user-controlled width — which is what makes long headings readable.
 *
 * Scoped to one scroll rather than the whole page: a page with parallel
 * workstreams would otherwise produce one interleaved list covering several
 * unrelated documents, which is not an outline of anything.
 */
export function OutlineTab() {
  const nodes = useCanvasStore((s) => s.nodes);
  // Subscribing to the id rather than calling getActiveScroll() keeps this
  // re-rendering when the active scroll changes.
  const activeScrollId = useWorkspaceStore((s) => s.activeScrollId);
  const scrolls = useWorkspaceStore(
    (s) =>
      s.workspace.sections
        .find((sec) => sec.id === s.activeSectionId)
        ?.pages.find((p) => p.id === s.activePageId)?.scrolls,
  );

  const active = useMemo(() => {
    if (!scrolls || scrolls.length === 0) return undefined;
    return (
      (activeScrollId ? scrolls.find((s) => s.id === activeScrollId) : undefined) ??
      [...scrolls].sort((a, b) => a.column - b.column)[0]
    );
  }, [scrolls, activeScrollId]);

  // Each entry costs a DOM measure, so recompute only when content changes.
  const entries = useMemo(() => {
    if (!active) return [];
    const groups = groupOutline(deriveOutline(nodes), scrolls);
    return groups.find((g) => g.column === active.column)?.entries ?? [];
  }, [nodes, scrolls, active]);

  const jumpTo = (entry: OutlineEntry) => focusHeading(entry.x, entry.y);

  if (entries.length === 0) {
    return (
      <div className="outline-tab__empty" data-testid="outline-empty">
        {active?.title ? (
          <>
            No headings in <strong>{active.title}</strong> yet. Start a block with{' '}
            <code># </code> or <code>## </code> and it will appear here.
          </>
        ) : (
          <>
            No headings on this page yet. Start a block with <code># </code> or <code>## </code> and
            it will appear here.
          </>
        )}
      </div>
    );
  }

  return (
    <div className="outline-tab" data-testid="outline-tab">
      {/* The outline covers ONE scroll, so its name is a heading for the list
          rather than a group label among several. */}
      {active?.title && (
        <div className="outline-tab__scope" data-testid="outline-scope">
          {active.title}
        </div>
      )}
      {entries.map((entry) => (
        <button
          key={entry.id}
          className={`outline-tab__item outline-tab__item--h${entry.level}`}
          onClick={() => jumpTo(entry)}
          data-testid="outline-item"
          data-level={entry.level}
          title={entry.text}
        >
          {entry.text}
        </button>
      ))}
    </div>
  );
}
