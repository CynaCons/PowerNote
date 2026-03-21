/**
 * Test 29: One-Shot Text Tool
 * Covers: REQ-TEXT-011 — Text tool is one-shot (reverts to select after placing)
 *
 * Verifies that activating the text tool and clicking the canvas to place text
 * automatically reverts the tool to 'select', and that subsequent canvas clicks
 * do not create additional text nodes.
 */
import { test, expect } from '@playwright/test';
import { getCanvasStore, getToolStore, waitForCanvasReady, clickCanvas, activateTool } from '../helpers';

test.describe('29 - One-Shot Tool (REQ-TEXT-011)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForCanvasReady(page);
  });

  test('activating text tool sets tool store to text', async ({ page }) => {
    await activateTool(page, 'text');
    await page.waitForTimeout(100);

    const toolStore = await getToolStore(page);
    expect(toolStore.activeTool).toBe('text');
  });

  test('placing text reverts tool to select', async ({ page }) => {
    await activateTool(page, 'text');
    await clickCanvas(page, 400, 300);
    await page.waitForTimeout(300);

    const toolStore = await getToolStore(page);
    expect(toolStore.activeTool).toBe('select');
  });

  test('next click on canvas does NOT create another text node', async ({ page }) => {
    // Activate text tool and place text
    await activateTool(page, 'text');
    await clickCanvas(page, 400, 300);
    await page.waitForTimeout(200);

    // Commit the text
    await page.evaluate(() => (document.activeElement as HTMLElement)?.blur());
    await page.waitForTimeout(300);

    let store = await getCanvasStore(page);
    expect(store.nodes).toHaveLength(1);

    // Tool should be back to select, so clicking canvas again should deselect, not create
    await clickCanvas(page, 600, 400);
    await page.waitForTimeout(300);

    store = await getCanvasStore(page);
    expect(store.nodes).toHaveLength(1); // Still just 1 node
  });
});
