// Covers: REQ-AGENT-068
/**
 * Test 171: insert_image (agent bridge)
 * Placement and occupant shift match insert_block. Source is a data URI
 * (MCP path encoding is server-side). Mini uses the chunk-1 toggle. Embed
 * pipeline downscales a 4096-wide image to 2048. Response never carries src.
 */
import { test, expect } from '@playwright/test';
import {
  waitForCanvasReady,
  waitForBridgeReady,
  runBridge,
  runBridgeExpectingError,
  stubBridgeUrl,
} from '../helpers';
import { BLOCK_GAP } from '../../src/bridge/blocks';

interface ImageSnap {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  mini?: boolean;
  miniWidth?: number;
  fullWidth?: number;
  fullHeight?: number;
  alt?: string;
  naturalWidth?: number;
  naturalHeight?: number;
  src?: string;
}

async function nodeById(
  page: import('@playwright/test').Page,
  id: string,
): Promise<ImageSnap | null> {
  return page.evaluate((id) => {
    const n = (window as any).__POWERNOTE_STORES__.canvas.getState().nodes.find((x: any) => x.id === id);
    if (!n) return null;
    return {
      id: n.id,
      type: n.type,
      x: n.x,
      y: n.y,
      width: n.width,
      height: n.height,
      mini: n.data?.mini,
      miniWidth: n.data?.miniWidth,
      fullWidth: n.data?.fullWidth,
      fullHeight: n.data?.fullHeight,
      alt: n.data?.alt,
      naturalWidth: n.data?.naturalWidth,
      naturalHeight: n.data?.naturalHeight,
      src: n.data?.src,
    };
  }, id);
}

async function yMap(page: import('@playwright/test').Page): Promise<Record<string, number>> {
  return page.evaluate(() => {
    const nodes = (window as any).__POWERNOTE_STORES__.canvas.getState().nodes as any[];
    const out: Record<string, number> = {};
    for (const n of nodes) out[n.id] = n.y;
    return out;
  });
}

async function nodeCount(page: import('@playwright/test').Page): Promise<number> {
  return page.evaluate(
    () => (window as any).__POWERNOTE_STORES__.canvas.getState().nodes.length,
  );
}

async function undoOnce(page: import('@playwright/test').Page): Promise<void> {
  await page.evaluate(() => {
    (window as any).__POWERNOTE_STORES__.canvas.getState().undo();
  });
}

async function defaultScrollId(page: import('@playwright/test').Page): Promise<string> {
  const listed = await runBridge(page, 'list_scrolls');
  const first = listed.scrolls[0];
  expect(first?.scrollId).toBeTruthy();
  return first.scrollId;
}

async function makeDataUri(
  page: import('@playwright/test').Page,
  width: number,
  height: number,
  color = '#336699',
): Promise<string> {
  return page.evaluate(
    async ({ width, height, color }) => {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, width, height);
      return canvas.toDataURL('image/png');
    },
    { width, height, color },
  );
}

