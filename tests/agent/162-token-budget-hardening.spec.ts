/**
 * Test 162: token-budget hardening — no read can exceed the budget
 * Covers: REQ-AGENT-063, REQ-AGENT-064, REQ-AGENT-065
 *
 * The v0.54 read_page budget fixed the common case. These cases close the
 * remaining holes: unbounded read_diagram members, opt-in sources escaping
 * read_page, a single block larger than the budget, and the absolute
 * invariant on every read response.
 */
import { test, expect } from '@playwright/test';
import {
  waitForCanvasReady,
  waitForBridgeReady,
  runBridge,
  runBridgeExpectingError,
} from '../helpers';
import {
  READ_DIAGRAM_DEFAULT_MEMBER_LIMIT,
  READ_PAGE_RESPONSE_BUDGET,
} from '../../src/bridge/protocol';

const MEMBER_COUNT = 320;
const GIANT_BLOCK_CHARS = 30_000;

/** Same grid builder as T153's 200-cell export-closure case. */
function mxfileGrid(count: number): string {
  const cells: string[] = [];
  for (let i = 0; i < count; i += 1) {
    const x = (i % 20) * 50;
    const y = Math.floor(i / 20) * 40;
    cells.push(
      `<mxCell id="c${i}" value="" style="rounded=0;fillColor=#${(0x101010 + i).toString(16).slice(0, 6)};" vertex="1" parent="1">` +
        `<mxGeometry x="${x}" y="${y}" width="36" height="24" as="geometry"/></mxCell>`,
    );
  }
  return (
    `<mxfile host="app.diagrams.net"><diagram name="Grid"><mxGraphModel><root>` +
    `<mxCell id="0"/><mxCell id="1" parent="0"/>${cells.join('')}` +
    `</root></mxGraphModel></diagram></mxfile>`
  );
}

async function plantPage(
  page: import('@playwright/test').Page,
  spec: {
    members?: number;
    memberSource?: string;
    hugeSources?: string[];
    giantBlock?: number;
    mediumBlocks?: number;
  },
): Promise<{ frameId: string | null; memberIds: string[]; giantBlockId: string | null }> {
  return page.evaluate((spec) => {
    const canvas = (window as any).__POWERNOTE_STORES__.canvas;
    const ws = (window as any).__POWERNOTE_STORES__.workspace.getState();
    const nodes: any[] = [];
    let y = 48;
    let giantBlockId: string | null = null;
    const memberIds: string[] = [];
    let frameId: string | null = null;

    if (spec.giantBlock && spec.giantBlock > 0) {
      giantBlockId = 'giant-block';
      nodes.push({
        id: giantBlockId,
        type: 'text',
        x: 60,
        y,
        width: 794,
        height: 400,
        layer: 4,
        data: {
          text: 'G'.repeat(spec.giantBlock),
          fontSize: 16,
          fontFamily: 'Inter',
          fontStyle: 'normal',
          fill: '#111',
        },
      });
      y += 420;
    }

    for (let i = 0; i < (spec.mediumBlocks ?? 0); i++) {
      nodes.push({
        id: `med-${i}`,
        type: 'text',
        x: 60,
        y,
        width: 794,
        height: 32,
        layer: 4,
        data: {
          text: `${'W'.repeat(800)}-${i}`,
          fontSize: 16,
          fontFamily: 'Inter',
          fontStyle: 'normal',
          fill: '#111',
        },
      });
      y += 40;
    }

    if (spec.members && spec.members > 0) {
      frameId = 'huge-diag';
      nodes.push({
        id: frameId,
        type: 'diagram',
        x: 60,
        y,
        width: 800,
        height: 400,
        layer: 2,
        groupId: frameId,
        data: { source: spec.memberSource ?? '@startuml\ncomponent box\n@enduml', title: 'Huge grid' },
      });
      for (let i = 0; i < spec.members; i++) {
        const id = `m-${String(i).padStart(4, '0')}`;
        memberIds.push(id);
        const isText = i % 7 === 0;
        nodes.push({
          id,
          type: isText ? 'text' : 'shape',
          x: 80 + (i % 20) * 40,
          y: y + 40 + Math.floor(i / 20) * 28,
          width: 36,
          height: 24,
          layer: 3,
          groupId: frameId,
          data: isText
            ? {
                text: `label-${i}`,
                fontSize: 12,
                fontFamily: 'Inter',
                fontStyle: 'normal',
                fill: '#111',
              }
            : {
                shapeType: 'rect',
                fill: '#eef1f0',
                stroke: '#14181a',
                strokeWidth: 1,
                strokeDash: [],
              },
        });
      }
      y += 480;
    }

    (spec.hugeSources ?? []).forEach((source, i) => {
      const id = `src-diag-${i}`;
      nodes.push({
        id,
        type: 'diagram',
        x: 60,
        y,
        width: 260,
        height: 140,
        layer: 2,
        groupId: id,
        data: { source, title: `Fat source ${i}` },
      });
      y += 160;
    });

    canvas.setState({ nodes });
    ws.savePageNodes(nodes);
    return { frameId, memberIds, giantBlockId };
  }, spec);
}

