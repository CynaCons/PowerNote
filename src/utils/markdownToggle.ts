export type FormatKind = 'bold' | 'italic' | 'strike' | 'code' | 'underline';

export interface MarkerPair {
  open: string;
  close: string;
}

export const FORMAT_MARKERS: Record<FormatKind, MarkerPair> = {
  bold: { open: '**', close: '**' },
  italic: { open: '*', close: '*' },
  strike: { open: '~~', close: '~~' },
  code: { open: '`', close: '`' },
  underline: { open: '<u>', close: '</u>' },
};

export interface ToggleResult {
  value: string;
  selStart: number;
  selEnd: number;
}

/**
 * Wrap or unwrap a textarea selection with a marker pair.
 *
 * - Markers immediately outside the selection → unwrap (strip them).
 * - Markers immediately inside the selection → unwrap (strip the inner copies).
 * - Empty selection → insert both markers and place the caret between them.
 * - Otherwise → wrap the selection and re-select the original text.
 */
export function toggleMarker(
  value: string,
  selStart: number,
  selEnd: number,
  marker: MarkerPair,
): ToggleResult {
  const { open, close } = marker;

  if (selStart === selEnd) {
    const before = value.substring(0, selStart);
    const after = value.substring(selStart);
    return {
      value: before + open + close + after,
      selStart: selStart + open.length,
      selEnd: selStart + open.length,
    };
  }

  const outsideOpen = value.substring(Math.max(0, selStart - open.length), selStart);
  const outsideClose = value.substring(selEnd, selEnd + close.length);
  if (outsideOpen === open && outsideClose === close) {
    const before = value.substring(0, selStart - open.length);
    const selected = value.substring(selStart, selEnd);
    const after = value.substring(selEnd + close.length);
    return {
      value: before + selected + after,
      selStart: selStart - open.length,
      selEnd: selEnd - open.length,
    };
  }

  const selected = value.substring(selStart, selEnd);
  if (
    selected.length >= open.length + close.length &&
    selected.startsWith(open) &&
    selected.endsWith(close)
  ) {
    const inner = selected.substring(open.length, selected.length - close.length);
    const before = value.substring(0, selStart);
    const after = value.substring(selEnd);
    return {
      value: before + inner + after,
      selStart,
      selEnd: selStart + inner.length,
    };
  }

  const before = value.substring(0, selStart);
  const after = value.substring(selEnd);
  return {
    value: before + open + selected + close + after,
    selStart: selStart + open.length,
    selEnd: selEnd + open.length,
  };
}
