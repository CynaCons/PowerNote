// Covers: REQ-AGENT-069, REQ-AGENT-070
/**
 * Test 172: read_page images[] index + read_image export
 *
 * Agents see images as a compact index (never the payload) and look at one
 * via read_image, which returns the data URI over the internal bridge.
 * File-write of that URI is MCP-server-side — covered in
 * powernote-mcp/test-multi-agent.mjs (`npm run test:bridge`).
 */
import { test, expect } from '@playwright/test';
import {
  waitForCanvasReady,
  waitForBridgeReady,
  runBridge,
  runBridgeExpectingError,
  stubBridgeUrl,
} from '../helpers';
import { READ_PAGE_RESPONSE_BUDGET } from '../../src/bridge/protocol';
import { dataUriDecodedBytes } from '../../src/utils/imageEmbed';

const TINY_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';

const SIMPLE_UML = `@startuml
component box
@enduml`;

interface ImageSnap {
  id: string;
  type: string;
  groupId?: string;
  src?: string;
  alt?: string;
  mini?: boolean;
  naturalWidth?: number;
  naturalHeight?: number;
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
      groupId: n.groupId,
      src: n.data?.src,
      alt: n.data?.alt,
      mini: n.data?.mini,
      naturalWidth: n.data?.naturalWidth,
      naturalHeight: n.data?.naturalHeight,
    };
  }, id);
}

