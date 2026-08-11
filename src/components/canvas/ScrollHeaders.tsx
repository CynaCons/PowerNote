import { useEffect, useRef, useState } from 'react';
import { Group, Line, Text } from 'react-konva';
import { Html } from 'react-konva-utils';
import type { BackgroundMode, ScrollRecord } from '../../types/data';
import { A4_WIDTH, SCROLL_HEADER_HEIGHT, columnLeft } from '../../utils/pageLayout';
import { renameScroll } from '../../utils/scrollOps';
import { useWorkspaceStore } from '../../stores/useWorkspaceStore';

interface ScrollHeadersProps {
  mode: BackgroundMode;
  scrolls: ScrollRecord[];
  pageId: string;
}

const TITLE_INSET = 16;

/**
 * Scroll titles drawn at the top of each column band — the user-facing half of
 * scroll identity, and the "top-level start" a scroll is measured from.
 *
 * Drawn as canvas chrome rather than as text nodes on purpose: a title is not
 * content. As a node it would be selectable, draggable, deletable, and would
 * show up in `read_page` as the scroll's first block, which is exactly wrong
 * for something an agent uses to identify where to write.
 *
 * Untitled scrolls draw nothing. Every pre-v0.31 page gets backfilled records,
 * so drawing a placeholder for each would put a header on every page of every
 * existing notebook — a name is something you choose, not something you inherit.
 */
export function ScrollHeaders({ mode, scrolls, pageId }: ScrollHeadersProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const activeScrollId = useWorkspaceStore((s) => s.activeScrollId);
  const setActiveScroll = useWorkspaceStore((s) => s.setActiveScroll);

  // Stop editing if the scroll disappears (page switch, delete) — the overlay
  // would otherwise hang over an empty band.
  useEffect(() => {
    if (editingId && !scrolls.some((s) => s.id === editingId)) setEditingId(null);
  }, [editingId, scrolls]);

  useEffect(() => {
    if (editingId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingId]);

  // Bands only exist in the two page-guide modes. In grid/none there is no
  // column to title, so the record stays but the header is not drawn.
  if (mode !== 'scroll' && mode !== 'pages') return null;

  const commit = (scroll: ScrollRecord) => {
    const value = inputRef.current?.value.trim();
    if (value !== undefined && value !== scroll.title) {
      renameScroll(pageId, scroll.id, value);
    }
    setEditingId(null);
  };

  return (
    <Group>
      {scrolls.map((scroll) => {
        const x = columnLeft(scroll.column);
        const isEditing = editingId === scroll.id;

        if (isEditing) {
          return (
            <Html
              key={`scroll-edit-${scroll.id}`}
              groupProps={{ x: x + TITLE_INSET, y: 8 }}
              divProps={{ style: { pointerEvents: 'auto' } }}
            >
              <input
                ref={inputRef}
                className="scroll-header__input"
                defaultValue={scroll.title}
                data-testid="scroll-rename-input"
                style={{ width: A4_WIDTH - TITLE_INSET * 2 }}
                onBlur={() => commit(scroll)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commit(scroll);
                  if (e.key === 'Escape') setEditingId(null);
                  e.stopPropagation();
                }}
              />
            </Html>
          );
        }

        if (!scroll.title) return null;

        const isActive = activeScrollId === scroll.id;

        return (
          <Group
            key={`scroll-header-${scroll.id}`}
            onDblClick={() => setEditingId(scroll.id)}
            // Single click makes it the scroll the outline follows. It does not
            // move the viewport — you are already looking at it.
            onClick={() => setActiveScroll(scroll.id)}
            onTap={() => setActiveScroll(scroll.id)}
          >
            {/* No id() on these nodes: useTextPlacement treats an unidentified
                target as background, so a single click still places text or
                clears selection straight through the header. */}
            <Text
              x={x + TITLE_INSET}
              y={12}
              width={A4_WIDTH - TITLE_INSET * 2}
              text={scroll.title}
              fontSize={15}
              fontFamily="Inter, system-ui, sans-serif"
              fill={isActive ? '#2563eb' : '#64748b'}
              ellipsis
              wrap="none"
            />
            <Line
              points={[x, SCROLL_HEADER_HEIGHT, x + A4_WIDTH, SCROLL_HEADER_HEIGHT]}
              stroke={isActive ? '#bfdbfe' : '#e2e2e2'}
              strokeWidth={1}
              listening={false}
            />
          </Group>
        );
      })}
    </Group>
  );
}
