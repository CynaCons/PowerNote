/**
 * One entry point for the whole pipeline: PlantUML text in, canvas nodes out.
 *
 * parse -> measure -> layout -> materialize, with diagnostics carried through
 * rather than thrown. A caller that gets zero nodes still gets an explanation.
 */

import type { CanvasNode } from '../types/data';
import { canvasMeasureText, layoutDiagram } from './layout';
import { boundsOfNodes, materializeDiagram } from './materialize';
import { parsePlantUml } from './plantuml';
import { looksLikeActivity, materializeActivity, parseActivity } from './activity';
import type { Box, Diagnostic, MeasureText } from './types';

export * from './types';
export { parsePlantUml } from './plantuml';
export { layoutDiagram, canvasMeasureText, deriveConnectorKind, displayLabel } from './layout';
export { materializeDiagram, boundsOfNodes } from './materialize';
export * as diagramTokens from './tokens';
export { looksLikeActivity, parseActivity, layoutActivity, materializeActivity } from './activity';

export interface BuildDiagramOptions {
  /** Shared by every node produced, so the diagram can be found again. */
  groupId: string;
  /** Page coordinates for the diagram's top-left corner. */
  origin: { x: number; y: number };
  measureText?: MeasureText;
}

export interface BuildDiagramResult {
  nodes: CanvasNode[];
  diagnostics: Diagnostic[];
  bounds: Box | null;
  /** Entities and ports understood, useful for a quick "did it read my source" check. */
  elementCount: number;
}

/**
 * Never throws. A parser or layout fault becomes a diagnostic and an empty node
 * list, because the caller is a canvas that has to keep working either way.
 */
export function buildDiagram(source: string, options: BuildDiagramOptions): BuildDiagramResult {
  const measureText = options.measureText ?? canvasMeasureText;
  try {
    // Two grammars, sniffed rather than declared: activity syntax (start,
    // :action;, |Lane|) is a different language from the component one.
    if (looksLikeActivity(source)) {
      const { spec, diagnostics } = parseActivity(source);
      const nodes = materializeActivity(spec, options.groupId, options.origin, measureText);
      return {
        nodes,
        diagnostics,
        bounds: boundsOfNodes(nodes),
        elementCount: spec.steps.length,
      };
    }

    const { spec, diagnostics, index } = parsePlantUml(source);
    const layout = layoutDiagram(spec, index, measureText);
    const nodes = materializeDiagram(spec, layout, index, options.groupId, options.origin, measureText);
    return { nodes, diagnostics, bounds: boundsOfNodes(nodes), elementCount: index.size };
  } catch (err) {
    return {
      nodes: [],
      diagnostics: [
        {
          line: 0,
          severity: 'error',
          message: `Could not build the diagram: ${err instanceof Error ? err.message : String(err)}`,
        },
      ],
      bounds: null,
      elementCount: 0,
    };
  }
}
