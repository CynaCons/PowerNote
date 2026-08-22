/**
 * PlantUML activity diagrams with swimlanes.
 *
 * A second grammar, not an extension of the component one: PlantUML's activity
 * syntax is a different language (`start`, `:action;`, `if/then/else`, `|Lane|`)
 * and mixing the two parsers would make both worse. `buildDiagram` sniffs which
 * one a source is and routes accordingly.
 *
 * A swimlane is a flowchart plus a partition. The flow runs top to bottom; the
 * lane a step belongs to fixes its x. That is the whole layout — no graph engine
 * needed, because the source already states the order.
 *
 * Not supported yet, and refused rather than mis-drawn: nested conditionals,
 * fork/join, while/repeat, and merge-back after a branch.
 */

import type { CanvasNode, ShapeNodeData, TextNodeData } from '../types/data';
import { generateId } from '../utils/ids';
import { MIN_TEXT_WIDTH } from '../utils/pageLayout';
import { MARKDOWN_PADDING } from '../utils/renderMarkdown';
import {
  FAINT,
  FONT_LABEL,
  FONT_NAME,
  INK,
  MUTED,
  PAPER,
  RADIUS_ENTITY,
  RULE,
  STROKE_ENTITY,
  STROKE_LINK,
  TINT,
} from './tokens';
import type { Box, Diagnostic, MeasureText } from './types';

export type StepKind = 'start' | 'stop' | 'action' | 'decision';

export interface ActivityStep {
  id: string;
  kind: StepKind;
  text: string;
  /** Lane name; '' when the source never declared one. */
  lane: string;
  /** Label on the arrow arriving at this step (a branch guard). */
  incomingLabel?: string;
}

export interface ActivitySpec {
  lanes: string[];
  steps: ActivityStep[];
}

const LANE_WIDTH = 260;
const LANE_GAP = 0;
const LANE_HEADER = 40;
const STEP_H = 54;
const STEP_GAP = 46;
const DECISION_H = 66;
const TOP_PAD = 16;

/** True when a source reads as activity syntax rather than component syntax. */
export function looksLikeActivity(source: string): boolean {
  return /^\s*(\|[^|]*\||start\b|stop\b|:.*;)/m.test(source);
}

