/**
 * Test 131: Upgrading an older notebook to the current build
 * Covers: REQ-UPDATE-020..024
 *
 * This is the regression gate for releases. The failure it exists to catch is
 * silent and expensive: a notebook written by an older version opens against a
 * newer build and loses content, or does not open at all. Nothing else in the
 * suite loads a real built artifact.
 *
 * It runs entirely offline against `dist-template/index.html`, so it gates every
 * push without depending on GitHub. The network half of updating — can the app
 * actually download a release — is covered by `132` and tolerates being offline.
 */
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const TEMPLATE = path.resolve('dist-template/index.html');

/**
 * A notebook as an OLD version would have written it: no `scrolls` (v0.31+), no
 * `diagrams`, no `settings`. Loading this is exactly what a real upgrade does.
 */
const LEGACY_WORKSPACE = {
  version: '1',
  filename: 'Legacy Notes',
  editorVersion: '0.29.0',
  saveRevision: 12,
  sections: [
    {
      id: 'sec-1',
      title: 'Research',
      pages: [
        {
          id: 'page-1',
          title: 'Findings',
          nodes: [
            {
              id: 'node-1',
              type: 'text',
              x: 120,
              y: 96,
              width: 794,
              height: 60,
              layer: 3,
              data: {
                text: '# Findings\n\nThe **gateway** buffers to flash.',
                fontSize: 16,
                fontFamily: 'Inter',
                fontStyle: 'normal',
                fill: '#1a1a1a',
              },
            },
            {
              id: 'node-2',
              type: 'shape',
              x: 200,
              y: 400,
              width: 160,
              height: 90,
              layer: 3,
              data: {
                shapeType: 'rect',
                fill: 'transparent',
                stroke: '#1a1a1a',
                strokeWidth: 2,
                strokeDash: [],
              },
            },
          ],
        },
        { id: 'page-2', title: 'Open questions', nodes: [] },
      ],
    },
  ],
};

function buildUpgraded(workspace: unknown): string {
  const template = fs.readFileSync(TEMPLATE, 'utf8');
  const json = JSON.stringify(workspace, null, 2);
  const script = `<script id="powernote-data" type="application/json">\n${json}\n</script>`;
  const existing = /<script id="powernote-data"[^>]*>[\s\S]*?<\/script>/;
  if (existing.test(template)) return template.replace(existing, script);
  return template.replace('</head>', `${script}\n</head>`);
}

/** Serves the built artifact at a fake URL so no file is written to the repo. */
async function openUpgraded(page: import('@playwright/test').Page, html: string) {
  await page.route('**/upgraded-under-test.html', (route) =>
    route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html }),
  );
  await page.goto('/upgraded-under-test.html');
  await page.waitForSelector('[data-testid="canvas-container"]', { timeout: 20_000 });
}

