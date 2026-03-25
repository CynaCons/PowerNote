/**
 * Test 58: Advanced Markdown Rendering
 * Covers: REQ-TEXT-016 — Markdown rendering (tables, code blocks, blockquotes, nested lists)
 *
 * Verifies that advanced markdown features render correctly in text nodes:
 * tables as HTML tables, code blocks with code styling, blockquotes, nested lists.
 */
import { test, expect } from '@playwright/test';
import { waitForCanvasReady } from '../helpers';

/** Helper: place a text node with given markdown content via store */
async function placeMarkdownNode(page: import('@playwright/test').Page, id: string, text: string) {
  await page.evaluate(({ id, text }) => {
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
        fontSize: 16,
        fontFamily: 'Inter',
        fontStyle: 'normal',
        fill: '#1a1a1a',
      },
    });
  }, { id, text });
  await page.waitForTimeout(500);
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
});
