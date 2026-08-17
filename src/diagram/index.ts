/**
 * One entry point for the whole pipeline: diagram text in, canvas nodes out.
 *
 * For PlantUML and Mermaid: parse -> measure -> layout -> materialize.
 * SVG and draw.io skip measure and layout — their source already is geometry —
 * and transpile straight into native nodes. Diagnostics are carried through
 * rather than thrown. A caller that gets zero nodes still gets an explanation.
 *
 * Only the PARSER (or transpiler) differs per language. Everything downstream
 * works on the spec types, which is what keeps a Mermaid flowchart and a
 * PlantUML component diagram looking like they belong to the same notebook.
 */

import type { CanvasNode } from '../types/data';
import { canvasMeasureText, layoutDiagram } from './layout';
import { boundsOfNodes, materializeDiagram } from './materialize';
import { parsePlantUml } from './plantuml';
import { transpileSvg } from './svg';
import { transpileDrawio } from './drawio';
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
export { transpileDrawio, normalizeDrawioSource } from './drawio';

/**
 * The language a source is written in.
 *
 * PlantUML covers two dialects — component and activity — which are sniffed
 * apart inside the parser, because they are one language with one tool. Mermaid
 * is a different language and is chosen, not guessed, whenever the caller knows.
 *
 * SVG and draw.io are the odd ones out and deliberately so: the other two
 * describe a diagram and let this module compute every coordinate, whereas
 * those two ARE geometry that the author has already laid out. They skip
 * measure and layout entirely and are only transpiled into native nodes, so
 * `elementCount` counts marks rather than entities.
 */
export type DiagramFormat = 'plantuml' | 'mermaid' | 'svg' | 'drawio';

/**
 * The language a source is written in, read off the source itself.
 *
 * Each test is a header read rather than a guess: mxGraph (`<mxfile` /
 * `<mxGraphModel`) is checked first because those files also start with
 * `<?xml` and would otherwise be claimed as SVG; SVG opens with an `<svg>`
 * root; Mermaid announces its diagram type on the first line; PlantUML is
 * what is left. Exported because the UI needs the same answer the builder
 * reaches — a frame that labelled its source button "plantuml" regardless of
 * what it was actually built from told an SVG diagram it was something else.
 */
export function sniffFormat(source: string): DiagramFormat {
  if (/<mxfile[\s>]|<mxGraphModel[\s>]/i.test(source)) return 'drawio';
  if (/^\s*(<\?xml|<svg[\s>])/i.test(source)) return 'svg';
  if (looksLikeMermaid(source)) return 'mermaid';
  return 'plantuml';
}

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
    const sniffed = sniffFormat(source);
    const format = options.format ?? sniffed;

    // A declared format that disagrees with the source is caught here rather
    // than half-drawn: PlantUML would happily render `A[Start]` as an entity
    // named "A[Start]", which is worse than refusing. Mermaid and draw.io
    // are treated the same way — each has a header we can trust.
    if (options.format && options.format !== sniffed) {
      if (sniffed === 'mermaid') {
        const declaredName =
          options.format === 'plantuml'
            ? 'PlantUML'
            : options.format === 'drawio'
              ? 'draw.io'
              : options.format === 'svg'
                ? 'SVG'
                : options.format;
        return {
          nodes: [],
          diagnostics: [
            {
              line: 1,
              severity: 'error',
              message: `This source is Mermaid, not ${declaredName}. Draw it with the Mermaid tool.`,
            },
          ],
          bounds: null,
          elementCount: 0,
        };
      }
      if (sniffed === 'drawio' || options.format === 'drawio') {
        const sniffedName = sniffed === 'drawio' ? 'draw.io' : sniffed === 'svg' ? 'SVG' : 'PlantUML';
        const declaredName =
          options.format === 'drawio'
            ? 'draw.io'
            : options.format === 'svg'
              ? 'SVG'
              : options.format === 'mermaid'
                ? 'Mermaid'
                : 'PlantUML';
        return {
          nodes: [],
          diagnostics: [
            {
              line: 1,
              severity: 'error',
              message: `This source is ${sniffedName}, not ${declaredName}. Draw it with the ${sniffedName} tool.`,
            },
          ],
          bounds: null,
          elementCount: 0,
        };
      }
    }

    if (format === 'svg') {
      const { nodes, diagnostics } = transpileSvg(source, {
        groupId: options.groupId,
        origin: options.origin,
        measureText,
      });
      return { nodes, diagnostics, bounds: boundsOfNodes(nodes), elementCount: nodes.length };
    }

    if (format === 'drawio') {
      const { nodes, diagnostics } = transpileDrawio(source, {
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
