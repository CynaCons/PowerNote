/**
 * Render tokens for diagrams — the "weighted ink" set chosen 2026-08-13.
 *
 * Style is selected by token, never by colour value from the author, for the
 * same reason `set_background` takes "paper" rather than a hex: a name cannot be
 * got subtly wrong by a digit, and a constrained palette is most of what makes
 * every generated diagram look like it belongs to the same system.
 *
 * The one rule worth stating: TINT is for things that actually exist — parts,
 * components, states. Containers drop to PAPER with a hairline so their children
 * stay the figure. Invert that and a nested diagram reads as one grey mass.
 */

export const INK = '#14181A';
export const MUTED = '#5C6467';
export const FAINT = '#8A9295';
export const RULE = '#C3CBC9';
export const TINT = '#EEF1F0';
export const PAPER = '#FFFFFF';
/** Reserved for faults and error transitions. Never decoration. */
export const ACCENT = '#B4552D';

export const STROKE_ENTITY = 1.6;
export const STROKE_CONTAINER = 1;
export const STROKE_LINK = 1.4;

export const RADIUS_ENTITY = 6;
export const RADIUS_CONTAINER = 8;

export const FONT_NAME = 14;
export const FONT_STEREO = 11;
export const FONT_LABEL = 12;
export const WEIGHT_NAME = 600;

/** Layout metrics, in canvas units. */
export const PAD = 18;
/** Container header: stereotype line plus name line, both clear of the children. */
export const HEADER = 52;
export const GAP = 76;
export const ENTITY_HEIGHT = 66;
export const ENTITY_MIN_WIDTH = 140;
export const PORT_SIZE = 12;
export const BALL_RADIUS = 6;
export const SOCKET_RADIUS = 12;
/** Below this centre-to-centre distance an assembly falls back to a plain link. */
export const ASSEMBLY_MIN_SPAN = 40;
