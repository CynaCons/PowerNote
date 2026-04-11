import katex from 'katex';

/**
 * Extract math blocks from text, replacing them with placeholders that
 * survive the markdown parser. Then we can substitute them back with
 * KaTeX-rendered HTML after marked has done its work.
 *
 * Supports:
 * - `$$...$$` for display math (block)
 * - `$...$` for inline math
 *
 * Note: we process display math FIRST (longer delimiter) to avoid
 * `$` inside `$$...$$` being mistaken for inline math.
 */
export interface MathBlock {
  html: string;       // pre-rendered KaTeX HTML
  placeholder: string; // unique token embedded in source text
}

const DISPLAY_PLACEHOLDER_PREFIX = '%%MATH_DISPLAY_';
const INLINE_PLACEHOLDER_PREFIX = '%%MATH_INLINE_';
const PLACEHOLDER_SUFFIX = '%%';

function renderMath(source: string, displayMode: boolean): string {
  try {
    return katex.renderToString(source, {
      displayMode,
      throwOnError: false,
      output: 'html',
    });
  } catch {
    return `<span class="katex-error" style="color:#dc2626">${source}</span>`;
  }
}

/**
 * First pass: replace math blocks in plain text with placeholders.
 * Returns the modified text and the array of extracted blocks.
 */
export function preprocessMath(text: string): { text: string; blocks: MathBlock[] } {
  const blocks: MathBlock[] = [];
  let working = text;

  // Display math first: $$...$$
  working = working.replace(/\$\$([\s\S]+?)\$\$/g, (_m, inner) => {
    const idx = blocks.length;
    const placeholder = `${DISPLAY_PLACEHOLDER_PREFIX}${idx}${PLACEHOLDER_SUFFIX}`;
    blocks.push({ html: renderMath(inner.trim(), true), placeholder });
    return placeholder;
  });

  // Inline math: $...$ (but not $$ which we already handled)
  // Negative lookbehind and lookahead to avoid `$$` matches
  working = working.replace(/(^|[^$])\$([^\n$]+?)\$(?!\$)/g, (_m, prefix, inner) => {
    const idx = blocks.length;
    const placeholder = `${INLINE_PLACEHOLDER_PREFIX}${idx}${PLACEHOLDER_SUFFIX}`;
    blocks.push({ html: renderMath(inner, false), placeholder });
    return prefix + placeholder;
  });

  return { text: working, blocks };
}

/**
 * Second pass: replace placeholders in HTML output with rendered math.
 * Must be called after `marked.parse()` has processed the preprocessed text.
 */
export function restoreMath(html: string, blocks: MathBlock[]): string {
  let result = html;
  for (const block of blocks) {
    // Placeholders may be wrapped in <p> by marked — replace whole thing
    result = result.split(block.placeholder).join(block.html);
  }
  return result;
}
