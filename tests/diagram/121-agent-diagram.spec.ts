/**
 * Test 121: Agents can draw diagrams over the bridge
 * Covers: REQ-DIAG-010, REQ-DIAG-013, REQ-DIAG-015, REQ-DIAG-016, REQ-DIAG-017
 *
 * The agent supplies semantics only. Everything geometric is computed here, and
 * the diagnostics come back with the write so one call is enough to know whether
 * the diagram came out right.
 */
import { test, expect } from '@playwright/test';
import { getCanvasStore, waitForCanvasReady, waitForBridgeReady, runBridge, runBridgeExpectingError } from '../helpers';

const COMPOSITE = `@startuml
component "gateway" as gw {
  portin telemetry
  portout storage
  component "broker : MqttBroker [1]" as broker
  component "buffer : StoreForward [1..*]" as buffer
  broker --> buffer : Queue
  telemetry --> broker
  buffer --> storage
}
@enduml`;

test.describe('121 - Agent-drawn diagrams (REQ-DIAG-010, REQ-DIAG-015)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForCanvasReady(page);
    await waitForBridgeReady(page);
  });

  test('create_diagram draws native nodes and reports what it drew', async ({ page }) => {
    const result = await runBridge(page, 'create_diagram', {
      source: COMPOSITE,
      title: 'Gateway internals',
    });

    expect(result.title).toBe('Gateway internals');
    expect(result.diagramId).toBeTruthy();
    expect(result.elementCount).toBeGreaterThan(10);
    expect(result.width).toBeGreaterThan(0);
    expect(result.diagnostics).toEqual([]);

    const store = await getCanvasStore(page);
    const frame = store.nodes.find((n: any) => n.id === result.diagramId);
    expect(frame.type).toBe('diagram');
    expect(frame.data.source).toContain('MqttBroker');

    // Contents are ordinary nodes grouped under the frame.
    const members = store.nodes.filter((n: any) => n.groupId === result.diagramId && n.id !== frame.id);
    expect(members).toHaveLength(result.elementCount);
    expect(members.every((n: any) => n.type === 'shape' || n.type === 'text')).toBe(true);
    expect(members.some((n: any) => n.data.shapeType === 'arc')).toBe(true);
  });

  test('styling directives are reported as skipped, not silently dropped', async ({ page }) => {
    const result = await runBridge(page, 'create_diagram', {
      source: `@startuml
skinparam backgroundColor #FF00FF
component a
component b
a --> b : Iface
@enduml`,
    });

    const skipped = result.diagnostics.filter((d: any) => d.severity === 'ignored');
    expect(skipped.length).toBeGreaterThan(0);
    expect(skipped[0].message).toContain('PowerScroll supplies the style');
    // It still drew the diagram it could understand.
    expect(result.elementCount).toBeGreaterThan(0);
  });

  test('a source that draws nothing is an error, not an empty frame', async ({ page }) => {
    const err = await runBridgeExpectingError(page, 'create_diagram', {
      source: '!!! not plantuml at all',
    });
    expect(err.code).toBe('PRECONDITION');

    // Nothing was left behind on the canvas.
    const store = await getCanvasStore(page);
    expect(store.nodes.filter((n: any) => n.type === 'diagram')).toHaveLength(0);
  });

  test('two diagrams stack down the column instead of overlapping', async ({ page }) => {
    const first = await runBridge(page, 'create_diagram', { source: COMPOSITE, title: 'One' });
    const second = await runBridge(page, 'create_diagram', { source: COMPOSITE, title: 'Two' });

    const store = await getCanvasStore(page);
    const a = store.nodes.find((n: any) => n.id === first.diagramId);
    const b = store.nodes.find((n: any) => n.id === second.diagramId);
    expect(b.y).toBeGreaterThanOrEqual(a.y + a.height);
  });
});
