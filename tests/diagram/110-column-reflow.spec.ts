/**
 * Test 110: Column-flow reflow (scroll bands pack like a column)
 * Covers: REQ-DIAG-002..005, REQ-AGENT-067, REQ-AGENT-062
 *
 * Insert/move/height-change move every occupant of the target scroll —
 * including diagram frames and their members. Loose marks ride the stack.
 * Guide style is visual: a default pages notebook packs the same way.
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

  test('pages guide with only the untitled scroll still moves a diagram', async ({ page }) => {
    const scroll = await runBridge(page, 'list_scrolls');
    const scrollId = scroll.scrolls[0].scrollId;
    const above = await runBridge(page, 'append_block', { markdown: 'Above', scrollId });
    const drawn = await runBridge(page, 'create_diagram', {
      source: SIMPLE,
      title: 'Stay',
      scrollId,
    });
    await page.waitForTimeout(150);
    const beforeY = await page.evaluate((id) => {
      return (window as any).__POWERNOTE_STORES__.canvas.getState().nodes.find((n: any) => n.id === id).y;
    }, drawn.diagramId);
    const inserted = await runBridge(page, 'insert_block', {
      scrollId,
      markdown: 'Between',
      after: above.blockId,
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

  test('update_block growing a note above a diagram shoves the frame; shrinking closes the gap', async ({ page }) => {
    const scroll = await runBridge(page, 'list_scrolls');
    const scrollId = scroll.scrolls[0].scrollId;
    const above = await runBridge(page, 'append_block', { markdown: 'Above', scrollId });
    const drawn = await runBridge(page, 'create_diagram', {
      source: SIMPLE,
      title: 'Loop',
      scrollId,
    });
    await page.waitForTimeout(150);

    const snap = async () =>
      page.evaluate((ids: { frameId: string; textId: string }) => {
        const nodes = (window as any).__POWERNOTE_STORES__.canvas.getState().nodes as any[];
        const frame = nodes.find((n) => n.id === ids.frameId);
        const text = nodes.find((n) => n.id === ids.textId);
        const members = nodes
          .filter((n) => n.groupId === ids.frameId && n.id !== ids.frameId)
          .map((n) => ({ id: n.id, dy: n.y - frame.y }));
        return { frameY: frame.y, textH: text.height, members };
      }, { frameId: drawn.diagramId, textId: above.blockId });

    const before = await snap();
    const longMd = Array.from({ length: 12 }, (_, i) => `- item ${i}`).join('\n');
    const grown = await runBridge(page, 'update_block', {
      blockId: above.blockId,
      markdown: longMd,
    });
    expect(grown.displacedCount).toBeGreaterThan(0);
    await page.waitForTimeout(150);

    const afterGrow = await snap();
    const growDy = afterGrow.textH - before.textH;
    expect(growDy).toBeGreaterThan(2);
    expect(afterGrow.frameY).toBe(before.frameY + growDy);
    expect(afterGrow.members.length).toBe(before.members.length);
    for (const m of before.members) {
      const moved = afterGrow.members.find((x: { id: string }) => x.id === m.id);
      expect(moved?.dy).toBe(m.dy);
    }

    await runBridge(page, 'update_block', {
      blockId: above.blockId,
      markdown: 'Above',
    });
    await page.waitForTimeout(150);
    const afterShrink = await snap();
    expect(afterShrink.frameY).toBe(before.frameY);
    for (const m of before.members) {
      const moved = afterShrink.members.find((x: { id: string }) => x.id === m.id);
      expect(moved?.dy).toBe(m.dy);
    }
  });

  test('move_block of a text block above a diagram shoves the frame; moving the frame rides members', async ({ page }) => {
    const scroll = await runBridge(page, 'list_scrolls');
    const scrollId = scroll.scrolls[0].scrollId;
    const above = await runBridge(page, 'append_block', { markdown: 'Above', scrollId });
    const drawn = await runBridge(page, 'create_diagram', {
      source: SIMPLE,
      title: 'Loop',
      scrollId,
    });
    await page.waitForTimeout(150);

    const origin = await page.evaluate((frameId) => {
      const nodes = (window as any).__POWERNOTE_STORES__.canvas.getState().nodes as any[];
      const frame = nodes.find((n) => n.id === frameId);
      const members = nodes
        .filter((n) => n.groupId === frameId && n.id !== frameId)
        .map((n) => ({ id: n.id, dx: n.x - frame.x, dy: n.y - frame.y }));
      return { members };
    }, drawn.diagramId);

    await runBridge(page, 'move_block', {
      blockId: above.blockId,
      index: 1,
    });
    await page.waitForTimeout(150);

    const afterSwap = await page.evaluate((ids: { frameId: string; textId: string }) => {
      const nodes = (window as any).__POWERNOTE_STORES__.canvas.getState().nodes as any[];
      const frame = nodes.find((n) => n.id === ids.frameId);
      const text = nodes.find((n) => n.id === ids.textId);
      return { frameY: frame.y, textY: text.y };
    }, { frameId: drawn.diagramId, textId: above.blockId });

    expect(afterSwap.frameY).toBeLessThan(afterSwap.textY);

    const moved = await runBridge(page, 'move_block', {
      blockId: drawn.diagramId,
      after: above.blockId,
    });
    expect(moved.blockId).toBe(drawn.diagramId);
    await page.waitForTimeout(150);

    const afterMove = await page.evaluate((frameId) => {
      const nodes = (window as any).__POWERNOTE_STORES__.canvas.getState().nodes as any[];
      const frame = nodes.find((n) => n.id === frameId);
      const members = nodes
        .filter((n) => n.groupId === frameId && n.id !== frameId)
        .map((n) => ({ id: n.id, x: n.x, y: n.y }));
      return { frameY: frame.y, frameX: frame.x, members };
    }, drawn.diagramId);

    expect(afterMove.members.length).toBe(origin.members.length);
    for (const m of origin.members) {
      const movedMember = afterMove.members.find((x: { id: string }) => x.id === m.id);
      expect(movedMember?.x).toBe(afterMove.frameX + m.dx);
      expect(movedMember?.y).toBe(afterMove.frameY + m.dy);
    }
  });

  test('chained update_block then insert_block with no wait does not overlap the diagram', async ({ page }) => {
    const scroll = await runBridge(page, 'list_scrolls');
    const scrollId = scroll.scrolls[0].scrollId;
    const above = await runBridge(page, 'append_block', { markdown: 'Head', scrollId });
    const drawn = await runBridge(page, 'create_diagram', {
      source: SIMPLE,
      title: 'Chain',
      scrollId,
    });
    const longMd = Array.from({ length: 12 }, (_, i) => `- item ${i}`).join('\n');
    await runBridge(page, 'update_block', { blockId: above.blockId, markdown: longMd });
    const inserted = await runBridge(page, 'insert_block', {
      scrollId,
      markdown: 'Between',
      after: above.blockId,
    });

    const pos = await page.evaluate((ids: { head: string; mid: string; frame: string }) => {
      const nodes = (window as any).__POWERNOTE_STORES__.canvas.getState().nodes as any[];
      const head = nodes.find((n) => n.id === ids.head);
      const mid = nodes.find((n) => n.id === ids.mid);
      const frame = nodes.find((n) => n.id === ids.frame);
      return {
        headY: head.y, headH: head.height,
        midY: mid.y, midH: mid.height,
        frameY: frame.y, frameH: frame.height,
      };
    }, { head: above.blockId, mid: inserted.blockId, frame: drawn.diagramId });

    expect(pos.midY).toBeGreaterThanOrEqual(pos.headY + pos.headH);
    expect(pos.frameY).toBeGreaterThanOrEqual(pos.midY + pos.midH);
  });

  test('insert after a diagram frame id lands below the frame and shoves notes under it', async ({ page }) => {
    const scroll = await runBridge(page, 'list_scrolls');
    const scrollId = scroll.scrolls[0].scrollId;
    await runBridge(page, 'append_block', { markdown: 'Head', scrollId });
    const drawn = await runBridge(page, 'create_diagram', {
      source: SIMPLE,
      title: 'Anchor',
      scrollId,
    });
    const below = await runBridge(page, 'append_block', { markdown: 'Tail', scrollId });
    const beforeBelow = await page.evaluate((id) => {
      return (window as any).__POWERNOTE_STORES__.canvas.getState().nodes.find((n: any) => n.id === id);
    }, below.blockId);

    const inserted = await runBridge(page, 'insert_block', {
      scrollId,
      markdown: 'Under diagram',
      after: drawn.diagramId,
    });
    const neu = await page.evaluate((ids: { mid: string; frame: string; tail: string }) => {
      const nodes = (window as any).__POWERNOTE_STORES__.canvas.getState().nodes as any[];
      const mid = nodes.find((n) => n.id === ids.mid);
      const frame = nodes.find((n) => n.id === ids.frame);
      const tail = nodes.find((n) => n.id === ids.tail);
      return { midY: mid.y, midH: mid.height, frameY: frame.y, frameH: frame.height, tailY: tail.y };
    }, { mid: inserted.blockId, frame: drawn.diagramId, tail: below.blockId });

    expect(neu.midY).toBeGreaterThanOrEqual(neu.frameY + neu.frameH);
    expect(neu.tailY).toBe(beforeBelow.y + neu.midH + BLOCK_GAP);
  });

  test('delete_diagram closes the gap so the note below packs up', async ({ page }) => {
    const scroll = await runBridge(page, 'list_scrolls');
    const scrollId = scroll.scrolls[0].scrollId;
    const above = await runBridge(page, 'append_block', { markdown: 'Head', scrollId });
    const drawn = await runBridge(page, 'create_diagram', {
      source: SIMPLE,
      title: 'Gone',
      scrollId,
    });
    const below = await runBridge(page, 'append_block', { markdown: 'Tail', scrollId });
    const before = await page.evaluate((ids: { head: string; frame: string; tail: string }) => {
      const nodes = (window as any).__POWERNOTE_STORES__.canvas.getState().nodes as any[];
      const head = nodes.find((n) => n.id === ids.head);
      const frame = nodes.find((n) => n.id === ids.frame);
      const tail = nodes.find((n) => n.id === ids.tail);
      return { headY: head.y, headH: head.height, frameH: frame.height, tailY: tail.y };
    }, { head: above.blockId, frame: drawn.diagramId, tail: below.blockId });

    await runBridge(page, 'delete_diagram', { diagramId: drawn.diagramId, confirm: true });
    const after = await page.evaluate((id) => {
      const nodes = (window as any).__POWERNOTE_STORES__.canvas.getState().nodes as any[];
      const tail = nodes.find((n) => n.id === id);
      const gone = nodes.find((n) => n.type === 'diagram');
      return { tailY: tail.y, diagramLeft: !!gone };
    }, below.blockId);

    expect(after.diagramLeft).toBe(false);
    expect(after.tailY).toBe(before.headY + before.headH + BLOCK_GAP);
    expect(after.tailY).toBeLessThan(before.tailY);
  });
});
