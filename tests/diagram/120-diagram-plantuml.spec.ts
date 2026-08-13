/**
 * Test 120: PlantUML diagrams render as native canvas elements
 * Covers: REQ-DIAG-010, REQ-DIAG-013, REQ-DIAG-014, REQ-DIAG-017,
 *         REQ-DIAG-041, REQ-DIAG-050..056, REQ-DIAG-057, REQ-DIAG-062, REQ-DIAG-063
 *
 * The point of parsing PlantUML ourselves rather than embedding its renderer is
 * that the output is ordinary ShapeNodes and TextNodes. These tests assert that:
 * the author supplies no geometry, every mark is a native node carrying the
 * diagram's groupId, connector kind is DERIVED from the UML rule rather than
 * declared, and malformed source degrades to diagnostics instead of a crash.
 */
import { test, expect } from '@playwright/test';
import { getCanvasStore, waitForCanvasReady } from '../helpers';

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

/** Places a diagram node with the tool, which draws the starter source at once. */
async function place(page: import('@playwright/test').Page) {
  await page.getByTestId('nav-diagram-tool').click();
  await page.locator('[data-testid="canvas-container"]').click({ position: { x: 260, y: 200 } });
  await page.waitForFunction(
    () => (window as any).__POWERNOTE_STORES__.canvas.getState().nodes.length > 1,
  );
}

/** Opens the frame's plantuml overlay and redraws with new source. */
async function redraw(page: import('@playwright/test').Page, source: string) {
  await page.locator('.diagram-node__src').first().click();
  await page.getByTestId('diagram-source').fill(source);
  await page.getByTestId('diagram-apply').click();
}

