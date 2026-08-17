/**
 * Test 155: Deleting a diagram frame cascades to members and grouped ink
 * Covers: REQ-DIAG-140, REQ-DIAG-141, REQ-AGENT-051
 *
 * Every delete path used to strand the members: context-menu Delete called
 * deleteNode on the frame alone, the delete key only removed what was
 * selected, and the bridge had no diagram verb at all. The cascade lives in
 * the store primitive so every caller inherits it.
 */
import { test, expect } from '@playwright/test';
import {
  getCanvasStore,
  waitForCanvasReady,
  waitForBridgeReady,
  runBridge,
  runBridgeExpectingError,
} from '../helpers';

const FRAME = 'diag-frame';
const MEMBER = 'diag-member';
const ORPHAN = 'orphan-block';
const GROUP_INK = 'ink-grouped';
const LOOSE_INK = 'ink-loose';

async function seedDiagram(page: import('@playwright/test').Page) {
  await page.evaluate(
    ({ frame, member, orphan, groupInk, looseInk }) => {
      const S = (window as any).__POWERNOTE_STORES__;
      S.canvas.setState({
        nodes: [
          {
            id: frame,
            type: 'diagram',
            x: 300,
            y: 300,
            width: 260,
            height: 160,
            layer: 2,
            groupId: frame,
            data: { source: '', title: 'Cascade' },
          },
          {
            id: member,
            type: 'shape',
            x: 320,
            y: 350,
            width: 80,
            height: 40,
            layer: 3,
            groupId: frame,
            data: {
              shapeType: 'rect',
              fill: '#eef1f0',
              stroke: '#14181a',
              strokeWidth: 1.6,
              strokeDash: [],
            },
          },
          {
            id: orphan,
            type: 'text',
            x: 620,
            y: 300,
            width: 160,
            height: 40,
            layer: 4,
            data: {
              text: 'stays',
              fontSize: 16,
              fontFamily: 'Inter',
              fontStyle: 'normal',
              fill: '#111',
            },
          },
        ],
        selectedNodeIds: [],
      });
      S.draw.setState({
        strokes: [
          {
            id: groupInk,
            points: [340, 380, 360, 400],
            color: '#14181A',
            strokeWidth: 2,
            groupId: frame,
          },
          {
            id: looseInk,
            points: [700, 320, 720, 340],
            color: '#B4552D',
            strokeWidth: 2,
          },
        ],
        selectedStrokeIds: [],
      });
      S.workspace.getState().savePageNodes(S.canvas.getState().nodes);
      S.workspace.getState().savePageStrokes(S.draw.getState().strokes);
    },
    { frame: FRAME, member: MEMBER, orphan: ORPHAN, groupInk: GROUP_INK, looseInk: LOOSE_INK },
  );
}

async function snapshot(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const S = (window as any).__POWERNOTE_STORES__;
    return {
      nodeIds: S.canvas.getState().nodes.map((n: any) => n.id).sort(),
      strokeIds: S.draw.getState().strokes.map((s: any) => s.id).sort(),
    };
  });
}

test.describe('155 - Diagram deletion cascade (REQ-DIAG-140, REQ-DIAG-141)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForCanvasReady(page);
    await waitForBridgeReady(page);
    await seedDiagram(page);
  });

  test('delete key on the frame removes members and grouped ink, leaves the rest', async ({
    page,
  }) => {
    await page.evaluate((id) => {
      (window as any).__POWERNOTE_STORES__.canvas.setState({ selectedNodeIds: [id] });
    }, FRAME);
    await page.keyboard.press('Delete');

    const after = await snapshot(page);
    expect(after.nodeIds).toEqual([ORPHAN]);
    expect(after.strokeIds).toEqual([LOOSE_INK]);
  });

  test('context-menu Delete on the frame inherits the same cascade', async ({ page }) => {
    const canvas = page.locator('[data-testid="canvas-container"] canvas').last();
    await canvas.click({ position: { x: 360, y: 330 }, button: 'right' });
    await expect(page.getByTestId('context-menu')).toBeVisible();
    await page.locator('[data-testid="context-menu"] .context-menu__item--danger').click();

    const after = await snapshot(page);
    expect(after.nodeIds).toEqual([ORPHAN]);
    expect(after.strokeIds).toEqual([LOOSE_INK]);
  });

  test('delete_block on the frame id cascades', async ({ page }) => {
    await runBridge(page, 'delete_block', { blockId: FRAME, confirm: true });

    const after = await snapshot(page);
    expect(after.nodeIds).toEqual([ORPHAN]);
    expect(after.strokeIds).toEqual([LOOSE_INK]);
  });

  test('delete_diagram reports member and stroke counts', async ({ page }) => {
    const result = await runBridge(page, 'delete_diagram', {
      diagramId: FRAME,
      confirm: true,
    });
    expect(result).toEqual({ deletedMembers: 1, deletedStrokes: 1 });

    const after = await snapshot(page);
    expect(after.nodeIds).toEqual([ORPHAN]);
    expect(after.strokeIds).toEqual([LOOSE_INK]);
  });

  test('one undo restores the frame, members, and grouped ink', async ({ page }) => {
    await runBridge(page, 'delete_diagram', { diagramId: FRAME, confirm: true });
    expect((await snapshot(page)).nodeIds).toEqual([ORPHAN]);

    await page.evaluate(() => {
      (window as any).__POWERNOTE_STORES__.canvas.getState().undo();
    });

    const restored = await snapshot(page);
    expect(restored.nodeIds).toEqual([FRAME, MEMBER, ORPHAN].sort());
    expect(restored.strokeIds).toEqual([GROUP_INK, LOOSE_INK].sort());
    const store = await getCanvasStore(page);
    expect(store.nodes.find((n: any) => n.id === FRAME).type).toBe('diagram');
  });

  test('unknown diagram id is NOT_FOUND', async ({ page }) => {
    const err = await runBridgeExpectingError(page, 'delete_diagram', {
      diagramId: 'no-such-frame',
      confirm: true,
    });
    expect(err.code).toBe('NOT_FOUND');
    expect((await snapshot(page)).nodeIds).toContain(FRAME);
  });

  test('a non-diagram id is refused by type and points at delete_block', async ({ page }) => {
    const err = await runBridgeExpectingError(page, 'delete_diagram', {
      diagramId: ORPHAN,
      confirm: true,
    });
    expect(err.code).toBe('UNSUPPORTED');
    expect(err.message).toContain('text');
    expect(err.message).toContain('delete_block');
    expect((await snapshot(page)).nodeIds).toContain(ORPHAN);
    expect((await snapshot(page)).nodeIds).toContain(FRAME);
  });

  test('delete_diagram refuses without confirm', async ({ page }) => {
    const err = await runBridgeExpectingError(page, 'delete_diagram', {
      diagramId: FRAME,
    });
    expect(err.code).toBe('BAD_PARAMS');
    expect(err.message).toContain('confirm:true');
    expect((await snapshot(page)).nodeIds).toContain(FRAME);
  });
});
