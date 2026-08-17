import { useEffect, useRef, useState } from 'react';
import { Group, Line, Rect, Text } from 'react-konva';
import { Html } from 'react-konva-utils';
import type { BackgroundMode, ScrollRecord } from '../../types/data';
import {
  SCROLL_HEADER_HEIGHT,
  SCROLL_TITLE_FONT_STYLE,
  SCROLL_TITLE_HAIRLINE,
  SCROLL_TITLE_HAIRLINE_WIDTH,
  SCROLL_TITLE_INK,
  SCROLL_TITLE_PINNED_FILL,
  SCROLL_TITLE_PINNED_FONT_SIZE,
  SCROLL_TITLE_PINNED_OPACITY,
  SCROLL_TITLE_PINNED_STRIP_HEIGHT,
  SCROLL_TITLE_PIN_INSET,
  SCROLL_TITLE_RESTING_FONT_SIZE,
  columnLeft,
  columnWidth,
  scrollTitleY,
} from '../../utils/pageLayout';
import { pageCeiling } from '../../utils/scrollCeiling';
import { fitScrollToContent, moveScroll, renameScroll } from '../../utils/scrollOps';
import { useWorkspaceStore } from '../../stores/useWorkspaceStore';
import { useCanvasStore } from '../../stores/useCanvasStore';
import { useDrawStore } from '../../stores/useDrawStore';
import './ContextMenu.css';

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
  const [menu, setMenu] = useState<{ scrollId: string; x: number; y: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const setActiveScroll = useWorkspaceStore((s) => s.setActiveScroll);
  // Pinning is a function of where the viewport is, so the header has to follow
  // it rather than sit at a fixed canvas y.
  const viewport = useCanvasStore((s) => s.viewport);
  const nodes = useCanvasStore((s) => s.nodes);
  const strokes = useDrawStore((s) => s.strokes);
  const ceiling = pageCeiling(nodes, strokes, scrolls);

  // Stop editing if the scroll disappears (page switch, delete) — the overlay
  // would otherwise hang over an empty band.
  useEffect(() => {
    if (editingId && !scrolls.some((s) => s.id === editingId)) setEditingId(null);
    if (menu && !scrolls.some((s) => s.id === menu.scrollId)) setMenu(null);
  }, [editingId, menu, scrolls]);

  useEffect(() => {
    if (!menu) return;
    const close = (e: MouseEvent) => {
      const t = e.target;
      if (t instanceof Element && t.closest('[data-testid="scroll-header-menu"]')) return;
      setMenu(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenu(null);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', onKey);
    };
  }, [menu]);

  useEffect(() => {
    if (editingId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingId]);

  // Bands only exist in the two page-guide modes. In grid/none there is no
  // column to title, so the record stays but the header is not drawn.
  if (mode !== 'scroll' && mode !== 'pages') return null;

  const orderedScrolls = [...scrolls].sort((a, b) => a.column - b.column);
  const menuIndex = menu ? orderedScrolls.findIndex((s) => s.id === menu.scrollId) : -1;
  const menuAtLeft = menuIndex <= 0;
  const menuAtRight = menuIndex < 0 || menuIndex >= orderedScrolls.length - 1;

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
        const x = columnLeft(scroll.column, scrolls);
        const bandW = columnWidth(scroll.column, scrolls);
        const isEditing = editingId === scroll.id;

        const { y: pinnedY, holding: isHolding } = scrollTitleY(viewport, ceiling);
        const stripY = pinnedY - SCROLL_TITLE_PIN_INSET;
        const stripH = isHolding ? SCROLL_TITLE_PINNED_STRIP_HEIGHT : SCROLL_HEADER_HEIGHT;
        const fontSize = isHolding ? SCROLL_TITLE_PINNED_FONT_SIZE : SCROLL_TITLE_RESTING_FONT_SIZE;
        // Resting text stays at the ceiling y (T150). Pinned text is centred
        // in the compact strip so the overlay reads as a 22px wayfinding bar.
        const textY = isHolding ? stripY + (stripH - fontSize) / 2 : pinnedY;

        if (isEditing) {
          return (
            <Html
              key={`scroll-edit-${scroll.id}`}
              groupProps={{ x: x + TITLE_INSET, y: textY }}
              divProps={{ style: { pointerEvents: 'auto' } }}
            >
              <input
                ref={inputRef}
                className="scroll-header__input"
                defaultValue={scroll.title}
                data-testid="scroll-rename-input"
                style={{
                  width: bandW - TITLE_INSET * 2,
                  fontSize,
                  fontWeight: 600,
                  color: SCROLL_TITLE_INK,
                }}
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

        return (
          <Group
            key={`scroll-header-${scroll.id}`}
            onDblClick={() => setEditingId(scroll.id)}
            onDblTap={() => setEditingId(scroll.id)}
            // Single click makes it the scroll the outline follows. It does not
            // move the viewport — you are already looking at it.
            onClick={() => setActiveScroll(scroll.id)}
            onTap={() => setActiveScroll(scroll.id)}
            onContextMenu={(e) => {
              e.cancelBubble = true;
              e.evt.preventDefault();
              e.evt.stopPropagation();
              setActiveScroll(scroll.id);
              setMenu({ scrollId: scroll.id, x: e.evt.clientX, y: e.evt.clientY });
            }}
          >
            {/* No id() on these nodes: useTextPlacement treats an unidentified
                target as background, so a single click still places text or
                clears selection straight through the header. */}
            {/* Backing so a held title reads over the content passing beneath.
                Only while holding — at rest the canvas already provides it.
                Konva nodes stay the test/hit contract (T152). Markdown blocks
                render as Html on top of the Stage, so the visible strip is a
                matching Html overlay — otherwise body text paints through. */}
            {isHolding && (
              <Rect
                name="scroll-title-backing"
                x={x}
                y={stripY}
                width={bandW}
                height={stripH}
                fill={SCROLL_TITLE_PINNED_FILL}
                opacity={SCROLL_TITLE_PINNED_OPACITY}
                listening={false}
              />
            )}
            <Rect
              name="scroll-title-hit"
              x={x}
              y={isHolding ? stripY : pinnedY - SCROLL_TITLE_PIN_INSET}
              width={bandW}
              height={stripH}
              fill="transparent"
            />
            <Text
              name="scroll-title-text"
              x={x + TITLE_INSET}
              y={textY}
              width={bandW - TITLE_INSET * 2}
              text={scroll.title}
              fontSize={fontSize}
              fontStyle={SCROLL_TITLE_FONT_STYLE}
              fontFamily="Inter, system-ui, sans-serif"
              fill={SCROLL_TITLE_INK}
              ellipsis
              wrap="none"
              opacity={isHolding ? 0 : 1}
            />
            {isHolding && (
              <Line
                name="scroll-title-hairline"
                points={[x, stripY + stripH, x + bandW, stripY + stripH]}
                stroke={SCROLL_TITLE_HAIRLINE}
                strokeWidth={SCROLL_TITLE_HAIRLINE_WIDTH}
                listening={false}
              />
            )}
            {isHolding && (
              <Html
                groupProps={{ x, y: stripY }}
                divProps={{ style: { pointerEvents: 'auto' } }}
              >
                <div
                  data-testid="scroll-title-strip"
                  onDoubleClick={() => setEditingId(scroll.id)}
                  onClick={() => setActiveScroll(scroll.id)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setActiveScroll(scroll.id);
                    setMenu({ scrollId: scroll.id, x: e.clientX, y: e.clientY });
                  }}
                  style={{
                    width: bandW,
                    height: stripH,
                    boxSizing: 'border-box',
                    background: `rgba(255, 255, 255, ${SCROLL_TITLE_PINNED_OPACITY})`,
                    borderBottom: `${SCROLL_TITLE_HAIRLINE_WIDTH}px solid ${SCROLL_TITLE_HAIRLINE}`,
                    display: 'flex',
                    alignItems: 'center',
                    padding: `0 ${TITLE_INSET}px`,
                    fontSize,
                    fontWeight: 600,
                    fontFamily: 'Inter, system-ui, sans-serif',
                    color: SCROLL_TITLE_INK,
                    overflow: 'hidden',
                    whiteSpace: 'nowrap',
                    textOverflow: 'ellipsis',
                    lineHeight: 1,
                  }}
                >
                  {scroll.title}
                </div>
              </Html>
            )}
          </Group>
        );
      })}
      {menu && (
        <Html
          groupProps={{ x: 0, y: 0 }}
          divProps={{ style: { pointerEvents: 'auto' } }}
        >
          <div
            className="context-menu"
            data-testid="scroll-header-menu"
            style={{ position: 'fixed', left: menu.x, top: menu.y, zIndex: 100 }}
          >
            <button
              type="button"
              className="context-menu__item"
              data-testid="move-scroll-left"
              disabled={menuAtLeft}
              onClick={() => {
                moveScroll(pageId, menu.scrollId, { direction: 'left' });
                setMenu(null);
              }}
            >
              Move left
            </button>
            <button
              type="button"
              className="context-menu__item"
              data-testid="move-scroll-right"
              disabled={menuAtRight}
              onClick={() => {
                moveScroll(pageId, menu.scrollId, { direction: 'right' });
                setMenu(null);
              }}
            >
              Move right
            </button>
            <button
              type="button"
              className="context-menu__item"
              data-testid="fit-scroll-to-content"
              onClick={() => {
                fitScrollToContent(pageId, menu.scrollId);
                setMenu(null);
              }}
            >
              Fit scroll to content
            </button>
          </div>
        </Html>
      )}
    </Group>
  );
}