test.describe('172 - image agent read (REQ-AGENT-069, REQ-AGENT-070)', () => {
  test.beforeEach(async ({ page }) => {
    await stubBridgeUrl(page);
    await page.goto('/');
    await waitForCanvasReady(page);
    await waitForBridgeReady(page);
  });

  test('read_page lists both images, never the payload, and leaves blocks[] intact', async ({
    page,
  }) => {
    const scrollId = await defaultScrollId(page);
    const text = await runBridge(page, 'append_block', { markdown: 'Caption block', scrollId });
    const full = await runBridge(page, 'insert_image', {
      scrollId,
      after: text.blockId,
      data: await makeDataUri(page, 80, 60),
      alt: 'full-pic',
    });
    const mini = await runBridge(page, 'insert_image', {
      scrollId,
      after: full.id,
      data: await makeDataUri(page, 120, 90, '#993333'),
      alt: 'mini-pic',
      mini: true,
    });

    const content = await runBridge(page, 'read_page');
    const wire = JSON.stringify(content);
    expect(wire).not.toContain('data:image');
    expect(content.blocks.map((b: { markdown: string }) => b.markdown)).toEqual(['Caption block']);
    expect(content.images).toHaveLength(2);

    const byId = Object.fromEntries(content.images.map((img: { id: string }) => [img.id, img]));
    expect(byId[full.id]).toBeTruthy();
    expect(byId[mini.id]).toBeTruthy();

    const fullSnap = await nodeById(page, full.id);
    const miniSnap = await nodeById(page, mini.id);
    expect(fullSnap?.src).toBeTruthy();
    expect(miniSnap?.src).toBeTruthy();

    expect(byId[full.id].alt).toBe('full-pic');
    expect(byId[full.id].mini).toBe(false);
    expect(byId[full.id].bytes).toBe(dataUriDecodedBytes(fullSnap!.src!));
    expect(byId[full.id].bytes).toBeGreaterThan(0);
    expect(byId[full.id].naturalWidth).toBe(80);
    expect(byId[full.id].naturalHeight).toBe(60);
    expect(byId[full.id].w).toBe(80);
    expect(byId[full.id].h).toBe(60);
    expect(byId[full.id].scrollId).toBe(scrollId);
    expect(byId[full.id].src).toBeUndefined();

    expect(byId[mini.id].alt).toBe('mini-pic');
    expect(byId[mini.id].mini).toBe(true);
    expect(byId[mini.id].bytes).toBe(dataUriDecodedBytes(miniSnap!.src!));
    expect(byId[mini.id].bytes).toBeGreaterThan(0);
    expect(byId[mini.id].scrollId).toBe(scrollId);
  });

  test('include images-only and scrollId filter', async ({ page }) => {
    const left = await runBridge(page, 'create_scroll', { title: 'Left pics' });
    const right = await runBridge(page, 'create_scroll', { title: 'Right pics' });
    await runBridge(page, 'append_block', { markdown: 'Keep me out', scrollId: left.scrollId });
    const leftImg = await runBridge(page, 'insert_image', {
      scrollId: left.scrollId,
      index: 0,
      data: await makeDataUri(page, 40, 30),
      alt: 'left-pic',
    });
    const rightImg = await runBridge(page, 'insert_image', {
      scrollId: right.scrollId,
      index: 0,
      data: await makeDataUri(page, 50, 40, '#226622'),
      alt: 'right-pic',
    });

    const imagesOnly = await runBridge(page, 'read_page', { include: ['images'] });
    expect(imagesOnly.blocks).toEqual([]);
    expect(imagesOnly.diagrams).toEqual([]);
    expect(imagesOnly.images.map((img: { id: string }) => img.id).sort()).toEqual(
      [leftImg.id, rightImg.id].sort(),
    );
    expect(JSON.stringify(imagesOnly)).not.toContain('data:image');

    const filtered = await runBridge(page, 'read_page', {
      include: ['images'],
      scrollId: right.scrollId,
    });
    expect(filtered.images).toHaveLength(1);
    expect(filtered.images[0].id).toBe(rightImg.id);
    expect(filtered.images[0].alt).toBe('right-pic');
    expect(filtered.images[0].scrollId).toBe(right.scrollId);
    expect(filtered.blocks).toEqual([]);
  });

  test('diagram-member image is excluded from images[]', async ({ page }) => {
    const scrollId = await defaultScrollId(page);
    const top = await runBridge(page, 'insert_image', {
      scrollId,
      index: 0,
      data: await makeDataUri(page, 32, 24),
      alt: 'top-level',
    });
    const drawn = await runBridge(page, 'create_diagram', {
      source: SIMPLE_UML,
      title: 'Owned frame',
      scrollId,
    });

    await page.evaluate(
      ({ frameId, src }) => {
        const canvas = (window as any).__POWERNOTE_STORES__.canvas;
        canvas.getState().addNode({
          id: 'diagram-owned-img',
          type: 'image',
          x: 80,
          y: 400,
          width: 40,
          height: 30,
          layer: 3,
          groupId: frameId,
          data: { src, alt: 'inside-diagram', naturalWidth: 40, naturalHeight: 30 },
        });
        const ws = (window as any).__POWERNOTE_STORES__.workspace.getState();
        ws.savePageNodes(canvas.getState().nodes);
      },
      { frameId: drawn.diagramId, src: TINY_PNG },
    );

    const content = await runBridge(page, 'read_page', { include: ['images'] });
    const ids = content.images.map((img: { id: string }) => img.id);
    expect(ids).toContain(top.id);
    expect(ids).not.toContain('diagram-owned-img');
    expect(content.images.every((img: { alt: string }) => img.alt !== 'inside-diagram')).toBe(true);
  });

  test('a page of ~200 images stays within the 20k budget', async ({ page }) => {
    await page.evaluate(
      ({ n, src }) => {
        const canvas = (window as any).__POWERNOTE_STORES__.canvas;
        const ws = (window as any).__POWERNOTE_STORES__.workspace.getState();
        const nodes = [...canvas.getState().nodes];
        for (let i = 0; i < n; i++) {
          nodes.push({
            id: `img-${String(i).padStart(3, '0')}`,
            type: 'image',
            x: 60,
            y: 48 + i * 70,
            width: 80,
            height: 60,
            layer: 3,
            data: {
              src,
              alt: `image-thumbnail-${String(i).padStart(3, '0')}`,
              naturalWidth: 80,
              naturalHeight: 60,
            },
          });
        }
        canvas.setState({ nodes });
        ws.savePageNodes(nodes);
      },
      { n: 200, src: TINY_PNG },
    );

    const content = await runBridge(page, 'read_page', { include: ['images'] });
    const wire = JSON.stringify(content);
    expect(wire.length).toBeLessThanOrEqual(READ_PAGE_RESPONSE_BUDGET);
    expect(wire).not.toContain('data:image');
    expect(content.images.length).toBeGreaterThan(0);
    if (content.images.length < 200) {
      expect(content.imagesTruncated).toBeTruthy();
      expect(content.imagesTruncated.at).toBe(content.images[content.images.length - 1].id);
      expect(content.imagesTruncated.notice).toContain(String(READ_PAGE_RESPONSE_BUDGET));
    }
  });

  test('read_image returns data URI and dims for a 300×200 PNG (app-side)', async ({ page }) => {
    const scrollId = await defaultScrollId(page);
    const data = await makeDataUri(page, 300, 200);
    const inserted = await runBridge(page, 'insert_image', {
      scrollId,
      index: 0,
      data,
      alt: 'look-at-me',
    });

    const got = await runBridge(page, 'read_image', { id: inserted.id });
    expect(got.id).toBe(inserted.id);
    expect(typeof got.src).toBe('string');
    expect(got.src.startsWith('data:image/png;base64,')).toBe(true);
    expect(got.format).toBe('png');
    expect(got.naturalWidth).toBe(300);
    expect(got.naturalHeight).toBe(200);
    expect(got.alt).toBe('look-at-me');
    expect(got.bytes).toBe(dataUriDecodedBytes(got.src));
    expect(got.bytes).toBeGreaterThan(0);

    const snap = await nodeById(page, inserted.id);
    expect(got.src).toBe(snap?.src);
    // File write is MCP-server-side; see powernote-mcp/test-multi-agent.mjs.
  });

  test('read_image errors: unknown id is NOT_FOUND; a text block is UNSUPPORTED naming text', async ({
    page,
  }) => {
    const missing = await runBridgeExpectingError(page, 'read_image', { id: 'no-such-image' });
    expect(missing.code).toBe('NOT_FOUND');
    expect(missing.message).toContain('no-such-image');

    const text = await runBridge(page, 'append_block', { markdown: 'not an image' });
    const wrong = await runBridgeExpectingError(page, 'read_image', { id: text.blockId });
    expect(wrong.code).toBe('UNSUPPORTED');
    expect(wrong.message).toContain('text');
  });
});
