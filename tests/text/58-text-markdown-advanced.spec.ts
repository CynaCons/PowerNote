/**
 * Test 58: Advanced Markdown Rendering
 * Covers: REQ-TEXT-016 — Markdown rendering (tables, code blocks, blockquotes, nested lists)
 *         REQ-TEXT-030, REQ-TEXT-031 — visual heading sizes, relative to block fontSize
 *
 * Verifies that advanced markdown features render correctly in text nodes:
 * tables as HTML tables, code blocks with code styling, blockquotes, nested lists.
 *
 * The heading-size cases were added during the v0.13.0 audit: headings had been
 * styled since early on, but nothing asserted their sizes, so a stylesheet edit
 * could have flattened the hierarchy silently.
 */
import { test, expect } from '@playwright/test';
import { waitForCanvasReady } from '../helpers';

/** Helper: place a text node with given markdown content via store */
async function placeMarkdownNode(
  page: import('@playwright/test').Page,
  id: string,
  text: string,
  fontSize = 16,
) {
  await page.evaluate(({ id, text, fontSize }) => {
    const store = (window as any).__POWERNOTE_STORES__.canvas.getState();
    store.addNode({
      id,
      type: 'text',
      x: 200,
      y: 200,
      width: 400,
      height: 200,
      data: {
        text,
        fontSize,
        fontFamily: 'Inter',
        fontStyle: 'normal',
        fill: '#1a1a1a',
      },
    });
  }, { id, text, fontSize });
  await page.waitForTimeout(500);
}

/** Computed font-size in px for the first element matching `tag`. */
async function fontSizeOf(page: import('@playwright/test').Page, tag: string) {
  return page
    .locator(`.powernote-markdown ${tag}`)
    .first()
    .evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
}

