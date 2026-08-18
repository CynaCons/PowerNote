/**
 * Test 110: Column-flow reflow (scroll bands pack like a column)
 * Covers: REQ-DIAG-002..005, REQ-AGENT-067
 *
 * On a column page (scroll guide, or any titled scroll) insert/height-change
 * moves every occupant — including diagram frames and their members.
 * Loose marks still ride the stack. A pages/grid/none sheet with only the
 * default untitled scroll stays freeform (that contract is T161).
 */
import { test, expect } from '@playwright/test';
import {
  waitForCanvasReady,
  waitForBridgeReady,
  runBridge,
  stubBridgeUrl,
} from '../helpers';
import { BLOCK_GAP } from '../../src/bridge/blocks';

const SIMPLE = `@startuml
component A
component B
A --> B
@enduml`;

test.describe('110 - Column reflow (REQ-DIAG-002..005)', () => {
  test.beforeEach(async ({ page }) => {
    await stubBridgeUrl(page);
    await page.goto('/');
    await waitForCanvasReady(page);
    await waitForBridgeReady(page);
  });

  test('scroll guide: insert above a diagram moves the frame and its members', async ({ page }) => {
    await runBridge(page, 'set_background', { guideStyle: 'scroll' });
    const scroll = await runBridge(page, 'list_scrolls');
    const scrollId = scroll.scrolls[0].scrollId;

    const above = await runBridge(page, 'append_block', { markdown: 'Above', scrollId });
    const drawn = await runBridge(page, 'create_diagram', {
      source: SIMPLE,
      title: 'Loop',
      scrollId,
    });
    const below = await runBridge(page, 'append_block', { markdown: 'Below', scrollId });
    await page.waitForTimeout(150);

    const before = await page.evaluate((frameId) => {
      const nodes = (window as any).__POWERNOTE_STORES__.canvas.getState().nodes as any[];
      const frame = nodes.find((n) => n.id === frameId);
      const members = nodes
        .filter((n) => n.groupId === frameId && n.id !== frameId)
        .map((n) => ({ id: n.id, y: n.y }));
      return { frameY: frame.y, frameH: frame.height, members };
    }, drawn.diagramId);

    const inserted = await runBridge(page, 'insert_block', {
      scrollId,
      markdown: 'Between',
      after: above.blockId,
    });
    // TextNode measures ~60ms later and may pack the band again by the delta.
    await page.waitForTimeout(150);
    const neu = await page.evaluate((id) => {
      return (window as any).__POWERNOTE_STORES__.canvas.getState().nodes.find((n: any) => n.id === id);
    }, inserted.blockId);

    const after = await page.evaluate((frameId) => {
      const nodes = (window as any).__POWERNOTE_STORES__.canvas.getState().nodes as any[];
      const frame = nodes.find((n) => n.id === frameId);
      const members = nodes
        .filter((n) => n.groupId === frameId && n.id !== frameId)
        .map((n) => ({ id: n.id, y: n.y }));
      return { frameY: frame.y, members };
    }, drawn.diagramId);

    const dy = neu.height + BLOCK_GAP;
    expect(after.frameY).toBe(before.frameY + dy);
    expect(after.members.length).toBe(before.members.length);
    for (const m of before.members) {
      const moved = after.members.find((x: { id: string }) => x.id === m.id);
      expect(moved?.y).toBe(m.y + dy);
    }

    const belowNode = await page.evaluate((id) => {
      return (window as any).__POWERNOTE_STORES__.canvas.getState().nodes.find((n: any) => n.id === id);
    }, below.blockId);
    expect(belowNode.y).toBeGreaterThan(after.frameY);
  });

  test('titled scroll on a pages guide also packs the band', async ({ page }) => {
    const named = await runBridge(page, 'create_scroll', { title: 'Notes' });
    await runBridge(page, 'append_block', { markdown: 'Head', scrollId: named.scrollId });
    const drawn = await runBridge(page, 'create_diagram', {
      source: SIMPLE,
      title: 'In notes',
      scrollId: named.scrollId,
    });
    await page.waitForTimeout(150);
    const beforeY = await page.evaluate((id) => {
      return (window as any).__POWERNOTE_STORES__.canvas.getState().nodes.find((n: any) => n.id === id).y;
    }, drawn.diagramId);

    const inserted = await runBridge(page, 'insert_block', {
      scrollId: named.scrollId,
      markdown: 'New top',
      index: 0,
    });
    await page.waitForTimeout(150);
    const neu = await page.evaluate((id) => {
      return (window as any).__POWERNOTE_STORES__.canvas.getState().nodes.find((n: any) => n.id === id);
    }, inserted.blockId);
    const afterY = await page.evaluate((id) => {
      return (window as any).__POWERNOTE_STORES__.canvas.getState().nodes.find((n: any) => n.id === id).y;
    }, drawn.diagramId);
    expect(afterY).toBe(beforeY + neu.height + BLOCK_GAP);
  });

  test('pages guide with only the untitled scroll does not move a diagram', async ({ page }) => {
    const scroll = await runBridge(page, 'list_scrolls');
    const scrollId = scroll.scrolls[0].scrollId;
    const above = await runBridge(page, 'append_block', { markdown: 'Above', scrollId });
    const drawn = await runBridge(page, 'create_diagram', {
      source: SIMPLE,
      title: 'Stay',
      scrollId,
    });
    const beforeY = await page.evaluate((id) => {
      return (window as any).__POWERNOTE_STORES__.canvas.getState().nodes.find((n: any) => n.id === id).y;
    }, drawn.diagramId);
    await runBridge(page, 'insert_block', {
      scrollId,
      markdown: 'Between',
      after: above.blockId,
    });
    const afterY = await page.evaluate((id) => {
      return (window as any).__POWERNOTE_STORES__.canvas.getState().nodes.find((n: any) => n.id === id).y;
    }, drawn.diagramId);
    expect(afterY).toBe(beforeY);
  });
});
