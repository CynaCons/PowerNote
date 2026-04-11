/**
 * Test 77: Notebook Library
 * Covers: saving to library, loading from library, capping at 5 entries
 */
import { test, expect } from '@playwright/test';
import { waitForCanvasReady } from '../helpers';

test.describe('77 - Notebook Library', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForCanvasReady(page);
    // Clear library before each test
    await page.evaluate(() => localStorage.removeItem('powernote-library'));
  });

  test('saveToLibrary stores a workspace snapshot', async ({ page }) => {
    const saved = await page.evaluate(async () => {
      const { saveToLibrary, loadLibrary } = await import('/src/utils/notebookLibrary.ts');
      const ws = (window as any).__POWERNOTE_STORES__.workspace.getState().workspace;
      ws.filename = 'Test Notebook A';
      saveToLibrary(ws);
      return loadLibrary();
    });
    expect(saved).toHaveLength(1);
    expect(saved[0].name).toBe('Test Notebook A');
  });

  test('library caps at 5 entries (LRU eviction)', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { saveToLibrary, loadLibrary } = await import('/src/utils/notebookLibrary.ts');
      const base = (window as any).__POWERNOTE_STORES__.workspace.getState().workspace;

      // Save 7 notebooks with different names
      for (let i = 1; i <= 7; i++) {
        saveToLibrary({ ...base, filename: `Notebook ${i}` });
        // Small delay to ensure different updatedAt
        await new Promise(r => setTimeout(r, 5));
      }
      return loadLibrary();
    });
    expect(result).toHaveLength(5);
    // Most recent 5 kept (3, 4, 5, 6, 7)
    const names = result.map((e: any) => e.name).sort();
    expect(names).toContain('Notebook 7');
    expect(names).toContain('Notebook 3');
    expect(names).not.toContain('Notebook 1');
    expect(names).not.toContain('Notebook 2');
  });

  test('upsert by name updates existing entry', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { saveToLibrary, loadLibrary } = await import('/src/utils/notebookLibrary.ts');
      const ws: any = (window as any).__POWERNOTE_STORES__.workspace.getState().workspace;

      // Save same name twice with different content
      saveToLibrary({ ...ws, filename: 'Same Name', sections: [{ id: 's1', title: 'v1', pages: [{ id: 'p1', title: 'P', nodes: [], strokes: [] }] }] });
      await new Promise(r => setTimeout(r, 5));
      saveToLibrary({ ...ws, filename: 'Same Name', sections: [{ id: 's1', title: 'v2', pages: [{ id: 'p1', title: 'P', nodes: [], strokes: [] }] }] });

      return loadLibrary();
    });
    expect(result).toHaveLength(1);
    expect(result[0].workspace.sections[0].title).toBe('v2');
  });

  test('deleteFromLibrary removes entry', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { saveToLibrary, deleteFromLibrary, loadLibrary } = await import('/src/utils/notebookLibrary.ts');
      const ws = (window as any).__POWERNOTE_STORES__.workspace.getState().workspace;

      const a = saveToLibrary({ ...ws, filename: 'Delete Me' });
      saveToLibrary({ ...ws, filename: 'Keep Me' });
      if (a?.id) deleteFromLibrary(a.id);

      return loadLibrary();
    });
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Keep Me');
  });

  test('library panel opens from NavRail', async ({ page }) => {
    await page.locator('[data-testid="nav-library"]').click();
    await page.waitForTimeout(200);
    const panel = page.locator('[data-testid="library-panel"]');
    await expect(panel).toBeVisible();
  });
});
