import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

interface PopoverPortalProps {
  open: boolean;
  anchorRef: React.RefObject<HTMLElement | null>;
  onClose: () => void;
  className?: string;
  testId?: string;
  children: React.ReactNode;
}

// Gap between the trigger button and the panel above it — matches the old
// `bottom: calc(100% + 8px)` CSS offset this component replaces.
const GAP = 8;
// Minimum breathing room from the viewport edge so the panel never touches it.
const VIEWPORT_MARGIN = 8;

/**
 * Renders popover content into document.body via a portal, positioned with
 * `position: fixed` anchored to the trigger element's bounding rect.
 *
 * Why a portal instead of `position: absolute` inside the toolbar: the
 * toolbar (.bottom-toolbar) needs `overflow-x: auto` so it can scroll on
 * narrow/mobile screens without spilling off the viewport, but overflow
 * clips any absolutely-positioned descendant too — including these
 * popovers. Portaling to <body> and positioning independently via
 * getBoundingClientRect() means the toolbar's overflow can never clip them,
 * regardless of viewport width.
 */
export function PopoverPortal({ open, anchorRef, onClose, className, testId, children }: PopoverPortalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<React.CSSProperties | null>(null);

  useLayoutEffect(() => {
    if (!open) {
      setStyle(null);
      return;
    }

    const place = () => {
      const anchor = anchorRef.current;
      const panel = panelRef.current;
      if (!anchor) return;

      const anchorRect = anchor.getBoundingClientRect();
      const panelWidth = panel?.offsetWidth ?? 200;

      // Centered above the trigger, clamped so it never crosses either
      // viewport edge (this is what keeps it fully visible on narrow screens).
      let left = anchorRect.left + anchorRect.width / 2 - panelWidth / 2;
      left = Math.max(VIEWPORT_MARGIN, Math.min(left, window.innerWidth - panelWidth - VIEWPORT_MARGIN));

      const bottom = window.innerHeight - anchorRect.top + GAP;

      setStyle({
        position: 'fixed',
        left: `${left}px`,
        bottom: `${bottom}px`,
        transform: 'none',
        zIndex: 1000,
      });
    };

    place();
    // The panel has no measured width on the very first layout pass (it just
    // mounted) — re-measure once more after paint so centering is exact.
    const raf = requestAnimationFrame(place);
    window.addEventListener('resize', place);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', place);
    };
  }, [open, anchorRef]);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (panelRef.current?.contains(target)) return;
      if (anchorRef.current?.contains(target)) return;
      onClose();
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open, onClose, anchorRef]);

  if (!open) return null;

  return createPortal(
    <div
      ref={panelRef}
      className={className}
      data-testid={testId}
      style={style ?? { position: 'fixed', top: '-9999px', left: '-9999px' }}
    >
      {children}
    </div>,
    document.body,
  );
}
