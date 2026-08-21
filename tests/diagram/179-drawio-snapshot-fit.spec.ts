/**
 * Test 179: snapshot frames fit their scroll band
 * Covers: REQ-DIAG-152
 *
 * A snapshot frame has no members to rescale — fit is a frame-box operation
 * and the image follows. Before this branch existed, fitDiagramToScroll
 * identity-returned on an empty member list and fit_diagram silently did
 * nothing for snapshots.
 */
import { test, expect } from '@playwright/test';
import { getCanvasStore, runBridge, waitForBridgeReady, waitForCanvasReady } from '../helpers';

const SMALL = `<mxfile><diagram name="p1"><mxGraphModel><root>
<mxCell id="0"/><mxCell id="1" parent="0"/>
<mxCell id="a" value="Tiny" style="rounded=1;fillColor=#dae8fc;gradientColor=#7ea6e0;" vertex="1" parent="1"><mxGeometry x="0" y="0" width="160" height="60" as="geometry"/></mxCell>
</root></mxGraphModel></diagram></mxfile>`;

async function setScrollWidth(
  page: import('@playwright/test').Page,
  width: number,
  title = 'Band',
) {
  await page.evaluate(
    ({ width, title }) => {
      const ws = (window as any).__POWERNOTE_STORES__.workspace.getState();
      const pageId = ws.activePageId;
      const scrolls = (ws.getActivePage()?.scrolls ?? []).map((s: any, i: number) =>
        i === 0 ? { ...s, width, title: s.title || title } : { ...s },
      );
      ws.replacePageScrolls(pageId, scrolls);
    },
    { width, title },
  );
}

test.describe('179 - fit_diagram on snapshot frames (REQ-DIAG-152)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForCanvasReady(page);
    await waitForBridgeReady(page);
  });

  test('grows an under-width snapshot to band width minus padding', async ({ page }) => {
    const drawn = await runBridge(page, 'create_diagram', {
      source: SMALL,
      title: 'Grow me',
      format: 'drawio',
    });
    expect(drawn.renderMode).toBe('snapshot');

    await setScrollWidth(page, 1600, 'Wide');
    const fitted = await runBridge(page, 'fit_diagram', { diagramId: drawn.diagramId });
    expect(fitted.scale).toBeGreaterThan(1);
    expect(fitted.width).toBeCloseTo(1600 - 16, 0);

    const frame = (await getCanvasStore(page)).nodes.find((n: any) => n.id === drawn.diagramId);
    expect(frame.width).toBeCloseTo(1600 - 16, 0);
    // The snapshot itself is untouched — the image is drawn from the frame box.
    expect(frame.data.render).toBeTruthy();
  });

  test('shrinks an over-width snapshot with the 0.45 floor', async ({ page }) => {
    const drawn = await runBridge(page, 'create_diagram', {
      source: SMALL,
      title: 'Shrink me',
      format: 'drawio',
    });
    const placed = (await getCanvasStore(page)).nodes.find((n: any) => n.id === drawn.diagramId);
    const placedWidth = placed.width;

    await setScrollWidth(page, 100, 'Narrow');
    const fitted = await runBridge(page, 'fit_diagram', { diagramId: drawn.diagramId });
    expect(fitted.scale).toBeCloseTo(0.45, 2);
    expect(fitted.width).toBeCloseTo(placedWidth * 0.45, 0);
    expect(fitted.warning).toMatch(/0\.45/);
  });
});
