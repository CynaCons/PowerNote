/**
 * Test 17: Container Place
 * Covers: REQ-CONT-001, REQ-CONT-008 — Place a container on the canvas
 * using the container tool and verify default properties
 *
 * Verifies that activating the container tool and clicking the canvas
 * creates a container node in the store with correct default properties,
 * and that the container title is present.
 */
import { test, expect } from '@playwright/test';
import { getCanvasStore, waitForCanvasReady, clickCanvas } from '../helpers';

test.describe('17 - Container Place (REQ-CONT-001, REQ-CONT-008)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForCanvasReady(page);
  });

  test('clicking canvas with container tool adds a container node', async ({ page }) => {
    // Start with no nodes
    let store = await getCanvasStore(page);
    expect(store.nodes).toHaveLength(0);

    // Activate container tool via NavRail
    await page.locator('[data-testid="nav-container-tool"]').click();

    // Click the canvas to place a container
    await clickCanvas(page, 400, 300);
    await page.waitForTimeout(200);

    // Verify a node was added with type 'container'
    store = await getCanvasStore(page);
    expect(store.nodes).toHaveLength(1);
    expect(store.nodes[0].type).toBe('container');
  });

  test('newly placed container has correct default properties', async ({ page }) => {
    // Activate container tool
    await page.locator('[data-testid="nav-container-tool"]').click();

    // Place a container
    await clickCanvas(page, 400, 300);
    await page.waitForTimeout(200);

    // Verify default properties
    const store = await getCanvasStore(page);
    const node = store.nodes[0];
    expect(node.type).toBe('container');
    expect(node.data.title).toBe('Container');
    expect(node.data.isCollapsed).toBe(false);
  });

  test('placed container is selected in the store', async ({ page }) => {
    // Activate container tool
    await page.locator('[data-testid="nav-container-tool"]').click();

    // Place a container
    await clickCanvas(page, 400, 300);
    await page.waitForTimeout(200);

    // Verify the container is selected
    const store = await getCanvasStore(page);
    expect(store.selectedNodeId).toBe(store.nodes[0].id);
  });
});
