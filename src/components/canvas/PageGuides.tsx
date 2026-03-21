import { Rect, Line } from 'react-konva';

// A4 at 96 DPI
const A4_WIDTH = 794;
const A4_HEIGHT = 1123;
const PAGE_GAP = 40;
const PAGE_COUNT = 5; // render 5 pages vertically
const MARGIN = 60; // left margin offset to center-ish on canvas

interface PageGuidesProps {
  visible: boolean;
}

export function PageGuides({ visible }: PageGuidesProps) {
  if (!visible) return null;

  const pages = [];
  for (let i = 0; i < PAGE_COUNT; i++) {
    const y = i * (A4_HEIGHT + PAGE_GAP);
    pages.push(
      <Rect
        key={`page-bg-${i}`}
        x={MARGIN}
        y={y}
        width={A4_WIDTH}
        height={A4_HEIGHT}
        fill="#ffffff"
        shadowColor="rgba(0,0,0,0.08)"
        shadowBlur={8}
        shadowOffsetY={2}
        cornerRadius={2}
        listening={false}
      />,
      // Top border
      <Line
        key={`page-top-${i}`}
        points={[MARGIN, y, MARGIN + A4_WIDTH, y]}
        stroke="#d4d4d4"
        strokeWidth={0.5}
        dash={[6, 4]}
        listening={false}
      />,
      // Bottom border
      <Line
        key={`page-bottom-${i}`}
        points={[MARGIN, y + A4_HEIGHT, MARGIN + A4_WIDTH, y + A4_HEIGHT]}
        stroke="#d4d4d4"
        strokeWidth={0.5}
        dash={[6, 4]}
        listening={false}
      />,
      // Left border
      <Line
        key={`page-left-${i}`}
        points={[MARGIN, y, MARGIN, y + A4_HEIGHT]}
        stroke="#d4d4d4"
        strokeWidth={0.5}
        dash={[6, 4]}
        listening={false}
      />,
      // Right border
      <Line
        key={`page-right-${i}`}
        points={[MARGIN + A4_WIDTH, y, MARGIN + A4_WIDTH, y + A4_HEIGHT]}
        stroke="#d4d4d4"
        strokeWidth={0.5}
        dash={[6, 4]}
        listening={false}
      />,
    );
  }

  return <>{pages}</>;
}
