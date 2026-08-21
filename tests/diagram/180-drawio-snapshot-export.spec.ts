/**
 * Test 180: snapshot frames export their stored source verbatim
 * Covers: REQ-DIAG-130 (amended), 153
 *
 * Before the short-circuit, a zero-member frame failed the member match and
 * fell through to mapMembers([]) — a well-formed but EMPTY mxfile, silently.
 */
import { test, expect } from '@playwright/test';
import { runBridge, waitForBridgeReady, waitForCanvasReady } from '../helpers';

const SOURCE = `<mxfile><diagram name="p1"><mxGraphModel><root>
<mxCell id="0"/><mxCell id="1" parent="0"/>
<mxCell id="a" value="Keep me" style="rounded=1;fillColor=#dae8fc;gradientColor=#7ea6e0;shadow=1;" vertex="1" parent="1"><mxGeometry x="0" y="0" width="160" height="60" as="geometry"/></mxCell>
<mxCell id="b" value="Me too" style="fillColor=#d5e8d4;" vertex="1" parent="1"><mxGeometry x="240" y="140" width="120" height="50" as="geometry"/></mxCell>
<mxCell id="e" value="sync" style="curved=1;startArrow=classic;endArrow=classic;" edge="1" parent="1" source="a" target="b"><mxGeometry relative="1" as="geometry"/></mxCell>
</root></mxGraphModel></diagram></mxfile>`;

test.describe('180 - verbatim export of snapshot frames (REQ-DIAG-153)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForCanvasReady(page);
    await waitForBridgeReady(page);
  });

  test('exportDrawio returns the stored XML, not an empty mxfile', async ({ page }) => {
    const drawn = await runBridge(page, 'create_diagram', {
      source: SOURCE,
      title: 'Roundtrip',
      format: 'drawio',
    });
    expect(drawn.renderMode).toBe('snapshot');

    const exported = await page.evaluate(async (frameId) => {
      const mod = await import('/src/diagram/drawioExport.ts');
      const nodes = (window as any).__POWERNOTE_STORES__.canvas.getState().nodes;
      return mod.exportDrawio(frameId, nodes);
    }, drawn.diagramId);

    expect(exported.xml).toBe(SOURCE);
    expect(exported.report).toEqual([]);
    // The refused-by-transpiler constructs survive the round trip untouched.
    expect(exported.xml).toContain('gradientColor');
    expect(exported.xml).toContain('curved=1');
    expect(exported.xml).toContain('startArrow=classic');
  });
});
