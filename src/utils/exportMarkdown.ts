import type { WorkspaceData, TextNodeData, ImageNodeData } from '../types/data';

/**
 * Serialize a workspace to a Markdown document.
 *
 * Structure:
 *   # Notebook Name
 *   ## Section Title
 *   ### Page Title
 *   <text node content, separated by blank lines>
 *
 * Text nodes are emitted verbatim (they're already markdown).
 * Image nodes become `![alt](src)` (data URIs preserved).
 * Shape and drawing nodes are skipped — they don't translate to markdown.
 */
export function workspaceToMarkdown(workspace: WorkspaceData): string {
  const lines: string[] = [];

  lines.push(`# ${workspace.filename}`);
  lines.push('');

  for (const section of workspace.sections) {
    lines.push(`## ${section.title}`);
    lines.push('');

    for (const page of section.pages) {
      lines.push(`### ${page.title}`);
      lines.push('');

      // Sort nodes by y then x for reading order
      const nodes = [...page.nodes].sort((a, b) => {
        if (Math.abs(a.y - b.y) > 20) return a.y - b.y;
        return a.x - b.x;
      });

      for (const node of nodes) {
        if (node.type === 'text') {
          const data = node.data as TextNodeData;
          if (data.text && data.text.trim()) {
            lines.push(data.text);
            lines.push('');
          }
        } else if (node.type === 'image') {
          const data = node.data as ImageNodeData;
          lines.push(`![${data.alt || 'image'}](${data.src})`);
          lines.push('');
          if (data.note) {
            lines.push(`*${data.note}*`);
            lines.push('');
          }
        }
        // shape nodes are skipped (rect/circle/arrow/line don't have a markdown representation)
      }
    }
  }

  return lines.join('\n');
}
