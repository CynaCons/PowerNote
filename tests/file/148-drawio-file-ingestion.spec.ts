/**
 * Test 148: draw.io / SVG file ingestion (drop + paste)
 * Covers: REQ-DIAG-127..129 (as amended v0.64: a dropped/pasted drawio source
 * lands as a viewer SNAPSHOT — `data.render` set, zero member nodes; the dev
 * server serves the real extension asset, so the snapshot path is live here)
 *
 * The drop/paste gate sits ahead of the image/* path. Playwright synthesises a
 * DragEvent with a DataTransfer File inside page.evaluate — Konva never sees
 * the OS file picker. Paste is a ClipboardEvent on window, same as the hook.
 */
import { test, expect } from '@playwright/test';
import { getCanvasStore, waitForCanvasReady } from '../helpers';

const SIMPLE_DRAWIO = `<mxfile host="app.diagrams.net">
  <diagram name="Page-1" id="page1">
    <mxGraphModel>
      <root>
        <mxCell id="0"/>
        <mxCell id="1" parent="0"/>
        <mxCell id="a" value="Start" style="rounded=1;whiteSpace=wrap;html=1;" vertex="1" parent="1">
          <mxGeometry x="0" y="0" width="80" height="40" as="geometry"/>
        </mxCell>
      </root>
    </mxGraphModel>
  </diagram>
</mxfile>`;

const SIMPLE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="80" viewBox="0 0 120 80">
  <rect x="10" y="10" width="80" height="40" fill="#eef1f0" stroke="#14181a"/>
