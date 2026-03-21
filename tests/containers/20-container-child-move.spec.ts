/**
 * Test 20: Container Child Move
 * Covers: REQ-CONT-004 — Parenting a node into a container
 *         REQ-CONT-005 — Unparenting a node from a container
 *
 * Verifies that nodes can be parented/unparented to containers via store actions.
 */
import { test, expect } from '@playwright/test';
import { getCanvasStore, waitForCanvasReady, clickCanvas } from '../helpers';

test.describe('20 - Container Child Move (REQ-CONT-004, REQ-CONT-005)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForCanvasReady(page);
  });

  test('parenting a node into a container sets parentContainerId', async ({ page }) => {
    // Place a container via UI
    await page.locator('[data-testid="nav-container-tool"]').click();
    await clickCanvas(page, 400, 300);
    await page.waitForTimeout(200);

    let store = await getCanvasStore(page);
    const containerId = store.nodes[0].id;

    // Add a text node via store (outside container)
    await page.evaluate(() => {
      const s = (window as any).__POWERNOTE_STORES__.canvas.getState();
      s.addNode({
        id: 'orphan-text-1',
        type: 'text',
        x: 100, y: 100,
        width: 200, height: 30,
        data: { text: 'Orphan', fontSize: 16, fontFamily: 'sans-serif', fontStyle: 'normal', fill: '#1a1a1a' },
      });
    });
    await page.waitForTimeout(100);

    // Parent the text node to the container
    await page.evaluate((contId) => {
      (window as any).__POWERNOTE_STORES__.canvas.getState().moveNodeIntoContainer('orphan-text-1', contId);
    }, containerId);
    await page.waitForTimeout(100);

    // Verify parentContainerId is set
    store = await getCanvasStore(page);
    const textAfter = store.nodes.find((n: any) => n.id === 'orphan-text-1');
    expect(textAfter.parentContainerId).toBe(containerId);
  });

  test('unparenting a node from a container clears parentContainerId', async ({ page }) => {
    // Place a container
    await page.locator('[data-testid="nav-container-tool"]').click();
    await clickCanvas(page, 400, 300);
    await page.waitForTimeout(200);

    let store = await getCanvasStore(page);
    const containerId = store.nodes[0].id;

    // Add a child node via store
    await page.evaluate((contId) => {
      const s = (window as any).__POWERNOTE_STORES__.canvas.getState();
      s.addNode({
        id: 'child-to-unparent',
        type: 'text',
        x: 420, y: 340,
        width: 200, height: 30,
        parentContainerId: contId,
        data: { text: 'Will unparent', fontSize: 16, fontFamily: 'sans-serif', fontStyle: 'normal', fill: '#1a1a1a' },
      });
    }, containerId);
    await page.waitForTimeout(100);

    // Unparent the node
    await page.evaluate(() => {
      (window as any).__POWERNOTE_STORES__.canvas.getState().moveNodeOutOfContainer('child-to-unparent');
    });
    await page.waitForTimeout(100);

    // Verify parentContainerId is null
    store = await getCanvasStore(page);
    expect(store.nodes.find((n: any) => n.id === 'child-to-unparent').parentContainerId).toBeNull();
  });

  test('round-trip parent/unparent preserves node data', async ({ page }) => {
    // Place a container
    await page.locator('[data-testid="nav-container-tool"]').click();
    await clickCanvas(page, 400, 300);
    await page.waitForTimeout(200);

    let store = await getCanvasStore(page);
    const containerId = store.nodes[0].id;

    // Add text node via store
    await page.evaluate(() => {
      const s = (window as any).__POWERNOTE_STORES__.canvas.getState();
      s.addNode({
        id: 'roundtrip-node',
        type: 'text',
        x: 150, y: 150,
        width: 200, height: 30,
        data: { text: 'Round trip', fontSize: 16, fontFamily: 'sans-serif', fontStyle: 'normal', fill: '#1a1a1a' },
      });
    });

    // Parent then unparent
    await page.evaluate((contId) => {
      const s = (window as any).__POWERNOTE_STORES__.canvas.getState();
      s.moveNodeIntoContainer('roundtrip-node', contId);
    }, containerId);

    await page.evaluate(() => {
      (window as any).__POWERNOTE_STORES__.canvas.getState().moveNodeOutOfContainer('roundtrip-node');
    });

    store = await getCanvasStore(page);
    const node = store.nodes.find((n: any) => n.id === 'roundtrip-node');
    expect(node.data.text).toBe('Round trip');
    expect(node.parentContainerId).toBeNull();
    expect(node.x).toBe(150);
    expect(node.y).toBe(150);
  });
});
