/**
 * Test 176: bridge create_diagram defaults drawio to a snapshot; reads stay lean
 * Covers: REQ-DIAG-124 (amended), 150
 *
 * elementCount 0 + renderMode 'snapshot' is the CONTRACT, not a failure — the
 * old behaviour threw PRECONDITION on zero contents. The render payload
 * (hundreds of KB of base64) must never ride along in any bridge read.
 */
import { test, expect } from '@playwright/test';
import { getCanvasStore, runBridge, waitForBridgeReady, waitForCanvasReady } from '../helpers';

const SOURCE = `<mxfile><diagram name="p1"><mxGraphModel><root>
<mxCell id="0"/><mxCell id="1" parent="0"/>
<mxCell id="a" value="Alpha" style="rounded=1;fillColor=#dae8fc;gradientColor=#7ea6e0;" vertex="1" parent="1"><mxGeometry x="0" y="0" width="120" height="50" as="geometry"/></mxCell>
<mxCell id="b" value="Beta" style="fillColor=#d5e8d4;" vertex="1" parent="1"><mxGeometry x="220" y="120" width="120" height="50" as="geometry"/></mxCell>
<mxCell id="e" style="curved=1;endArrow=classic;" edge="1" parent="1" source="a" target="b"><mxGeometry relative="1" as="geometry"/></mxCell>
</root></mxGraphModel></diagram></mxfile>`;

test.describe('176 - snapshot over the bridge (REQ-DIAG-150)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForCanvasReady(page);
    await waitForBridgeReady(page);
  });

  test('create_diagram renders a snapshot: renderMode set, elementCount 0, no error', async ({
    page,
  }) => {
    const result = await runBridge(page, 'create_diagram', {
      source: SOURCE,
      title: 'Snap',
      format: 'drawio',
    });

    expect(result.renderMode).toBe('snapshot');
    expect(result.elementCount).toBe(0);
    expect(result.diagnostics).toEqual([]);
    expect(result.format).toBe('drawio');

    const store = await getCanvasStore(page);
    const frame = store.nodes.find((n: any) => n.id === result.diagramId);
    expect(frame.data.render).toBeTruthy();
    expect(frame.data.source).toBe(SOURCE);
    const members = store.nodes.filter((n: any) => n.groupId === frame.id && n.id !== frame.id);
    expect(members).toHaveLength(0);
  });

  test('read_diagram and read_page report the snapshot without leaking its bytes', async ({
    page,
  }) => {
    const drawn = await runBridge(page, 'create_diagram', {
      source: SOURCE,
      title: 'Snap',
      format: 'drawio',
    });

    const detail = await runBridge(page, 'read_diagram', { diagramId: drawn.diagramId });
    expect(detail.renderMode).toBe('snapshot');
    expect(detail.memberCount).toBe(0);
    expect(detail.members).toEqual([]);
    expect(detail.source).toBe(SOURCE);
    expect(JSON.stringify(detail)).not.toContain('data:image');

    const content = await runBridge(page, 'read_page', {
      include: ['diagrams'],
      include_diagram_source: true,
    });
    const summary = content.diagrams.find((d: any) => d.id === drawn.diagramId);
    expect(summary.renderMode).toBe('snapshot');
    expect(summary.memberCount).toBe(0);
    expect(JSON.stringify(content)).not.toContain('data:image');
  });

  test("render:'nodes' still transpiles to members on demand", async ({ page }) => {
    const result = await runBridge(page, 'create_diagram', {
      source: SOURCE,
      title: 'Native',
      format: 'drawio',
      render: 'nodes',
    });

    expect(result.renderMode).toBe('nodes');
    // The gradient cell and curved edge are refused by the transpiler — the
    // remaining plain rect and labels land as members.
    expect(result.elementCount).toBeGreaterThan(0);
    expect(result.diagnostics.length).toBeGreaterThan(0);

    const store = await getCanvasStore(page);
    const frame = store.nodes.find((n: any) => n.id === result.diagramId);
    expect(frame.data.render).toBeFalsy();
    const members = store.nodes.filter((n: any) => n.groupId === frame.id && n.id !== frame.id);
    expect(members.length).toBe(result.elementCount);
  });
});
