/**
 * Variable-width ink rendering (REQ-DRAW-011).
 *
 * A pressure stroke cannot be a Konva Line — Line has ONE strokeWidth. So a
 * pen stroke is drawn as a closed filled ribbon instead: for every recorded
 * point, offset perpendicular to the local direction by half the local width,
 * walk the left rim forward and the right rim back, and fill the polygon.
 *
 * The width mapping is anchored so pressure 0.5 reproduces the picked stroke
 * width exactly — a mouse reports 0.5 while its button is down, so a pen held
 * at middling pressure and a mouse stroke of the same setting look identical.
 */

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

/** Half-width in canvas px for one point: 0.3×..1.7× the base width. */
function halfWidth(pressure: number, baseWidth: number): number {
  const factor = 0.3 + 1.4 * clamp(pressure, 0, 1);
  return Math.max(0.35, (baseWidth * factor) / 2);
}

/**
 * Build the closed outline polygon for a pressure stroke.
 *
 * `points` is the flat [x1,y1,...] centreline, `pressures` one value per
 * point. Returns flat outline points for a closed Konva Line, or null when
 * the input cannot make a ribbon (fewer than 2 distinct points, or a
 * pressure array that does not match — callers then fall back to the
 * constant-width Line).
 */
export function buildInkOutline(
  points: number[],
  pressures: number[],
  baseWidth: number,
): number[] | null {
  const n = points.length / 2;
  if (n < 2 || pressures.length !== n) return null;

  // 3-tap moving average keeps digitizer pressure jitter out of the rim
  // without visibly lagging real pressure changes.
  const smooth: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const a = pressures[Math.max(0, i - 1)];
    const b = pressures[i];
    const c = pressures[Math.min(n - 1, i + 1)];
    smooth[i] = (a + b + c) / 3;
  }

  const left: number[] = [];
  const right: number[] = [];
  for (let i = 0; i < n; i++) {
    const px = points[2 * i];
    const py = points[2 * i + 1];
    // Central difference gives each point the direction of the curve through
    // it rather than of one adjacent segment, which keeps the rim smooth.
    const ix = Math.max(0, i - 1);
    const ax = Math.min(n - 1, i + 1);
    let dx = points[2 * ax] - points[2 * ix];
    let dy = points[2 * ax + 1] - points[2 * ix + 1];
    const len = Math.hypot(dx, dy);
    if (len < 1e-6) {
      // Degenerate (repeated point): reuse the previous normal via a zero
      // offset direction — the neighbouring points carry the rim through.
      dx = 1;
      dy = 0;
    } else {
      dx /= len;
      dy /= len;
    }
    const nx = -dy;
    const ny = dx;
    const hw = halfWidth(smooth[i], baseWidth);
    left.push(px + nx * hw, py + ny * hw);
    right.push(px - nx * hw, py - ny * hw);
  }

  const outline = left;
  for (let i = n - 1; i >= 0; i--) {
    outline.push(right[2 * i], right[2 * i + 1]);
  }
  return outline;
}