test.describe('131 - Upgrade regression (REQ-UPDATE-020..024)', () => {
  test('the built artifact exists and is a real PowerNote build', async () => {
    expect(fs.existsSync(TEMPLATE)).toBe(true);
    const html = fs.readFileSync(TEMPLATE, 'utf8');
    expect(html).toContain('<div id="root">');
    // A rebuild that silently produced a stub would otherwise ship.
    expect(html.length).toBeGreaterThan(1_000_000);
  });

  test('a legacy notebook opens on the current build with its content intact', async ({ page }) => {
    await openUpgraded(page, buildUpgraded(LEGACY_WORKSPACE));

    const state = await page.evaluate(() => {
      const S = (window as any).__POWERNOTE_STORES__;
      const ws = S.workspace.getState();
      return {
        filename: ws.workspace.filename,
        sections: ws.workspace.sections.length,
        pages: ws.workspace.sections[0].pages.length,
        titles: ws.workspace.sections[0].pages.map((p: any) => p.title),
        nodes: S.canvas.getState().nodes.length,
        texts: S.canvas
          .getState()
          .nodes.filter((n: any) => n.type === 'text')
          .map((n: any) => n.data.text),
      };
    });

    expect(state.filename).toBe('Legacy Notes');
    expect(state.sections).toBe(1);
    expect(state.pages).toBe(2);
    expect(state.titles).toEqual(['Findings', 'Open questions']);
    // Both the text and the shape survived the version gap.
    expect(state.nodes).toBe(2);
    expect(state.texts[0]).toContain('The **gateway** buffers to flash.');
  });

  test('fields added since the legacy file are hydrated, not left undefined', async ({ page }) => {
    await openUpgraded(page, buildUpgraded(LEGACY_WORKSPACE));

    const hydrated = await page.evaluate(() => {
      const ws = (window as any).__POWERNOTE_STORES__.workspace.getState();
      const page1 = ws.workspace.sections[0].pages[0];
      return {
        scrolls: page1.scrolls?.length ?? 0,
        settings: !!ws.workspace.settings,
      };
    });

    // A page with no scroll record has nowhere for an agent to append.
    expect(hydrated.scrolls).toBeGreaterThan(0);
    expect(hydrated.settings).toBe(true);
  });

  test('the upgraded notebook can still be edited and re-saved', async ({ page }) => {
    await openUpgraded(page, buildUpgraded(LEGACY_WORKSPACE));

    const round = await page.evaluate(async () => {
      const S = (window as any).__POWERNOTE_STORES__;
      const blocks = await import('/src/bridge/blocks.ts').catch(() => null);
      // The built artifact has no module graph to import from, so add directly.
      const id = 'added-after-upgrade';
      S.canvas.getState().addNode({
        id, type: 'text', x: 120, y: 600, width: 794, height: 40, layer: 3,
        data: { text: 'added after upgrade', fontSize: 16, fontFamily: 'Inter', fontStyle: 'normal', fill: '#1a1a1a' },
      });
      void blocks;
      S.workspace.getState().savePageNodes(S.canvas.getState().nodes);
      // Re-read: zustand hands back a NEW state object, so the snapshot taken
      // before the save still points at the old workspace.
      const serialized = JSON.stringify(S.workspace.getState().workspace);
      return {
        nodes: S.canvas.getState().nodes.length,
        persisted: serialized.includes('added after upgrade'),
        legacyKept: serialized.includes('buffers to flash'),
      };
    });

    expect(round.nodes).toBe(3);
    expect(round.persisted).toBe(true);
    expect(round.legacyKept).toBe(true);
  });

  test('opening a legacy file migrates it onto the current build', async ({ page }) => {
    // The real migration path: run the NEW build, open an OLD notebook file, and
    // save. `handleOpen` rebinds the file handle, so the save writes the current
    // build into the old file -- which is how a notebook that cannot self-update
    // gets onto a new version.
    await openUpgraded(page, buildUpgraded({ ...LEGACY_WORKSPACE, filename: 'Fresh Build' }));

    const migrated = await page.evaluate(async (legacyHtml) => {
      const S = (window as any).__POWERNOTE_STORES__;
      const ser = await import('/src/utils/serialization.ts');
      const mig = await import('/src/utils/migrations.ts').catch(() => null);

      // Exactly what handleOpen does with the bytes of an old file.
      const data = ser.extractDataFromHtml(legacyHtml);
      const workspace = mig?.migrateWorkspace ? mig.migrateWorkspace(data) : data;
      S.workspace.setState({
        workspace,
        activeSectionId: workspace.sections[0].id,
        activePageId: workspace.sections[0].pages[0].id,
      });
      S.canvas.getState().loadPageNodes(workspace.sections[0].pages[0].nodes ?? []);

      const rebuilt = await ser.buildExportHtml(S.workspace.getState().workspace);
      return {
        loadedFilename: workspace.filename,
        nodes: S.canvas.getState().nodes.length,
        // The re-saved file carries the CURRENT build, not the old one.
        savedIsCurrentBuild: rebuilt.includes('<div id="root">'),
        savedKeepsContent: rebuilt.includes('buffers to flash'),
        scrollsHydrated: (workspace.sections[0].pages[0].scrolls ?? []).length > 0,
      };
    }, buildUpgraded(LEGACY_WORKSPACE));

    expect(migrated.loadedFilename).toBe('Legacy Notes');
    expect(migrated.nodes).toBe(2);
    expect(migrated.savedIsCurrentBuild).toBe(true);
    expect(migrated.savedKeepsContent).toBe(true);
    expect(migrated.scrollsHydrated).toBe(true);
  });

  test('with no file handle, the update downloads the new notebook and nothing else', async ({ page }) => {
    // The reported failure: a notebook opened by double-click has no file
    // handle, so live-swap is impossible and the update falls back to a
    // download. It used to emit the backup first and the new notebook second --
    // and browsers block a second programmatic download from one gesture, so
    // the backup arrived and the update silently did not.
    await openUpgraded(page, buildUpgraded(LEGACY_WORKSPACE));

    const result = await page.evaluate(async () => {
      const m = await import('/src/utils/updateChecker.ts');
      const ws = {
        version: '1', filename: 'My Notes', editorVersion: '0.33.0',
        sections: [{ id: 's1', title: 'S', pages: [{ id: 'p1', title: 'P', nodes: [
          { id: 'n1', type: 'text', x: 10, y: 10, width: 794, height: 40, layer: 3,
            data: { text: 'my real notes', fontSize: 16, fontFamily: 'Inter', fontStyle: 'normal', fill: '#111' } },
        ] }] }],
      };
      const downloads: any[] = [];
      const res = await m.performUpdate('', ws as any, '0.33.0', '9.9.9', {
        getHandle: async () => null,
        fetchTemplate: async () => '<html><head></head><body><div id="root"></div></body></html>',
        download: (content: string, name: string) =>
          downloads.push({ name, isBuild: content.includes('<div id="root">'), hasData: content.includes('my real notes') }),
        reload: () => {},
        buildBackupHtml: async () => 'BACKUP',
      });
      return { ok: res.ok, mode: (res as any).mode, downloads };
    });

    expect(result.ok).toBe(true);
    expect(result.mode).toBe('download');
    // Exactly one file, and it is the new notebook -- not a backup. Nothing was
    // overwritten on this path, so the file on disk is already the backup.
    expect(result.downloads).toHaveLength(1);
    expect(result.downloads[0].name).toContain('9.9.9');
    expect(result.downloads[0].isBuild).toBe(true);
    expect(result.downloads[0].hasData).toBe(true);
  });

  test('the live-swap path still backs up before overwriting', async ({ page }) => {
    await openUpgraded(page, buildUpgraded(LEGACY_WORKSPACE));

    const result = await page.evaluate(async () => {
      const m = await import('/src/utils/updateChecker.ts');
      const downloads: string[] = [];
      let written = '';
      const res = await m.performUpdate('', { version: '1', filename: 'N', sections: [] } as any, '0.33.0', '9.9.9', {
        getHandle: async () => ({} as any),
        verifyWritePermission: async () => true,
        writeHandle: async (_h: any, html: string) => { written = html; return true; },
        fetchTemplate: async () => '<html><head></head><body><div id="root"></div></body></html>',
        download: (_c: string, name: string) => downloads.push(name),
        reload: () => {},
        buildBackupHtml: async () => 'BACKUP',
      });
      return { ok: res.ok, mode: (res as any).mode, downloads, wroteBuild: written.includes('<div id="root">') };
    });

    expect(result.ok).toBe(true);
    expect(result.mode).toBe('live-swap');
    // Here the file IS overwritten, so a backup is the point.
    expect(result.downloads.some((n: string) => n.includes('backup'))).toBe(true);
    expect(result.wroteBuild).toBe(true);
  });
});
