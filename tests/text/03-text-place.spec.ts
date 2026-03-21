/**
 * Test 03: Text Place
 * Covers: REQ-TEXT-001, REQ-TEXT-002 — Place a new text block on the canvas
 * and auto-enter edit mode
 *
 * Verifies that activating the text tool and clicking the canvas creates a text
 * node in the store and opens a textarea for editing (auto-edit mode).
 */
import { test, expect } from '@playwright/test';
import { getCanvasStore, waitForCanvasReady, clickCanvas, activateTool } from '../helpers';

test.describe('03 - Text Place (REQ-TEXT-001, REQ-TEXT-002)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForCanvasReady(page);
  });

  test('clicking canvas with text tool adds a text node', async ({ page }) => {
    // Start with no nodes
    let store = await getCanvasStore(page);
    expect(store.nodes).toHaveLength(0);

    // Activate text tool
    await activateTool(page, 'text');

    // Click the canvas to place text
    await clickCanvas(page, 400, 300);

    await page.waitForTimeout(200);

    // Verify a node was added
    store = await getCanvasStore(page);
    expect(store.nodes).toHaveLength(1);
    expect(store.nodes[0].type).toBe('text');
  });

  test('newly placed text has correct initial properties', async ({ page }) => {
    await activateTool(page, 'text');
    await clickCanvas(page, 400, 300);

    await page.waitForTimeout(200);

    const store = await getCanvasStore(page);
    const node = store.nodes[0];
    expect(node.type).toBe('text');
    expect(node.data.text).toBe('');
    expect(node.data.fontSize).toBe(16);
    expect(node.width).toBeGreaterThanOrEqual(60);
  });

  test('textarea appears after placing text (auto-edit mode)', async ({ page }) => {
    await activateTool(page, 'text');
    await clickCanvas(page, 400, 300);

    // A textarea should appear for inline editing
    const textarea = page.locator('textarea');
    await expect(textarea).toBeVisible({ timeout: 2000 });
  });

  test('placed text node is selected in the store', async ({ page }) => {
    await activateTool(page, 'text');
    await clickCanvas(page, 400, 300);

    await page.waitForTimeout(200);

    const store = await getCanvasStore(page);
    expect(store.selectedNodeId).toBe(store.nodes[0].id);
  });
});
