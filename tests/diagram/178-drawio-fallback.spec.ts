/**
 * Test 178: viewer-unavailable fallback
 * Covers: REQ-DIAG-151
 *
 * The dev server always carries the extension asset, so unavailability is
 * simulated by routing the asset (and any raw.githubusercontent reach) to 404
 * BEFORE the page loads. Every entry point must then fall back to the
 * transpiler and say so — never dead-end.
 */
import { test, expect } from '@playwright/test';
import { getCanvasStore, runBridge, waitForBridgeReady, waitForCanvasReady } from '../helpers';

const SOURCE = `<mxfile><diagram name="p1"><mxGraphModel><root>
<mxCell id="0"/><mxCell id="1" parent="0"/>
<mxCell id="a" value="Plain" style="rounded=1;fillColor=#dae8fc;" vertex="1" parent="1"><mxGeometry x="0" y="0" width="120" height="50" as="geometry"/></mxCell>
<mxCell id="b" value="Box" style="fillColor=#d5e8d4;" vertex="1" parent="1"><mxGeometry x="220" y="120" width="120" height="50" as="geometry"/></mxCell>
<mxCell id="e" style="endArrow=classic;" edge="1" parent="1" source="a" target="b"><mxGeometry relative="1" as="geometry"/></mxCell>
</root></mxGraphModel></diagram></mxfile>`;

test.describe('178 - transpile fallback when the viewer is unavailable (REQ-DIAG-151)', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/ext/drawio-viewer.*', (route) => route.fulfill({ status: 404, body: '' }));
    await page.route('https://raw.githubusercontent.com/**', (route) =>
      route.fulfill({ status: 404, body: '' }),
    );
    await page.goto('/');
    await waitForCanvasReady(page);
  });

  test('bridge create_diagram falls back to members and warns', async ({ page }) => {
    await waitForBridgeReady(page);

    const result = await runBridge(page, 'create_diagram', {
      source: SOURCE,
      title: 'Fallback',
      format: 'drawio',
    });

    expect(result.renderMode).toBe('nodes');
    expect(result.elementCount).toBeGreaterThan(0);
    expect(result.warnings.join(' ')).toMatch(/renderer unavailable/i);

    const store = await getCanvasStore(page);
    const frame = store.nodes.find((n: any) => n.id === result.diagramId);
    expect(frame.data.render).toBeFalsy();
    const members = store.nodes.filter((n: any) => n.groupId === frame.id && n.id !== frame.id);
    expect(members.length).toBe(result.elementCount);
  });

  test('a dropped .drawio file falls back to members and toasts the reason', async ({ page }) => {
    await page.evaluate((text) => {
      const container = document.querySelector('[data-testid="canvas-container"]') as HTMLElement;
      const rect = container.getBoundingClientRect();
      const f = new File([text], 'flow.drawio', { type: '' });
      const dt = new DataTransfer();
      dt.items.add(f);
      const ev = new DragEvent('drop', {
        bubbles: true,
        cancelable: true,
        clientX: rect.left + 300,
        clientY: rect.top + 240,
      });
      Object.defineProperty(ev, 'dataTransfer', { value: dt });
      container.dispatchEvent(ev);
    }, SOURCE);

    await page.waitForFunction(() =>
      (window as any).__POWERNOTE_STORES__.canvas.getState().nodes.some((n: any) => n.type === 'diagram'),
    );

    const store = await getCanvasStore(page);
    const frame = store.nodes.find((n: any) => n.type === 'diagram');
    expect(frame.data.render).toBeFalsy();
    const members = store.nodes.filter((n: any) => n.groupId === frame.id && n.id !== frame.id);
    expect(members.length).toBeGreaterThan(0);

    const toasts = (await page.getByTestId('toast').allTextContents()).join(' | ');
    expect(toasts).toMatch(/renderer unavailable/i);
  });
});
