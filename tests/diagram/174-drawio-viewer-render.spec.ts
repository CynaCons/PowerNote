/**
 * Test 174: draw.io viewer snapshot rendering
 * Covers: REQ-DIAG-149
 *
 * Codifies the v0.64 spike: the vendored viewer asset (served from public/ext
 * by the dev server) renders a torture-sample mxfile — gradient + shadow,
 * curved edge, double-headed dashed arrow, HTML label, built-in cloud shape —
 * into an SVG data URI that loads as an image and draws to a canvas without
 * tainting it, with zero requests leaving localhost.
 */
import { test, expect } from '@playwright/test';
import { waitForCanvasReady } from '../helpers';

const TORTURE = `<mxfile><diagram name="torture"><mxGraphModel><root>
<mxCell id="0"/><mxCell id="1" parent="0"/>
<mxCell id="grad" value="Gradient" style="rounded=1;fillColor=#dae8fc;strokeColor=#6c8ebf;gradientColor=#7ea6e0;shadow=1;" vertex="1" parent="1"><mxGeometry x="40" y="40" width="160" height="60" as="geometry"/></mxCell>
<mxCell id="rho" value="Decision?" style="rhombus;fillColor=#fff2cc;strokeColor=#d6b656;dashed=1;" vertex="1" parent="1"><mxGeometry x="150" y="200" width="140" height="80" as="geometry"/></mxCell>
<mxCell id="html" value="&lt;b&gt;Bold&lt;/b&gt; and &lt;font color=&quot;#ff0000&quot;&gt;red&lt;/font&gt;" style="fillColor=#f8cecc;strokeColor=#b85450;html=1;" vertex="1" parent="1"><mxGeometry x="380" y="200" width="170" height="70" as="geometry"/></mxCell>
<mxCell id="cloud" value="cloud" style="shape=cloud;" vertex="1" parent="1"><mxGeometry x="40" y="330" width="150" height="90" as="geometry"/></mxCell>
<mxCell id="e1" value="yes" style="edgeStyle=orthogonalEdgeStyle;curved=1;strokeColor=#6c8ebf;" edge="1" parent="1" source="grad" target="rho"><mxGeometry relative="1" as="geometry"/></mxCell>
<mxCell id="e2" style="startArrow=classic;endArrow=classic;dashed=1;strokeColor=#b85450;" edge="1" parent="1" source="rho" target="html"><mxGeometry relative="1" as="geometry"/></mxCell>
</root></mxGraphModel></diagram></mxfile>`;

test.describe('174 - draw.io viewer renders an exact snapshot (REQ-DIAG-149)', () => {
  test('torture source → SVG data URI → image → untainted canvas, offline', async ({ page }) => {
    const offsiteRequests: string[] = [];
    page.on('request', (r) => {
      const url = r.url();
      if (!url.startsWith('http://localhost') && !url.startsWith('data:')) {
        offsiteRequests.push(url);
      }
    });

    await page.goto('/');
    await waitForCanvasReady(page);

    const result = await page.evaluate(async (source) => {
      const mod = await import('/src/diagram/drawioRender.ts');
      const rendered = await mod.renderDrawioSnapshot(source);
      if (!rendered.ok) return { ok: false as const, reason: rendered.reason };
      const snap = rendered.snapshot;

      const img = new Image();
      const loaded = await new Promise<boolean>((resolve) => {
        img.onload = () => resolve(true);
        img.onerror = () => resolve(false);
        img.src = snap.src;
      });
      if (!loaded) return { ok: false as const, reason: 'data URI did not load as an image' };

      const c = document.createElement('canvas');
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      const ctx = c.getContext('2d')!;
      ctx.drawImage(img, 0, 0);
      let tainted = false;
      try {
        c.toDataURL('image/png');
      } catch {
        tainted = true;
      }
      const data = ctx.getImageData(0, 0, Math.min(c.width, 400), Math.min(c.height, 300)).data;
      let inked = 0;
      for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] > 0 && (data[i] < 245 || data[i + 1] < 245 || data[i + 2] < 245)) inked++;
      }
      return {
        ok: true as const,
        snapshot: {
          srcPrefix: snap.src.slice(0, 30),
          naturalWidth: snap.naturalWidth,
          naturalHeight: snap.naturalHeight,
          renderer: snap.renderer,
        },
        imageW: img.naturalWidth,
        imageH: img.naturalHeight,
        tainted,
        inked,
      };
    }, TORTURE);

    expect(result.ok, 'reason' in result ? result.reason : '').toBe(true);
    if (!result.ok) return;
    expect(result.snapshot.srcPrefix).toContain('data:image/svg+xml;base64');
    expect(result.snapshot.renderer).toBe('drawio-viewer');
    expect(result.snapshot.naturalWidth).toBeGreaterThan(100);
    expect(result.snapshot.naturalHeight).toBeGreaterThan(100);
    expect(result.imageW).toBe(result.snapshot.naturalWidth);
    expect(result.imageH).toBe(result.snapshot.naturalHeight);
    expect(result.tainted).toBe(false);
    expect(result.inked).toBeGreaterThan(100);

    // Offline contract: the viewer must not phone home — no MathJax, no
    // stencil XHR, nothing beyond the dev server.
    expect(offsiteRequests).toEqual([]);
  });
});