test.describe('58 - Advanced Markdown Rendering (REQ-TEXT-016)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForCanvasReady(page);
  });

  test('renders markdown table as HTML table', async ({ page }) => {
    const tableMarkdown = '| Name | Age |\n|------|-----|\n| Alice | 30 |\n| Bob | 25 |';
    await placeMarkdownNode(page, 'table-node', tableMarkdown);

    const mdContainer = page.locator('.powernote-markdown');
    await expect(mdContainer.first()).toBeVisible();

    // Check for a <table> element
    const table = mdContainer.locator('table');
    await expect(table.first()).toBeVisible();

    // Check for table header cells
    const th = mdContainer.locator('th');
    expect(await th.count()).toBeGreaterThanOrEqual(2);

    // Check for table body cells
    const td = mdContainer.locator('td');
    expect(await td.count()).toBeGreaterThanOrEqual(4);
  });

  test('renders fenced code block with code styling', async ({ page }) => {
    const codeMarkdown = '```\nconst x = 42;\nconsole.log(x);\n```';
    await placeMarkdownNode(page, 'code-node', codeMarkdown);

    const mdContainer = page.locator('.powernote-markdown');
    await expect(mdContainer.first()).toBeVisible();

    // Check for <pre> and <code> elements
    const pre = mdContainer.locator('pre');
    await expect(pre.first()).toBeVisible();

    const code = mdContainer.locator('code');
    await expect(code.first()).toBeVisible();
  });

  test('renders inline code with code element', async ({ page }) => {
    const inlineCode = 'Use `npm install` to install dependencies';
    await placeMarkdownNode(page, 'inline-code-node', inlineCode);

    const mdContainer = page.locator('.powernote-markdown');
    await expect(mdContainer.first()).toBeVisible();

    // Check for inline <code> element
    const code = mdContainer.locator('code');
    await expect(code.first()).toBeVisible();
  });

  test('renders blockquotes properly', async ({ page }) => {
    const quoteMarkdown = '> This is a blockquote\n> It spans multiple lines';
    await placeMarkdownNode(page, 'quote-node', quoteMarkdown);

    const mdContainer = page.locator('.powernote-markdown');
    await expect(mdContainer.first()).toBeVisible();

    // Check for <blockquote> element
    const blockquote = mdContainer.locator('blockquote');
    await expect(blockquote.first()).toBeVisible();
  });

  test('renders nested lists properly', async ({ page }) => {
    const nestedList = '- Item 1\n  - Sub-item 1a\n  - Sub-item 1b\n- Item 2';
    await placeMarkdownNode(page, 'nested-list-node', nestedList);

    const mdContainer = page.locator('.powernote-markdown');
    await expect(mdContainer.first()).toBeVisible();

    // Check for ul elements (outer + nested)
    const ul = mdContainer.locator('ul');
    expect(await ul.count()).toBeGreaterThanOrEqual(1);

    // Check for li elements (at least 4: 2 outer + 2 inner)
    const li = mdContainer.locator('li');
    expect(await li.count()).toBeGreaterThanOrEqual(4);
  });

  test('renders numbered list', async ({ page }) => {
    const numberedList = '1. First item\n2. Second item\n3. Third item';
    await placeMarkdownNode(page, 'numbered-list-node', numberedList);

    const mdContainer = page.locator('.powernote-markdown');
    await expect(mdContainer.first()).toBeVisible();

    // Check for <ol> element
    const ol = mdContainer.locator('ol');
    await expect(ol.first()).toBeVisible();

    // Check for 3 list items
    const li = mdContainer.locator('li');
    expect(await li.count()).toBe(3);
  });

  test('renders horizontal rule', async ({ page }) => {
    const hrMarkdown = 'Above\n\n---\n\nBelow';
    await placeMarkdownNode(page, 'hr-node', hrMarkdown);

    const mdContainer = page.locator('.powernote-markdown');
    await expect(mdContainer.first()).toBeVisible();

    // Check for <hr> element
    const hr = mdContainer.locator('hr');
    await expect(hr.first()).toBeVisible();
  });

  test('renders links as anchor tags', async ({ page }) => {
    const linkMarkdown = 'Visit [Example](https://example.com) for more info';
    await placeMarkdownNode(page, 'link-node', linkMarkdown);

    const mdContainer = page.locator('.powernote-markdown');
    await expect(mdContainer.first()).toBeVisible();

    // Check for <a> element
    const anchor = mdContainer.locator('a');
    await expect(anchor.first()).toBeVisible();
  });

  test('renders combined markdown (headers + lists + bold)', async ({ page }) => {
    const combined = '## Shopping List\n\n- **Apples** (red)\n- *Bananas*\n- ~~Oranges~~';
    await placeMarkdownNode(page, 'combined-node', combined);

    const mdContainer = page.locator('.powernote-markdown');
    await expect(mdContainer.first()).toBeVisible();

    // Check for h2
    const h2 = mdContainer.locator('h2');
    await expect(h2.first()).toBeVisible();

    // Check for strong (bold)
    const strong = mdContainer.locator('strong');
    await expect(strong.first()).toBeVisible();

    // Check for em (italic)
    const em = mdContainer.locator('em');
    await expect(em.first()).toBeVisible();
  });

  test('headings render in a descending size hierarchy (REQ-TEXT-030)', async ({ page }) => {
    await placeMarkdownNode(page, 'heading-node', '# One\n\n## Two\n\n### Three\n\nBody text.');

    const [h1, h2, h3, p] = await Promise.all([
      fontSizeOf(page, 'h1'),
      fontSizeOf(page, 'h2'),
      fontSizeOf(page, 'h3'),
      fontSizeOf(page, 'p'),
    ]);

    // 1.6 / 1.3 / 1.1 em against a 16px block.
    expect(h1).toBeCloseTo(25.6, 1);
    expect(h2).toBeCloseTo(20.8, 1);
    expect(h3).toBeCloseTo(17.6, 1);

    // The ordering is the part a stylesheet edit could silently break.
    expect(h1).toBeGreaterThan(h2);
    expect(h2).toBeGreaterThan(h3);
    expect(h3).toBeGreaterThan(p);

    const h1Weight = await page
      .locator('.powernote-markdown h1')
      .first()
      .evaluate((el) => getComputedStyle(el).fontWeight);
    expect(Number(h1Weight)).toBeGreaterThanOrEqual(700);
  });

  test('heading sizes scale with the block font size (REQ-TEXT-031)', async ({ page }) => {
    await placeMarkdownNode(page, 'big-heading-node', '# One\n\nBody text.', 24);

    // Relative (em) sizing, not fixed px — a 24px block gets a 24 × 1.6 heading.
    expect(await fontSizeOf(page, 'h1')).toBeCloseTo(38.4, 1);
    expect(await fontSizeOf(page, 'p')).toBeCloseTo(24, 1);
  });
});