function wireLength(value: unknown): number {
  return JSON.stringify(value).length;
}

test.describe('162 - token-budget hardening (REQ-AGENT-063, REQ-AGENT-064, REQ-AGENT-065)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForCanvasReady(page);
    await waitForBridgeReady(page);
  });

  test('read_diagram pages 320 members within budget and walks each exactly once', async ({
    page,
  }) => {
    const typicalMemberWire = JSON.stringify({
      id: 'member-0000',
      type: 'shape',
      x: 1234.56,
      y: 1234.56,
      w: 120,
      h: 48,
    });
    expect(READ_DIAGRAM_DEFAULT_MEMBER_LIMIT).toBe(
      Math.max(1, Math.floor(READ_PAGE_RESPONSE_BUDGET / 2 / typicalMemberWire.length)),
    );

    const planted = await plantPage(page, {
      members: MEMBER_COUNT,
      memberSource: '@startuml\ncomponent box\n@enduml',
    });
    expect(planted.memberIds).toHaveLength(MEMBER_COUNT);

    const seen: string[] = [];
    let cursor: string | undefined;
    let pages = 0;
    for (let i = 0; i < 20; i++) {
      const detail = await runBridge(page, 'read_diagram', {
        diagramId: planted.frameId,
        ...(cursor ? { member_cursor: cursor } : {}),
      });
      pages += 1;
      expect(wireLength(detail)).toBeLessThanOrEqual(READ_PAGE_RESPONSE_BUDGET);
      expect(detail.memberCount).toBe(MEMBER_COUNT);
      expect(detail.sourceTruncated).toBeUndefined();
      const chunk: string[] = detail.members.map((m: { id: string }) => m.id);
      expect(new Set(chunk).size).toBe(chunk.length);
      expect(chunk.length).toBeGreaterThan(0);
      expect(chunk.length).toBeLessThanOrEqual(READ_DIAGRAM_DEFAULT_MEMBER_LIMIT);
      seen.push(...chunk);
      if (!detail.nextCursor) break;
      cursor = detail.nextCursor;
    }

    expect(pages).toBeGreaterThan(1);
    expect(seen).toEqual(planted.memberIds);
    expect(new Set(seen).size).toBe(MEMBER_COUNT);
  });

  test('read_page drops over-budget sources with sourceOmitted notices', async ({ page }) => {
    const fat = mxfileGrid(200);
    expect(fat.length).toBeGreaterThan(READ_PAGE_RESPONSE_BUDGET);

    await plantPage(page, { hugeSources: [fat, fat, fat] });

    const content = await runBridge(page, 'read_page', {
      include: ['diagrams'],
      include_diagram_source: true,
    });
    expect(wireLength(content)).toBeLessThanOrEqual(READ_PAGE_RESPONSE_BUDGET);
    expect(content.diagrams.length).toBeGreaterThan(0);
    const omitted = content.diagrams.filter((d: { sourceOmitted?: { length: number; notice: string } }) => d.sourceOmitted);
    expect(omitted.length).toBeGreaterThan(0);
    for (const d of omitted) {
      expect(d.source).toBeUndefined();
      expect(d.sourceOmitted.length).toBe(fat.length);
      expect(d.sourceOmitted.notice).toBe('use read_diagram');
    }
  });

  test('a 30k-char block is truncated by read_page and get_block', async ({ page }) => {
    const planted = await plantPage(page, { giantBlock: GIANT_BLOCK_CHARS });
    expect(planted.giantBlockId).toBe('giant-block');

    const content = await runBridge(page, 'read_page', { include: ['blocks'] });
    expect(wireLength(content)).toBeLessThanOrEqual(READ_PAGE_RESPONSE_BUDGET);
    expect(content.blocks).toHaveLength(1);
    expect(content.blocks[0].markdownTruncated).toBeTruthy();
    expect(content.blocks[0].markdownTruncated.fullLength).toBe(GIANT_BLOCK_CHARS);
    expect(content.blocks[0].markdownTruncated.notice).toContain(String(GIANT_BLOCK_CHARS));
    expect(content.blocks[0].markdown.length).toBeLessThan(GIANT_BLOCK_CHARS);
    expect(content.blocks[0].markdown.length).toBeGreaterThan(0);

    const got = await runBridge(page, 'get_block', { blockId: 'giant-block' });
    expect(wireLength(got)).toBeLessThanOrEqual(READ_PAGE_RESPONSE_BUDGET);
    expect(got.markdownTruncated).toBeTruthy();
    expect(got.markdownTruncated.fullLength).toBe(GIANT_BLOCK_CHARS);
    expect(got.markdownTruncated.notice).toContain(String(GIANT_BLOCK_CHARS));
    expect(got.markdown.length).toBeLessThan(GIANT_BLOCK_CHARS);
  });

  test('worst page from the T153 grid generator stays within budget on every read', async ({
    page,
  }) => {
    const fat = mxfileGrid(200);
    const planted = await plantPage(page, {
      members: MEMBER_COUNT,
      memberSource: fat,
      hugeSources: [fat, fat],
      giantBlock: GIANT_BLOCK_CHARS,
      mediumBlocks: 20,
    });

    const reads: unknown[] = [];
    reads.push(await runBridge(page, 'read_page'));
    reads.push(
      await runBridge(page, 'read_page', {
        include: ['blocks', 'diagrams'],
        include_diagram_source: true,
      }),
    );
    reads.push(await runBridge(page, 'read_page', { include: ['diagrams'], include_diagram_source: true }));
    reads.push(await runBridge(page, 'get_block', { blockId: planted.giantBlockId }));

    let cursor: string | undefined;
    for (let i = 0; i < 8; i++) {
      const detail = await runBridge(page, 'read_diagram', {
        diagramId: planted.frameId,
        ...(cursor ? { member_cursor: cursor } : {}),
      });
      reads.push(detail);
      if (i === 0) {
        // Fat T153 source alone exceeds the budget; the notice names the
        // full length and points at a .drawio export.
        expect(detail.sourceTruncated).toBeTruthy();
        expect(detail.sourceTruncated.fullLength).toBe(fat.length);
        expect(detail.sourceTruncated.notice).toMatch(/drawio/i);
        expect(detail.source.length).toBeLessThan(fat.length);
      }
      if (!detail.nextCursor) break;
      cursor = detail.nextCursor;
    }

    for (const srcId of ['src-diag-0', 'src-diag-1']) {
      reads.push(await runBridge(page, 'read_diagram', { diagramId: srcId }));
    }

    const lengths = reads.map(wireLength);
    for (const n of lengths) {
      expect(n).toBeLessThanOrEqual(READ_PAGE_RESPONSE_BUDGET);
    }
  });

  test('get_block offset paging reassembles a giant block exactly (REQ-AGENT-066)', async ({
    page,
  }) => {
    // The budget truncates a CALL, never strands content: a block of any
    // size is fully readable in slices. Numbered lines make off-by-one slice
    // bugs corrupt the reassembly, not slip through it.
    const giant = Array.from({ length: 1500 }, (_, i) => `line ${i} of the monster block`).join(
      '\n',
    );
    const placed = await runBridge(page, 'append_block', { markdown: giant });

    let assembled = '';
    let offset: number | undefined;
    for (let i = 0; i < 20; i++) {
      const slice = await runBridge(page, 'get_block', {
        blockId: placed.blockId,
        ...(offset !== undefined ? { offset } : {}),
      });
      assembled += slice.markdown;
      if (slice.nextOffset === undefined) break;
      expect(slice.markdownTruncated.fullLength).toBe(giant.length);
      offset = slice.nextOffset;
    }

    expect(assembled).toBe(giant);

    const past = await runBridgeExpectingError(page, 'get_block', {
      blockId: placed.blockId,
      offset: giant.length + 1,
    });
    expect(past.code).toBe('BAD_PARAMS');
  });
});