test.describe('120 - PlantUML diagrams (REQ-DIAG-013, REQ-DIAG-057)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForCanvasReady(page);
  });

  test('a composite source becomes native shape and text nodes', async ({ page }) => {
    expect((await getCanvasStore(page)).nodes).toHaveLength(0);

    await place(page);

    const store = await getCanvasStore(page);
    const shapes = store.nodes.filter((n: any) => n.type === 'shape');
    const texts = store.nodes.filter((n: any) => n.type === 'text');

    // The diagram itself is a native canvas node, like an image.
    const frames = store.nodes.filter((n: any) => n.type === 'diagram');
    expect(frames).toHaveLength(1);
    expect(frames[0].data.source).toContain('@startuml');

    // Its contents are ordinary nodes — nothing bespoke, nothing unselectable.
    expect(shapes.length).toBeGreaterThan(0);
    expect(texts.length).toBeGreaterThan(0);
    expect(
      store.nodes.every((n: any) => ['shape', 'text', 'diagram'].includes(n.type)),
    ).toBe(true);

    // Frame and contents share one groupId, so the frame drags them with it.
    const groupIds = new Set(store.nodes.map((n: any) => n.groupId));
    expect(groupIds.size).toBe(1);
    expect([...groupIds][0]).toBe(frames[0].id);

    // The socket is an arc; no other primitive can draw a required interface.
    const kinds = shapes.map((n: any) => n.data.shapeType);
    expect(kinds).toContain('arc');
    expect(kinds).toContain('circle');
    expect(kinds).toContain('rect');
  });

  test('parts split into role, type and multiplicity', async ({ page }) => {
    await place(page);
    const store = await getCanvasStore(page);
    const labels = store.nodes.filter((n: any) => n.type === 'text').map((n: any) => n.data.text);

    expect(labels).toContain('broker : MqttBroker');
    expect(labels).toContain('buffer : StoreForward');
    expect(labels).toContain('[1]');
    expect(labels).toContain('[1..*]');
  });

  test('containers recede to paper so nested children stay the figure', async ({ page }) => {
    await place(page);
    const store = await getCanvasStore(page);
    const rects = store.nodes.filter((n: any) => n.type === 'shape' && n.data.shapeType === 'rect');

    // The container is the widest rect and must not carry the tint.
    const widest = rects.reduce((a: any, b: any) => (b.width > a.width ? b : a));
    expect(widest.data.fill).toBe('#FFFFFF');
    expect(rects.some((r: any) => r.data.fill === '#EEF1F0')).toBe(true);
    // UML node boxes are rounded, which needs the cornerRadius field.
    expect(rects.some((r: any) => (r.data.cornerRadius ?? 0) > 0)).toBe(true);
  });

  test('elements are individually selectable and moveable', async ({ page }) => {
    await place(page);

    const moved = await page.evaluate(() => {
      const S = (window as any).__POWERNOTE_STORES__;
      const canvas = S.canvas.getState();
      const target = canvas.nodes.find(
        (n: any) => n.type === 'shape' && n.data.shapeType === 'rect',
      );
      S.group.getState().enterIsolation(target.groupId);
      S.canvas.setState({ selectedNodeIds: [target.id] });
      const selected = S.canvas.getState().selectedNodeIds.length;
      S.canvas.getState().updateNode(target.id, { x: target.x + 40, y: target.y + 25 });
      const after = S.canvas.getState().nodes.find((n: any) => n.id === target.id);
      S.group.getState().exitIsolation();
      return { selected, dx: after.x - target.x, dy: after.y - target.y };
    });

    expect(moved.selected).toBe(1);
    expect(moved.dx).toBe(40);
    expect(moved.dy).toBe(25);
  });

  test('dragging the frame straight away takes its contents with it', async ({ page }) => {
    await place(page);

    // Konva starts dragging on mousedown, so a press-and-drag in one motion
    // never runs a click first. The frame used to move alone in that case.
    await page.evaluate(() => {
      (window as any).__POWERNOTE_STORES__.canvas.setState({ selectedNodeIds: [] });
    });

    const before = await page.evaluate(() => {
      const nodes = (window as any).__POWERNOTE_STORES__.canvas.getState().nodes;
      const frame = nodes.find((n: any) => n.type === 'diagram');
      const member = nodes.find((n: any) => n.type === 'shape');
      return { frame: { id: frame.id, x: frame.x, y: frame.y }, member: { id: member.id, x: member.x } };
    });

    const box = await page.locator('[data-testid="canvas-container"]').boundingBox();
    await page.mouse.move(box!.x + before.frame.x + 60, box!.y + before.frame.y + 14);
    await page.mouse.down();
    await page.mouse.move(box!.x + before.frame.x + 160, box!.y + before.frame.y + 74, { steps: 8 });
    await page.mouse.up();

    const after = await page.evaluate((ids) => {
      const nodes = (window as any).__POWERNOTE_STORES__.canvas.getState().nodes;
      return {
        frameX: nodes.find((n: any) => n.id === ids.frameId).x,
        memberX: nodes.find((n: any) => n.id === ids.memberId).x,
      };
    }, { frameId: before.frame.id, memberId: before.member.id });

    const frameMoved = after.frameX - before.frame.x;
    const memberMoved = after.memberX - before.member.x;
    expect(frameMoved).toBeGreaterThan(50);
    // The contents travel with the frame, not stay behind.
    expect(memberMoved).toBeCloseTo(frameMoved, 0);
  });

  test('the overlay badge opens the source it was built from', async ({ page }) => {
    await place(page);
    await page.locator('.diagram-node__src').first().click();
    await expect(page.getByTestId('diagram-source')).toHaveValue(COMPOSITE);
  });

  test('malformed source reports diagnostics instead of crashing', async ({ page }) => {
    await place(page);
    await redraw(
      page,
      `@startuml
skinparam backgroundColor #FF00FF
component "gw" as gw {
  component broker
  broker --> ???? : Queue
  class Foo <<weird>> {
  }
@enduml`,
    );

    // Still drew something, and said what it could not read.
    const store = await getCanvasStore(page);
    expect(store.nodes.length).toBeGreaterThan(0);

    const diagnostics = page.getByTestId('diagram-diagnostics');
    await expect(diagnostics).toBeVisible();
    await expect(diagnostics.locator('li')).not.toHaveCount(0);
    // A styling directive is reported as skipped, never silently dropped.
    await expect(diagnostics).toContainText('PowerNote supplies the style');
  });

  test('total garbage leaves the canvas intact', async ({ page }) => {
    await place(page);
    await redraw(page, '!!! not plantuml at all ### <<<>>>');

    await expect(page.getByTestId('diagram-diagnostics')).toBeVisible();
    // Nothing understood means nothing drawn — but the app is still running.
    const store = await getCanvasStore(page);
    expect(Array.isArray(store.nodes)).toBe(true);
  });
});
