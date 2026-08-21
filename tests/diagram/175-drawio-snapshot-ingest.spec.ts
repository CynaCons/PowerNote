/**
 * Test 175: drop/paste of transpiler-hostile draw.io lands as a clean snapshot
 * Covers: REQ-DIAG-127, 147, 149, 150
 *
 * The point of the snapshot path: a file full of constructs the transpiler
 * REFUSES (gradients, curves, double arrows, HTML labels) imports without a
 * single diagnostic, the toast reports a render (never "0 marks"), and the
 * source dialog does NOT auto-open — nothing was skipped.
 */
import { test, expect } from '@playwright/test';
import { getCanvasStore, waitForCanvasReady } from '../helpers';

const HOSTILE = `<mxfile><diagram name="hostile"><mxGraphModel><root>
<mxCell id="0"/><mxCell id="1" parent="0"/>
<mxCell id="a" value="&lt;b&gt;Gateway&lt;/b&gt;" style="rounded=1;fillColor=#dae8fc;strokeColor=#6c8ebf;gradientColor=#7ea6e0;shadow=1;html=1;" vertex="1" parent="1"><mxGeometry x="40" y="40" width="160" height="60" as="geometry"/></mxCell>
<mxCell id="b" value="Store" style="shape=cylinder3;whiteSpace=wrap;fillColor=#d5e8d4;" vertex="1" parent="1"><mxGeometry x="320" y="160" width="90" height="80" as="geometry"/></mxCell>
<mxCell id="e" value="sync" style="curved=1;startArrow=classic;endArrow=classic;dashed=1;" edge="1" parent="1" source="a" target="b"><mxGeometry relative="1" as="geometry"/></mxCell>
</root></mxGraphModel></diagram></mxfile>`;

async function dropDrawio(page: import('@playwright/test').Page, name: string, text: string) {
  await page.evaluate(
    ({ name, text }) => {
      const container = document.querySelector('[data-testid="canvas-container"]') as HTMLElement;
      const rect = container.getBoundingClientRect();
      const f = new File([text], name, { type: '' });
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
    },
    { name, text },
  );
}

test.describe('175 - hostile drawio drops as a clean snapshot (REQ-DIAG-150)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForCanvasReady(page);
  });

  test('gradients/curves/double-arrows import with zero diagnostics and no dialog', async ({
    page,
  }) => {
    await dropDrawio(page, 'hostile.drawio', HOSTILE);
    await page.waitForFunction(() =>
      (window as any).__POWERNOTE_STORES__.canvas.getState().nodes.some((n: any) => n.type === 'diagram'),
    );

    const store = await getCanvasStore(page);
    const frame = store.nodes.find((n: any) => n.type === 'diagram');
    expect(frame.data.render).toBeTruthy();
    expect(frame.data.render.src).toMatch(/^data:image\/svg\+xml;base64,/);
    expect(frame.data.source).toContain('gradientColor');

    // Zero members — and zero fallout: the transpiler would have refused the
    // gradient, the curve and the double arrow by name.
    const members = store.nodes.filter((n: any) => n.groupId === frame.id && n.id !== frame.id);
    expect(members).toHaveLength(0);

    // No diagnostics ⇒ the source dialog must NOT auto-open.
    await expect(page.getByTestId('diagram-dialog')).toHaveCount(0);

    // The toast names a render, and never reads "0 marks".
    const toasts = await page.getByTestId('toast').allTextContents();
    const joined = toasts.join(' | ');
    expect(joined).toContain('draw.io render');
    expect(joined).not.toContain('0 marks');
  });

  test('the snapshot frame is selectable with a source button, no Edit contents', async ({
    page,
  }) => {
    await dropDrawio(page, 'hostile.drawio', HOSTILE);
    await page.waitForFunction(() =>
      (window as any).__POWERNOTE_STORES__.canvas.getState().nodes.some((n: any) => n.type === 'diagram'),
    );

    await page.evaluate(() => {
      const canvas = (window as any).__POWERNOTE_STORES__.canvas;
      const frame = canvas.getState().nodes.find((n: any) => n.type === 'diagram');
      canvas.setState({ selectedNodeIds: [frame.id] });
    });

    const segment = page.getByTestId('toolbar-group-segment');
    await expect(segment).toHaveAttribute('data-mode', 'snapshot');
    await expect(page.getByTestId('toolbar-diagram-source')).toHaveAttribute('data-format', 'drawio');
    await expect(page.getByTestId('toolbar-group-edit')).toHaveCount(0);
  });
});
