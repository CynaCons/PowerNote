/**
 * Test 27: Markdown Rendering
 * Covers: REQ-TEXT-016 — Markdown rendering in text nodes (Jupyter-style)
 *
 * Verifies that text nodes with markdown content are rendered as HTML,
 * including headers, bold, italic, and bullet lists.
 */
import { test, expect } from '@playwright/test';
import { waitForCanvasReady } from '../helpers';

test.describe('27 - Markdown Rendering (REQ-TEXT-016)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForCanvasReady(page);
  });

  test('renders markdown headers, bold, and italic', async ({ page }) => {
    // Place a text node with markdown content via store
    await page.evaluate(() => {
      const store = (window as any).__POWERNOTE_STORES__.canvas.getState();
      store.addNode({
        id: 'md-node',
        type: 'text',
        x: 200,
        y: 200,
        width: 300,
        height: 100,
        data: {
          text: '# Header\n**bold** and *italic*',
          fontSize: 16,
          fontFamily: 'Inter',
          fontStyle: 'normal',
          fill: '#1a1a1a',
        },
      });
    });
    await page.waitForTimeout(500);

    // Find the rendered markdown container
    const mdContainer = page.locator('.powernote-markdown');
    await expect(mdContainer.first()).toBeVisible();

    // Check that an h1 element is rendered
    const h1 = mdContainer.locator('h1');
    await expect(h1.first()).toBeVisible();

    // Check that strong (bold) and em (italic) elements exist
    const strong = mdContainer.locator('strong');
    await expect(strong.first()).toBeVisible();

    const em = mdContainer.locator('em');
    await expect(em.first()).toBeVisible();
  });

  test('renders bullet list from markdown', async ({ page }) => {
    await page.evaluate(() => {
      const store = (window as any).__POWERNOTE_STORES__.canvas.getState();
      store.addNode({
        id: 'list-node',
        type: 'text',
        x: 200,
        y: 200,
        width: 300,
        height: 100,
        data: {
          text: '- item1\n- item2',
          fontSize: 16,
          fontFamily: 'Inter',
          fontStyle: 'normal',
          fill: '#1a1a1a',
        },
      });
    });
    await page.waitForTimeout(500);

    const mdContainer = page.locator('.powernote-markdown');
    await expect(mdContainer.first()).toBeVisible();

    // Check for ul and li elements
    const ul = mdContainer.locator('ul');
    await expect(ul.first()).toBeVisible();

    const li = mdContainer.locator('li');
    expect(await li.count()).toBeGreaterThanOrEqual(2);
  });
});
