/**
 * Test 18: Container Collapse
 * Covers: REQ-CONT-002, REQ-CONT-007 — Toggle container collapse state
 * and verify that deleting a container releases its children
 *
 * Verifies that toggling collapse via the store switches isCollapsed
 * between true and false, and that deleting a container removes it
 * while keeping its children on the canvas.
 */
import { test, expect } from '@playwright/test';
import { getCanvasStore, waitForCanvasReady, clickCanvas } from '../helpers';

test.describe('18 - Container Collapse (REQ-CONT-002, REQ-CONT-007)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForCanvasReady(page);
  });

  test('toggling collapse sets isCollapsed to true', async ({ page }) => {
    // Place a container
    await page.locator('[data-testid="nav-container-tool"]').click();
    await clickCanvas(page, 400, 300);
    await page.waitForTimeout(200);

    // Get the container id
    let store = await getCanvasStore(page);
    const containerId = store.nodes[0].id;
    expect(store.nodes[0].data.isCollapsed).toBe(false);

    // Toggle collapse via store
    await page.evaluate((id) => {
      (window as any).__POWERNOTE_STORES__.canvas.getState().toggleContainerCollapse(id);
    }, containerId);
    await page.waitForTimeout(100);

    // Verify isCollapsed is true
    store = await getCanvasStore(page);
    expect(store.nodes[0].data.isCollapsed).toBe(true);
  });

  test('toggling collapse again sets isCollapsed back to false', async ({ page }) => {
    // Place a container
    await page.locator('[data-testid="nav-container-tool"]').click();
    await clickCanvas(page, 400, 300);
    await page.waitForTimeout(200);

    const store = await getCanvasStore(page);
    const containerId = store.nodes[0].id;

    // Toggle to collapsed
    await page.evaluate((id) => {
      (window as any).__POWERNOTE_STORES__.canvas.getState().toggleContainerCollapse(id);
    }, containerId);
    await page.waitForTimeout(100);

    // Toggle back to expanded
    await page.evaluate((id) => {
      (window as any).__POWERNOTE_STORES__.canvas.getState().toggleContainerCollapse(id);
    }, containerId);
    await page.waitForTimeout(100);

    // Verify isCollapsed is false
    const updated = await getCanvasStore(page);
    expect(updated.nodes[0].data.isCollapsed).toBe(false);
  });

  test('deleting a container releases children to canvas root', async ({ page }) => {
    // Place a container
    await page.locator('[data-testid="nav-container-tool"]').click();
    await clickCanvas(page, 400, 300);
    await page.waitForTimeout(200);

    let store = await getCanvasStore(page);
    const containerId = store.nodes[0].id;

    // Add a text node via store and parent it to the container
    await page.evaluate((contId) => {
      const store = (window as any).__POWERNOTE_STORES__.canvas.getState();
      store.addNode({
        id: 'child-text-1',
        type: 'text',
        x: 420, y: 340,
        width: 200, height: 30,
        parentContainerId: contId,
        data: { text: 'Child text', fontSize: 16, fontFamily: 'sans-serif', fontStyle: 'normal', fill: '#1a1a1a' },
      });
    }, containerId);
    await page.waitForTimeout(100);

    // Verify parent is set
    store = await getCanvasStore(page);
    const textNodeId = 'child-text-1';
    const childNode = store.nodes.find((n: any) => n.id === textNodeId);
    expect(childNode.parentContainerId).toBe(containerId);

    // Delete the container via store
    await page.evaluate((id) => {
      (window as any).__POWERNOTE_STORES__.canvas.getState().deleteNode(id);
    }, containerId);
    await page.waitForTimeout(200);

    // Verify the container is gone but the child remains, unparented
    store = await getCanvasStore(page);
    expect(store.nodes).toHaveLength(1);
    expect(store.nodes[0].type).toBe('text');
    expect(store.nodes[0].parentContainerId).toBeNull();
  });
});
