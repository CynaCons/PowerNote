/**
 * Test 19: Container Drag
 * Covers: REQ-CONT-003 — Dragging a container moves all its children
 * by the same delta
 *
 * Verifies that when a container is moved, its child nodes move by
 * the same positional offset.
 */
import { test, expect } from '@playwright/test';
import { getCanvasStore, waitForCanvasReady, clickCanvas } from '../helpers';

test.describe('19 - Container Drag (REQ-CONT-003)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForCanvasReady(page);
  });

  test('dragging a container moves its children by the same delta', async ({ page }) => {
    // Place a container
    await page.locator('[data-testid="nav-container-tool"]').click();
    await clickCanvas(page, 400, 300);
    await page.waitForTimeout(200);

    let store = await getCanvasStore(page);
    const containerId = store.nodes[0].id;

    // Add a child text node via store (not UI — avoids click-on-container issue)
    await page.evaluate((contId) => {
      const s = (window as any).__POWERNOTE_STORES__.canvas.getState();
      s.addNode({
        id: 'drag-child-1',
        type: 'text',
        x: 420, y: 340,
        width: 200, height: 30,
        parentContainerId: contId,
        data: { text: 'Child', fontSize: 16, fontFamily: 'sans-serif', fontStyle: 'normal', fill: '#1a1a1a' },
      });
    }, containerId);
    await page.waitForTimeout(100);

    // Record initial positions
    store = await getCanvasStore(page);
    const containerBefore = store.nodes.find((n: any) => n.id === containerId);
    const childBefore = store.nodes.find((n: any) => n.id === 'drag-child-1');

    const containerInitX = containerBefore.x;
    const containerInitY = containerBefore.y;
    const childInitX = childBefore.x;
    const childInitY = childBefore.y;

    // Drag the container header area
    const canvas = page.locator('[data-testid="canvas-container"] canvas');
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();

    // Container was placed at stage coords from clickCanvas(400, 300)
    // The header is at the top of the container
    const startX = box!.x + 400;
    const startY = box!.y + 300 + 16; // middle of header
    const deltaX = 100;
    const deltaY = 50;

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + deltaX, startY + deltaY, { steps: 10 });
    await page.mouse.up();
    await page.waitForTimeout(300);

    // Verify both positions changed by the same delta
    store = await getCanvasStore(page);
    const containerAfter = store.nodes.find((n: any) => n.id === containerId);
    const childAfter = store.nodes.find((n: any) => n.id === 'drag-child-1');

    const containerDeltaX = containerAfter.x - containerInitX;
    const containerDeltaY = containerAfter.y - containerInitY;
    const childDeltaX = childAfter.x - childInitX;
    const childDeltaY = childAfter.y - childInitY;

    // Both deltas should be approximately equal
    expect(Math.abs(containerDeltaX - childDeltaX)).toBeLessThan(5);
    expect(Math.abs(containerDeltaY - childDeltaY)).toBeLessThan(5);
  });
});