</svg>`;

// 1×1 red pixel PNG
const PNG_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';

async function dropFile(
  page: import('@playwright/test').Page,
  file: { name: string; mime: string; text?: string; bytes?: number[] },
  offset: { x: number; y: number } = { x: 280, y: 220 },
): Promise<{ dropX: number; dropY: number }> {
  return page.evaluate(
    ({ file, offset }) => {
      const container = document.querySelector('[data-testid="canvas-container"]') as HTMLElement;
      const rect = container.getBoundingClientRect();
      const clientX = rect.left + offset.x;
      const clientY = rect.top + offset.y;
      const part: BlobPart = file.bytes ? new Uint8Array(file.bytes) : (file.text ?? '');
      const f = new File([part], file.name, { type: file.mime });
      const dt = new DataTransfer();
      dt.items.add(f);
      const ev = new DragEvent('drop', { bubbles: true, cancelable: true, clientX, clientY });
      Object.defineProperty(ev, 'dataTransfer', { value: dt });
      container.dispatchEvent(ev);
      const vp = (window as any).__POWERNOTE_STORES__.canvas.getState().viewport;
      return {
        dropX: (clientX - rect.left - vp.x) / vp.scale,
        dropY: (clientY - rect.top - vp.y) / vp.scale,
      };
    },
    { file, offset },
  );
}

async function pasteText(page: import('@playwright/test').Page, text: string): Promise<void> {
  await page.evaluate((text) => {
    const dt = new DataTransfer();
    dt.setData('text/plain', text);
    const ev = new ClipboardEvent('paste', { bubbles: true, cancelable: true });
    Object.defineProperty(ev, 'clipboardData', { value: dt });
    window.dispatchEvent(ev);
  }, text);
}

async function waitForNodeType(page: import('@playwright/test').Page, type: string) {
  await page.waitForFunction(
    (type) =>
      (window as any).__POWERNOTE_STORES__.canvas.getState().nodes.some((n: any) => n.type === type),
    type,
  );
}

function pngBytes(): number[] {
  const bin = Buffer.from(PNG_B64, 'base64');
  return Array.from(bin);
}

test.describe('148 - draw.io / SVG file ingestion (REQ-DIAG-127..129)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForCanvasReady(page);
  });

  test('dropping a .drawio file creates a diagram frame at the drop point', async ({ page }) => {
    const { dropX, dropY } = await dropFile(page, {
      name: 'flow.drawio',
      mime: '',
      text: SIMPLE_DRAWIO,
    });

    await waitForNodeType(page, 'diagram');

    const store = await getCanvasStore(page);
    const frame = store.nodes.find((n: any) => n.type === 'diagram');
    expect(frame).toBeTruthy();
    expect(frame.data.title).toBe('flow');
    expect(frame.data.source).toMatch(/<mxfile[\s>]/i);
    expect(frame.data.source).toContain('<mxCell');
    expect(frame.x).toBeCloseTo(dropX, 0);
    expect(frame.y).toBeCloseTo(dropY, 0);

    // v0.64: a drawio drop is a snapshot — the exact render travels in
    // data.render, and the frame owns no member nodes.
    expect(frame.data.render).toBeTruthy();
    expect(frame.data.render.src).toMatch(/^data:image\/(svg\+xml|png);base64,/);
    expect(frame.data.render.naturalWidth).toBeGreaterThan(0);
    expect(frame.data.render.naturalHeight).toBeGreaterThan(0);
    const members = store.nodes.filter((n: any) => n.groupId === frame.id && n.id !== frame.id);
    expect(members).toHaveLength(0);
    expect(store.nodes.some((n: any) => n.type === 'image')).toBe(false);
  });

  test('dropping a compressed .drawio file stores inflated XML', async ({ page }) => {
    const compressed = await page.evaluate(async () => {
      const inner = `<mxGraphModel>
      <root>
        <mxCell id="0"/>
        <mxCell id="1" parent="0"/>
        <mxCell id="a" value="" style="fillColor=#aaaaaa;" vertex="1" parent="1">
          <mxGeometry x="0" y="0" width="40" height="30" as="geometry"/>
        </mxCell>
      </root>
    </mxGraphModel>`;
      const encoded = encodeURIComponent(inner);
      const stream = new Blob([encoded]).stream().pipeThrough(new CompressionStream('deflate-raw'));
      const buf = await new Response(stream).arrayBuffer();
      const bytes = new Uint8Array(buf);
      let bin = '';
      for (const b of bytes) bin += String.fromCharCode(b);
      return `<mxfile host="app.diagrams.net"><diagram name="Page-1" id="page1">${btoa(bin)}</diagram></mxfile>`;
    });

    expect(compressed).toMatch(/<diagram[^>]*>[A-Za-z0-9+/=]+<\/diagram>/);

    await dropFile(page, { name: 'packed.drawio', mime: '', text: compressed });
    await waitForNodeType(page, 'diagram');

    const store = await getCanvasStore(page);
    const frame = store.nodes.find((n: any) => n.type === 'diagram');
    const stored: string = frame.data.source;
    expect(stored.trimStart()).toMatch(/^<(mxfile|mxGraphModel)\b/i);
    expect(stored).toMatch(/<mxGraphModel/i);
    expect(stored).toContain('<mxCell');
    expect(stored).toContain('fillColor=#aaaaaa');
    expect(stored).not.toBe(compressed);

    expect(frame.data.render).toBeTruthy();
    const members = store.nodes.filter((n: any) => n.groupId === frame.id && n.id !== frame.id);
    expect(members).toHaveLength(0);
  });

  test('dropping an .svg file becomes native nodes, not an image', async ({ page }) => {
    await dropFile(page, {
      name: 'icon.svg',
      mime: 'image/svg+xml',
      text: SIMPLE_SVG,
    });

    await waitForNodeType(page, 'diagram');

    const store = await getCanvasStore(page);
    expect(store.nodes.some((n: any) => n.type === 'image')).toBe(false);
    const frame = store.nodes.find((n: any) => n.type === 'diagram');
    expect(frame).toBeTruthy();
    expect(frame.data.title).toBe('icon');
    expect(frame.data.source).toContain('<svg');
    const members = store.nodes.filter((n: any) => n.groupId === frame.id && n.id !== frame.id);
    expect(members.length).toBeGreaterThan(0);
    expect(members.every((n: any) => n.type === 'shape' || n.type === 'text')).toBe(true);
  });

  test('dropping a .png still creates an image node', async ({ page }) => {
    await dropFile(page, {
      name: 'pixel.png',
      mime: 'image/png',
      bytes: pngBytes(),
    });

    await waitForNodeType(page, 'image');

    const store = await getCanvasStore(page);
    expect(store.nodes.some((n: any) => n.type === 'diagram')).toBe(false);
    const image = store.nodes.find((n: any) => n.type === 'image');
    expect(image).toBeTruthy();
    expect(image.data.src).toContain('data:image/png');
    expect(image.data.alt).toBe('pixel.png');
  });

  test('pasting mxGraph XML text creates a frame at the viewport centre', async ({ page }) => {
    const expected = await page.evaluate(() => {
      const el = document.querySelector('[data-testid="canvas-container"]') as HTMLElement;
      const vp = (window as any).__POWERNOTE_STORES__.canvas.getState().viewport;
      return {
        x: (el.clientWidth / 2 - vp.x) / vp.scale,
        y: (el.clientHeight / 2 - vp.y) / vp.scale,
      };
    });

    await pasteText(page, SIMPLE_DRAWIO);
    await waitForNodeType(page, 'diagram');

    const store = await getCanvasStore(page);
    const frame = store.nodes.find((n: any) => n.type === 'diagram');
    expect(frame).toBeTruthy();
    expect(frame.data.source).toMatch(/<mxfile[\s>]/i);
    expect(frame.x).toBeCloseTo(expected.x, 0);
    expect(frame.y).toBeCloseTo(expected.y, 0);
    expect(frame.data.render).toBeTruthy();
    const members = store.nodes.filter((n: any) => n.groupId === frame.id && n.id !== frame.id);
    expect(members).toHaveLength(0);
  });

  test("a frame created from drawio source shows the 'draw.io' badge", async ({ page }) => {
    await dropFile(page, { name: 'flow.drawio', mime: '', text: SIMPLE_DRAWIO });
    await waitForNodeType(page, 'diagram');

    const badge = page.locator('.diagram-node__src').first();
    await expect(badge).toHaveAttribute('data-format', 'drawio');
    await expect(badge).toHaveText('draw.io');

    await page.evaluate(() => {
      const canvas = (window as any).__POWERNOTE_STORES__.canvas;
      const frame = canvas.getState().nodes.find((n: any) => n.type === 'diagram');
      canvas.setState({ selectedNodeIds: [frame.id] });
    });
    await expect(page.getByTestId('toolbar-diagram-source')).toHaveAttribute('data-format', 'drawio');
    await expect(page.getByTestId('toolbar-diagram-source')).toHaveText('draw.io');
  });
});
