/**
 * Human names for the diagram languages.
 *
 * Separate from `DiagramFormat` because the id and the label serve different
 * readers: the id is what the MCP tools and `data-format` attributes carry, the
 * label is what a person is shown in a tooltip or a dialog header.
 */

import type { DiagramFormat } from './index';

export const FORMAT_LABEL: Record<DiagramFormat, string> = {
  plantuml: 'PlantUML',
  mermaid: 'Mermaid',
  svg: 'SVG',
};