test.describe('171 - insert_image (REQ-AGENT-068)', () => {
  test.beforeEach(async ({ page }) => {
    await stubBridgeUrl(page);
    await page.goto('/');
    await waitForCanvasReady(page);
    await waitForBridgeReady(page);
  });

  test('insert after a block lands below with BLOCK_GAP and shifts occupants', async ({
    page,
  }) => {
    const scrollId = await defaultScrollId(page);
    const a = await runBridge(page, 'append_block', { markdown: 'Alpha', scrollId });
    const b = await runBridge(page, 'append_block', { markdown: 'Beta', scrollId });
    const before = {
      a: await nodeById(page, a.blockId),
      b: await nodeById(page, b.blockId),
    };
    expect(before.a && before.b).toBeTruthy();

    const data = await makeDataUri(page, 80, 60);
    const inserted = await runBridge(page, 'insert_image', {
      scrollId,
      after: a.blockId,
      data,
      alt: 'agent-pic',
    });

    expect(inserted.id).toBeTruthy();
    expect(inserted.width).toBe(80);
    expect(inserted.height).toBe(60);
    expect(inserted.naturalWidth).toBe(80);
    expect(inserted.naturalHeight).toBe(60);
    expect(inserted.mini).toBe(false);
    expect(inserted.displacedCount).toBe(1);
    expect(inserted).not.toHaveProperty('src');
    expect(JSON.stringify(inserted)).not.toMatch(/data:image/);

    const img = await nodeById(page, inserted.id);
    const afterB = await nodeById(page, b.blockId);
    expect(img).toBeTruthy();
    expect(img!.type).toBe('image');
    expect(img!.y).toBe(before.a!.y + before.a!.height + BLOCK_GAP);
    expect(afterB!.y).toBe(before.b!.y + img!.height + BLOCK_GAP);
    expect(img!.alt).toBe('agent-pic');
    expect(img!.src?.startsWith('data:image/')).toBe(true);
  });

  test('mini: true lands at mini dims; displacement uses mini height', async ({ page }) => {
    const scrollId = await defaultScrollId(page);
    const a = await runBridge(page, 'append_block', { markdown: 'Above', scrollId });
    const b = await runBridge(page, 'append_block', { markdown: 'Below', scrollId });
    const beforeB = await nodeById(page, b.blockId);
    expect(beforeB).toBeTruthy();

    const data = await makeDataUri(page, 300, 200);
    const inserted = await runBridge(page, 'insert_image', {
      scrollId,
      after: a.blockId,
      data,
      mini: true,
    });

    expect(inserted.mini).toBe(true);
    expect(inserted.width).toBe(160);
    expect(inserted.naturalWidth).toBe(300);
    expect(inserted.naturalHeight).toBe(200);

    const img = await nodeById(page, inserted.id);
    expect(img).toBeTruthy();
    expect(img!.mini).toBe(true);
    expect(img!.width).toBe(160);
    expect(img!.height).toBeCloseTo(160 * (200 / 300), 5);
    expect(img!.miniWidth).toBe(160);
    expect(img!.fullWidth).toBe(300);
    expect(img!.fullHeight).toBe(200);

    const afterB = await nodeById(page, b.blockId);
    expect(afterB!.y).toBe(beforeB!.y + img!.height + BLOCK_GAP);
    expect(inserted.displacedCount).toBe(1);
  });

  test('oversized data URI is downscaled to 2048 natural width', async ({ page }) => {
    test.setTimeout(60_000);
    const scrollId = await defaultScrollId(page);
    const data = await makeDataUri(page, 4096, 1024, '#cc0000');
    const inserted = await runBridge(page, 'insert_image', {
      scrollId,
      index: 0,
      data,
    });

    expect(inserted.naturalWidth).toBe(2048);
    expect(inserted.naturalHeight).toBe(512);
    const img = await nodeById(page, inserted.id);
    expect(img?.naturalWidth).toBe(2048);
    expect(img?.naturalHeight).toBe(512);
    expect(img?.src?.startsWith('data:image/')).toBe(true);
  });

  test('param errors: both/neither source, bad data URI, unknown scroll, both after+index', async ({
    page,
  }) => {
    const scrollId = await defaultScrollId(page);
    const a = await runBridge(page, 'append_block', { markdown: 'Keep', scrollId });
    const data = await makeDataUri(page, 32, 24);
    const before = await nodeCount(page);

    const bothSources = await runBridgeExpectingError(page, 'insert_image', {
      scrollId,
      after: a.blockId,
      data,
      path: 'C:\\\\tmp\\\\x.png',
    });
    expect(bothSources.code).toBe('BAD_PARAMS');
    expect(bothSources.message.toLowerCase()).toMatch(/data/);
    expect(bothSources.message.toLowerCase()).toMatch(/path/);

    const neither = await runBridgeExpectingError(page, 'insert_image', {
      scrollId,
      after: a.blockId,
    });
    expect(neither.code).toBe('BAD_PARAMS');

    const notUri = await runBridgeExpectingError(page, 'insert_image', {
      scrollId,
      after: a.blockId,
      data: 'https://example.com/x.png',
    });
    expect(notUri.code).toBe('BAD_PARAMS');
    expect(notUri.message.toLowerCase()).toMatch(/data:image/);

    const badScroll = await runBridgeExpectingError(page, 'insert_image', {
      scrollId: 'no-such-scroll',
      index: 0,
      data,
    });
    expect(badScroll.code).toBe('NOT_FOUND');
    expect(badScroll.message).toContain('no-such-scroll');

    const bothAnchors = await runBridgeExpectingError(page, 'insert_image', {
      scrollId,
      after: a.blockId,
      index: 0,
      data,
    });
    expect(bothAnchors.code).toBe('BAD_PARAMS');
    expect(bothAnchors.message.toLowerCase()).toMatch(/after/);
    expect(bothAnchors.message.toLowerCase()).toMatch(/index/);

    expect(await nodeCount(page)).toBe(before);
  });

  test('one undo restores: image gone, displaced occupants back at prior y', async ({
    page,
  }) => {
    const scrollId = await defaultScrollId(page);
    const a = await runBridge(page, 'append_block', { markdown: 'A', scrollId });
    const b = await runBridge(page, 'append_block', { markdown: 'B', scrollId });
    const original = await yMap(page);
    const beforeCount = await nodeCount(page);

    const data = await makeDataUri(page, 80, 40);
    const inserted = await runBridge(page, 'insert_image', {
      scrollId,
      after: a.blockId,
      data,
    });
    expect(await nodeById(page, inserted.id)).toBeTruthy();
    expect((await nodeById(page, b.blockId))!.y).not.toBe(original[b.blockId]);

    await undoOnce(page);

    expect(await nodeById(page, inserted.id)).toBeNull();
    expect(await nodeCount(page)).toBe(beforeCount);
    expect(await yMap(page)).toEqual(original);
  });
});
