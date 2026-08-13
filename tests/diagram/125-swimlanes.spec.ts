/**
 * Test 125: Swimlane activity diagrams
 * Covers: REQ-DIAG-070..076
 *
 * A second PlantUML grammar, routed by sniffing rather than a flag. These check
 * the routing, the lane partition, the pseudostates and decision, and that the
 * constructs we refuse are refused loudly rather than drawn wrong.
 */
import { test, expect } from '@playwright/test';
import { getCanvasStore, waitForCanvasReady, waitForBridgeReady, runBridge } from '../helpers';

const SWIMLANE = `@startuml
|Sensor|
start
:sample burst;
|Gateway|
:buffer to flash;
if (uplink up?) then (yes)
|Cloud|
:ingest batch;
else (no)
|Gateway|
:hold in store-forward;
endif
|Cloud|
:ack;
stop
@enduml`;

test.describe('125 - Swimlane activity diagrams (REQ-DIAG-070..076)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForCanvasReady(page);
    await waitForBridgeReady(page);
  });

  test('activity syntax is routed to the activity grammar', async ({ page }) => {
    const routing = await page.evaluate(async () => {
      const mod = await import('/src/diagram/activity.ts');
      return {
        swimlane: mod.looksLikeActivity('|Sensor|\nstart\n:go;\nstop'),
        action: mod.looksLikeActivity(':just an action;'),
        component: mod.looksLikeActivity('component "gateway" as gw {\n  component b\n}'),
      };
    });
    expect(routing.swimlane).toBe(true);
    expect(routing.action).toBe(true);
    // Component sources must not be mistaken for activity ones.
    expect(routing.component).toBe(false);
  });

  test('lanes partition the flow and every step lands in its own lane', async ({ page }) => {
    const parsed = await page.evaluate(async () => {
      const mod = await import('/src/diagram/activity.ts');
      const { spec, diagnostics } = mod.parseActivity(`|Sensor|
start
:sample burst;
|Gateway|
:buffer to flash;
|Cloud|
:ack;
stop`);
      const laid = mod.layoutActivity(spec, (t: string) => t.length * 7);
      return {
        lanes: spec.lanes,
        kinds: spec.steps.map((s: any) => s.kind),
        laneOf: spec.steps.map((s: any) => s.lane),
        xs: laid.placed.map((p: any) => Math.round(p.box.x)),
        diagnostics,
      };
    });

    expect(parsed.lanes).toEqual(['Sensor', 'Gateway', 'Cloud']);
    expect(parsed.kinds).toEqual(['start', 'action', 'action', 'action', 'stop']);
    expect(parsed.laneOf).toEqual(['Sensor', 'Sensor', 'Gateway', 'Cloud', 'Cloud']);
    expect(parsed.diagnostics).toEqual([]);
    // Later lanes sit further right; the lane fixes the column.
    expect(parsed.xs[0]).toBeLessThan(parsed.xs[2]);
    expect(parsed.xs[2]).toBeLessThan(parsed.xs[3]);
  });

  test('a decision carries its guard onto the next step', async ({ page }) => {
    const parsed = await page.evaluate(async (src) => {
      const mod = await import('/src/diagram/activity.ts');
      const { spec } = mod.parseActivity(src);
      return {
        decisions: spec.steps.filter((s: any) => s.kind === 'decision').map((s: any) => s.text),
        guards: spec.steps.map((s: any) => s.incomingLabel).filter(Boolean),
      };
    }, SWIMLANE);
    expect(parsed.decisions).toEqual(['uplink up?']);
    expect(parsed.guards).toContain('yes');
    expect(parsed.guards).toContain('no');
  });

  test('unsupported constructs are refused, not drawn wrong', async ({ page }) => {
    const diags = await page.evaluate(async () => {
      const mod = await import('/src/diagram/activity.ts');
      return mod.parseActivity('start\nfork\n:a;\nwhile (x)\nstop').diagnostics;
    });
    const messages = diags.map((d: any) => d.message).join(' ');
    expect(messages).toContain('not supported yet');
    expect(diags.some((d: any) => d.severity === 'error')).toBe(true);
  });

  test('an agent can draw a swimlane chart over the bridge', async ({ page }) => {
    const result = await runBridge(page, 'create_diagram', {
      source: SWIMLANE,
      title: 'Telemetry ingest',
    });

    expect(result.diagnostics).toEqual([]);
    expect(result.elementCount).toBeGreaterThan(20);

    const store = await getCanvasStore(page);
    const frame = store.nodes.find((n: any) => n.id === result.diagramId);
    expect(frame.type).toBe('diagram');

    const members = store.nodes.filter((n: any) => n.groupId === result.diagramId && n.id !== frame.id);
    const labels = members.filter((n: any) => n.type === 'text').map((n: any) => n.data.text);
    expect(labels).toContain('Sensor');
    expect(labels).toContain('Gateway');
    expect(labels).toContain('Cloud');
    expect(labels).toContain('sample burst');

    // A decision is a square turned 45 degrees, which needs the rotation field.
    const diamonds = members.filter((n: any) => n.type === 'shape' && n.data.rotation === 45);
    expect(diamonds.length).toBeGreaterThan(0);
  });

  test('styling directives are skipped in activity sources too', async ({ page }) => {
    const result = await runBridge(page, 'create_diagram', {
      source: 'skinparam backgroundColor #FF00FF\n|A|\nstart\n:go;\nstop',
    });
    expect(result.diagnostics.some((d: any) => d.severity === 'ignored')).toBe(true);
    expect(result.elementCount).toBeGreaterThan(0);
  });
});
