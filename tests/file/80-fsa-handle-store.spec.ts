/**
 * Test 80: FileHandleStore (IndexedDB persistence)
 * Covers: setCurrentHandle/getCurrentHandle, addRecentHandle,
 *         removeRecentHandle, LRU cap at 5
 */
import { test, expect } from '@playwright/test';
import { waitForCanvasReady } from '../helpers';

test.describe('80 - FileHandleStore', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForCanvasReady(page);
    // Clear handle store contents via store API (works even if DB is open)
    await page.evaluate(async () => {
      const mod = await import('/src/utils/fileHandleStore.ts');
      await mod.clearCurrentHandle();
      await mod.clearAllRecentHandles();
    });
  });

  test('setCurrentHandle + getCurrentHandle round-trip', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const mod = await import('/src/utils/fileHandleStore.ts');
      // Use a plain object as a mock handle (IDB can structure-clone it)
      const mockHandle = { name: 'test.html', kind: 'file' } as any;
      await mod.setCurrentHandle(mockHandle);
      const retrieved = await mod.getCurrentHandle();
      return retrieved ? { name: retrieved.name, kind: (retrieved as any).kind } : null;
    });
    expect(result).toEqual({ name: 'test.html', kind: 'file' });
  });

  test('clearCurrentHandle removes the handle', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const mod = await import('/src/utils/fileHandleStore.ts');
      const mockHandle = { name: 'clearable.html', kind: 'file' } as any;
      await mod.setCurrentHandle(mockHandle);
      await mod.clearCurrentHandle();
      const retrieved = await mod.getCurrentHandle();
      return retrieved;
    });
    expect(result).toBeNull();
  });

  test('addRecentHandle stores up to 5 (LRU eviction)', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const mod = await import('/src/utils/fileHandleStore.ts');
      for (let i = 1; i <= 7; i++) {
        const mockHandle = { name: `file-${i}.html`, kind: 'file' } as any;
        await mod.addRecentHandle(`File ${i}`, mockHandle);
        // Small delay to differentiate updatedAt
        await new Promise((r) => setTimeout(r, 5));
      }
      return await mod.getRecentHandles();
    });
    expect(result).toHaveLength(5);
    const names = result.map((e: any) => e.name).sort();
    expect(names).toContain('File 7');
    expect(names).toContain('File 3');
    expect(names).not.toContain('File 1');
    expect(names).not.toContain('File 2');
  });

  test('addRecentHandle upserts by name', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const mod = await import('/src/utils/fileHandleStore.ts');
      const h1 = { name: 'old-handle.html', kind: 'file' } as any;
      const h2 = { name: 'new-handle.html', kind: 'file' } as any;
      await mod.addRecentHandle('Same Name', h1);
      await new Promise((r) => setTimeout(r, 5));
      await mod.addRecentHandle('Same Name', h2);
      return await mod.getRecentHandles();
    });
    expect(result).toHaveLength(1);
    expect(result[0].handle.name).toBe('new-handle.html');
  });

  test('removeRecentHandle deletes by id', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const mod = await import('/src/utils/fileHandleStore.ts');
      await mod.addRecentHandle('Keep Me', { name: 'keep.html', kind: 'file' } as any);
      await new Promise((r) => setTimeout(r, 5));
      await mod.addRecentHandle('Delete Me', { name: 'del.html', kind: 'file' } as any);
      const entries = await mod.getRecentHandles();
      const toDelete = entries.find((e: any) => e.name === 'Delete Me');
      if (toDelete) await mod.removeRecentHandle(toDelete.id);
      return await mod.getRecentHandles();
    });
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Keep Me');
  });
});
