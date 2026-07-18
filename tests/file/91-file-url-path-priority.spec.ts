/**
 * Test 91: file:// absolute path vs stale FSA handle
 * Covers: REQ-FILE-023
 *
 * When the tab is a local HTML file, the path indicator must show the
 * decoded absolute OS path — not a leftover IndexedDB handle name.
 * Booting from embedded file:// data clears the current handle.
 */
import { test, expect } from '@playwright/test';
import { waitForCanvasReady } from '../helpers';

test.describe('91 - file:// path priority (REQ-FILE-023)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForCanvasReady(page);
    await page.evaluate(async () => {
      const { clearCurrentHandle } = await import('/src/utils/fileHandleStore.ts');
      await clearCurrentHandle();
    });
  });

  test('resolveFileUrlLabel decodes Downloads-style paths with spaces', async ({ page }) => {
    const formatted = await page.evaluate(async () => {
      const { resolveFileUrlLabel } = await import('/src/stores/useFileBindingStore.ts');
      return resolveFileUrlLabel('file:', '/C:/Users/cynak/Downloads/PowerNote%20(4).html');
    });

    expect(formatted).toBe('C:\\Users\\cynak\\Downloads\\PowerNote (4).html');
  });

  test('resolveFileUrlLabel returns null for http(s)', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { resolveFileUrlLabel } = await import('/src/stores/useFileBindingStore.ts');
      return {
        http: resolveFileUrlLabel('http:', '/C:/Users/cynak/Downloads/PowerNote%20(4).html'),
        https: resolveFileUrlLabel('https:', '/notes/x.html'),
      };
    });

    expect(result.http).toBeNull();
    expect(result.https).toBeNull();
  });

  test('clearing a stale handle then applying file:// label replaces wrong FSA name', async ({ page }) => {
    const beforeClear = await page.evaluate(async () => {
      const { setCurrentHandle } = await import('/src/utils/fileHandleStore.ts');
      const { useFileBindingStore } = await import('/src/stores/useFileBindingStore.ts');
      await setCurrentHandle({ name: 'Take Action Now.html' } as FileSystemFileHandle);
      return useFileBindingStore.getState().label;
    });
    expect(beforeClear).toBe('Take Action Now.html');

    await page.evaluate(async () => {
      const { clearCurrentHandle } = await import('/src/utils/fileHandleStore.ts');
      const { useFileBindingStore, resolveFileUrlLabel } = await import(
        '/src/stores/useFileBindingStore.ts'
      );
      // file:// boot: clear handle, then bind to the tab document path
      await clearCurrentHandle();
      const abs = resolveFileUrlLabel(
        'file:',
        '/C:/Users/cynak/Downloads/PowerNote%20(4).html',
      );
      useFileBindingStore.setState({ label: abs, source: 'file-url' });
    });

    await expect(page.locator('[data-testid="topbar-file-path"]')).toHaveText(
      'C:\\Users\\cynak\\Downloads\\PowerNote (4).html',
    );
    await expect(page.locator('[data-testid="topbar-file-path"]')).not.toHaveText(
      'Take Action Now.html',
    );

    const handleGone = await page.evaluate(async () => {
      const { getCurrentHandle } = await import('/src/utils/fileHandleStore.ts');
      return (await getCurrentHandle()) === null;
    });
    expect(handleGone).toBe(true);
  });

  test('refresh with no handle stays unlinked on http (dev server)', async ({ page }) => {
    await page.evaluate(async () => {
      const { clearCurrentHandle } = await import('/src/utils/fileHandleStore.ts');
      const { useFileBindingStore } = await import('/src/stores/useFileBindingStore.ts');
      await clearCurrentHandle();
      useFileBindingStore.getState().setFromHandle({ name: 'Temp.html' });
      await clearCurrentHandle();
      await useFileBindingStore.getState().refresh();
    });

    await expect(page.locator('[data-testid="topbar-file-path"]')).toHaveText(
      'Not linked to a file',
    );
  });
});
