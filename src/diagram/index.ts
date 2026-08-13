/**
 * One entry point for the whole pipeline: diagram text in, canvas nodes out.
 *
 * parse -> measure -> layout -> materialize, with diagnostics carried through
 * rather than thrown. A caller that gets zero nodes still gets an explanation.
 *
 * Only the PARSER differs per language. Everything downstream works on the spec
 * types, which is what keeps a Mermaid flowchart and a PlantUML component
 * diagram looking like they belong to the same notebook.
 */

import type { CanvasNode } from '../types/data';
import { canvasMeasureText, layoutDiagram } from './layout';
import { boundsOfNodes, materializeDiagram } from './materialize';
import { parsePlantUml } from './plantuml';
import { transpileSvg } from './svg';
import { looksLikeActivity, materializeActivity, parseActivity } from './activity';
import { looksLikeMermaid, parseMermaid } from './mermaid';
import type { Box, Diagnostic, MeasureText } from './types';

export * from './types';
export { parsePlantUml } from './plantuml';
export { layoutDiagram, canvasMeasureText, deriveConnectorKind, displayLabel } from './layout';
export { materializeDiagram, boundsOfNodes } from './materialize';
export * as diagramTokens from './tokens';
export { looksLikeActivity, parseActivity, layoutActivity, materializeActivity } from './activity';
export { looksLikeMermaid, readMermaidHeader, parseMermaid } from './mermaid';
export { transpileSvg } from './svg';

/**
 * The language a source is written in.
 *
 * PlantUML covers two dialects — component and activity — which are sniffed
 * apart inside the parser, because they are one language with one tool. Mermaid
 * is a different language and is chosen, not guessed, whenever the caller knows.
 *
 * SVG is the odd one out and deliberately so: the other two describe a diagram
 * and let this module compute every coordinate, whereas SVG IS geometry that the
 * author has already laid out. It skips measure and layout entirely and is only
 * transpiled into native nodes, so `elementCount` counts marks rather than
 * entities.
 */
export type DiagramFormat = 'plantuml' | 'mermaid' | 'svg';

export interface BuildDiagramOptions {
  /** Shared by every node produced, so the diagram can be found again. */
  groupId: string;
  /** Page coordinates for the diagram's top-left corner. */
  origin: { x: number; y: number };
  measureText?: MeasureText;
  /**
   * Declared by a caller that knows — an agent picks a tool named for its
   * language. Absent, the format is sniffed, which is what lets a source pasted
   * into the frame editor route itself.
   */
  format?: DiagramFormat;
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
    // Each sniff is a header read rather than a guess: SVG opens with an <svg>
    // root, Mermaid announces its diagram type on the first line.
    const sniffed: DiagramFormat = /^\s*(<\?xml|<svg[\s>])/i.test(source)
      ? 'svg'
      : looksLikeMermaid(source)
        ? 'mermaid'
        : 'plantuml';
    const format = options.format ?? sniffed;

    // A declared format that disagrees with the source is caught here rather
    // than half-drawn: PlantUML would happily render `A[Start]` as an entity
    // named "A[Start]", which is worse than refusing.
    if (options.format && options.format !== sniffed && sniffed === 'mermaid') {
      return {
        nodes: [],
        diagnostics: [
          {
            line: 1,
            severity: 'error',
            message:
              'This source is Mermaid, not PlantUML. Draw it with the Mermaid tool.',
          },
        ],
        bounds: null,
        elementCount: 0,
      };
    }

    if (format === 'svg') {
      const { nodes, diagnostics } = transpileSvg(source, {
        groupId: options.groupId,
        origin: options.origin,
        measureText,
      });
      return { nodes, diagnostics, bounds: boundsOfNodes(nodes), elementCount: nodes.length };
    }

    if (format === 'mermaid') {
      const { spec, diagnostics, index } = parseMermaid(source);
      const layout = layoutDiagram(spec, index, measureText);
      const nodes = materializeDiagram(spec, layout, index, options.groupId, options.origin, measureText);
      return { nodes, diagnostics, bounds: boundsOfNodes(nodes), elementCount: index.size };
    }

    // Two PlantUML dialects, sniffed rather than declared: activity syntax
    // (start, :action;, |Lane|) is a different grammar from the component one.
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