export function parseActivity(source: string): { spec: ActivitySpec; diagnostics: Diagnostic[] } {
  const diagnostics: Diagnostic[] = [];
  const lanes: string[] = [];
  const steps: ActivityStep[] = [];
  let lane = '';
  let pendingLabel: string | undefined;

  const lines = source.split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    const line = i + 1;
    const text = lines[i].trim();
    if (!text || text.startsWith("'")) continue;
    if (/^@(start|end)uml/i.test(text)) continue;
    if (/^(skinparam|!|title\b|header\b|footer\b|scale\b)/i.test(text)) {
      diagnostics.push({
        line,
        severity: 'ignored',
        message: 'Styling or preprocessor directive skipped — PowerScroll supplies the style.',
      });
      continue;
    }

    // |Lane| or |#Colour|Lane| — the colour is dropped, we supply the style.
    const laneMatch = text.match(/^\|(?:#[^|]*\|)?([^|]*)\|$/);
    if (laneMatch) {
      lane = laneMatch[1].trim();
      if (lane && !lanes.includes(lane)) lanes.push(lane);
      continue;
    }

    if (/^start$/i.test(text)) {
      steps.push({ id: generateId(), kind: 'start', text: '', lane });
      continue;
    }
    if (/^(stop|end)$/i.test(text)) {
      steps.push({ id: generateId(), kind: 'stop', text: '', lane });
      continue;
    }

    const action = text.match(/^:(.*);$/s);
    if (action) {
      steps.push({
        id: generateId(),
        kind: 'action',
        text: action[1].trim(),
        lane,
        incomingLabel: pendingLabel,
      });
      pendingLabel = undefined;
      continue;
    }

    const cond = text.match(/^if\s*\((.*?)\)\s*then\s*\((.*?)\)\s*$/i) || text.match(/^if\s*\((.*?)\)\s*$/i);
    if (cond) {
      steps.push({ id: generateId(), kind: 'decision', text: cond[1].trim(), lane });
      pendingLabel = cond[2] ? cond[2].trim() : undefined;
      continue;
    }

    const elseM = text.match(/^else\s*\((.*?)\)\s*$/i) || text.match(/^else$/i);
    if (elseM) {
      pendingLabel = elseM[1] ? elseM[1].trim() : 'else';
      continue;
    }

    if (/^(endif|end\s+fork|kill|detach)$/i.test(text)) continue;

    if (/^(fork|split|while|repeat)\b/i.test(text)) {
      diagnostics.push({
        line,
        severity: 'error',
        message: `"${text}" is not supported yet — fork, split, while and repeat are refused rather than drawn wrong.`,
      });
      continue;
    }

    diagnostics.push({ line, severity: 'error', message: 'Not recognised — line skipped.' });
  }

  if (lanes.length === 0 && steps.length > 0) lanes.push('');
  return { spec: { lanes, steps }, diagnostics };
}

interface Placed extends ActivityStep {
  box: Box;
}

export function layoutActivity(spec: ActivitySpec, measureText: MeasureText): {
  placed: Placed[];
  lanes: { name: string; box: Box }[];
  bounds: Box;
} {
  const laneIndex = (name: string) => Math.max(0, spec.lanes.indexOf(name));
  let y = LANE_HEADER + TOP_PAD;
  const placed: Placed[] = [];

  for (const step of spec.steps) {
    const col = laneIndex(step.lane);
    const laneX = col * (LANE_WIDTH + LANE_GAP);
    let w: number;
    let h: number;

    if (step.kind === 'start' || step.kind === 'stop') {
      w = 22;
      h = 22;
    } else if (step.kind === 'decision') {
      w = Math.max(120, measureText(step.text, FONT_LABEL, 400) + 60);
      h = DECISION_H;
    } else {
      w = Math.min(LANE_WIDTH - 48, Math.max(140, measureText(step.text, FONT_NAME, 700) + 48));
      h = STEP_H;
    }

    placed.push({ ...step, box: { x: laneX + (LANE_WIDTH - w) / 2, y, width: w, height: h } });
    y += h + STEP_GAP;
  }

  const height = Math.max(y - STEP_GAP + TOP_PAD, LANE_HEADER + 80);
  const lanes = spec.lanes.map((name, i) => ({
    name,
    box: { x: i * (LANE_WIDTH + LANE_GAP), y: 0, width: LANE_WIDTH, height },
  }));

  return {
    placed,
    lanes,
    bounds: { x: 0, y: 0, width: Math.max(LANE_WIDTH, spec.lanes.length * (LANE_WIDTH + LANE_GAP)), height },
  };
}

export function materializeActivity(
  spec: ActivitySpec,
  groupId: string,
  origin: { x: number; y: number },
  measureText: MeasureText,
): CanvasNode[] {
  const { placed, lanes } = layoutActivity(spec, measureText);
  const nodes: CanvasNode[] = [];
  const dx = origin.x;
  const dy = origin.y;

  const shape = (box: Box, layer: number, data: ShapeNodeData) => {
    nodes.push({
      id: generateId(), type: 'shape', x: box.x + dx, y: box.y + dy,
      width: box.width, height: box.height, layer, groupId, data,
    });
  };
  const label = (cx: number, cy: number, text: string, size: number, bold: boolean, fill: string) => {
    if (!text) return;
    const measured = measureText(text, size, bold ? 700 : 400);
    const width = Math.max(MIN_TEXT_WIDTH, Math.ceil(measured) + 2 * MARKDOWN_PADDING + 6);
    const height = Math.ceil(size * 1.4) + 2 * MARKDOWN_PADDING;
    const data: TextNodeData = {
      text, fontSize: size, fontFamily: 'Inter, system-ui, sans-serif',
      fontStyle: bold ? 'bold' : 'normal', fill,
    };
    nodes.push({
      id: generateId(), type: 'text', x: cx - width / 2 + dx, y: cy - height / 2 + dy,
      width, height, layer: 5, groupId, data,
    });
  };

  // Lane bands first, so everything else draws over them.
  lanes.forEach((lane, i) => {
    shape(lane.box, 2, {
      shapeType: 'rect',
      fill: i % 2 === 0 ? PAPER : '#FAFBFA',
      stroke: RULE, strokeWidth: 1, strokeDash: [], cornerRadius: 0,
    });
    shape({ x: lane.box.x, y: 0, width: LANE_WIDTH, height: LANE_HEADER }, 2, {
      shapeType: 'rect', fill: TINT, stroke: RULE, strokeWidth: 1, strokeDash: [], cornerRadius: 0,
    });
    label(lane.box.x + LANE_WIDTH / 2, LANE_HEADER / 2, lane.name || 'Flow', FONT_NAME, true, INK);
  });

  // Flow arrows between consecutive steps.
  for (let i = 0; i < placed.length - 1; i += 1) {
    const a = placed[i];
    const b = placed[i + 1];
    const from = { x: a.box.x + a.box.width / 2, y: a.box.y + a.box.height };
    const to = { x: b.box.x + b.box.width / 2, y: b.box.y };
    nodes.push({
      id: generateId(), type: 'shape', x: from.x + dx, y: from.y + dy,
      width: to.x - from.x, height: to.y - from.y, layer: 3, groupId,
      data: { shapeType: 'arrow', fill: 'transparent', stroke: INK, strokeWidth: STROKE_LINK, strokeDash: [] },
    });
    if (b.incomingLabel) {
      label((from.x + to.x) / 2, (from.y + to.y) / 2 - 2, `[${b.incomingLabel}]`, FONT_LABEL, false, MUTED);
    }
  }

  for (const step of placed) {
    const { box } = step;
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;

    if (step.kind === 'start') {
      shape(box, 4, { shapeType: 'circle', fill: INK, stroke: INK, strokeWidth: STROKE_ENTITY, strokeDash: [] });
    } else if (step.kind === 'stop') {
      shape(box, 4, { shapeType: 'circle', fill: PAPER, stroke: INK, strokeWidth: STROKE_ENTITY, strokeDash: [] });
      shape({ x: cx - 6, y: cy - 6, width: 12, height: 12 }, 4, {
        shapeType: 'circle', fill: INK, stroke: INK, strokeWidth: 1, strokeDash: [],
      });
    } else if (step.kind === 'decision') {
      // A decision is a diamond: a square turned 45 degrees, which is what the
      // rotation field is for.
      const side = Math.min(box.width, box.height) * 0.72;
      shape({ x: cx, y: box.y + 2, width: side, height: side }, 4, {
        shapeType: 'rect', fill: TINT, stroke: INK, strokeWidth: STROKE_ENTITY,
        strokeDash: [], cornerRadius: 2, rotation: 45,
      });
      label(cx, cy, step.text, FONT_LABEL, false, INK);
    } else {
      shape(box, 4, {
        shapeType: 'rect', fill: TINT, stroke: INK, strokeWidth: STROKE_ENTITY,
        strokeDash: [], cornerRadius: RADIUS_ENTITY,
      });
      label(cx, cy, step.text, FONT_NAME, true, INK);
    }
  }

  void FAINT;
  return nodes;
}
