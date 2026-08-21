// Covers: REQ-IMAGE-021, REQ-IMAGE-022, REQ-IMAGE-023
/**
 * Test 170: One embed pipeline for every image route + insert-from-URL.
 * Small images keep original bytes; oversized downscale to 2048 long edge
 * (JPEG when opaque, PNG when alpha); URL insert embeds a data URI and
 * never stores the URL; fetch failure toasts and persists nothing; paste
 * still lands a data-URI node.
 */
import { test, expect } from '@playwright/test';
import { waitForCanvasReady, getCanvasStore } from '../helpers';

const PNG_1X1_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';

const STUB_URL = 'https://images.example.test/photo.png';

async function waitForEmbedPipeline(page: import('@playwright/test').Page) {
  await page.waitForFunction(
    () => typeof (window as any).__POWERNOTE_UTILS__?.embedImage === 'function',
  );
}

async function waitForImageNode(page: import('@playwright/test').Page, count = 1) {
  await page.waitForFunction(
    (count) =>
      (window as any).__POWERNOTE_STORES__.canvas.getState().nodes.filter((n: any) => n.type === 'image')
        .length >= count,
    count,
  );
}

test.describe('170 - Image embed pipeline (REQ-IMAGE-021, REQ-IMAGE-022, REQ-IMAGE-023)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForCanvasReady(page);
    await waitForEmbedPipeline(page);
  });

  test('small PNG keeps original bytes and 300×200 dims', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const canvas = document.createElement('canvas');
      canvas.width = 300;
      canvas.height = 200;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#336699';
      ctx.fillRect(0, 0, 300, 200);
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png');
      });
      const inputSrc = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });
      const embed = await (window as any).__POWERNOTE_UTILS__.embedImage(blob);
      return {
        inputLen: inputSrc.length,
        src: embed.src as string,
        w: embed.naturalWidth as number,
        h: embed.naturalHeight as number,
      };
    });

    expect(result.src.startsWith('data:image/')).toBe(true);
    expect(result.src.length).toBe(result.inputLen);
    expect(result.w).toBe(300);
    expect(result.h).toBe(200);
  });

  test('oversized opaque image downscales to 2048 long edge JPEG', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const canvas = document.createElement('canvas');
      canvas.width = 4096;
      canvas.height = 1024;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#cc0000';
      ctx.fillRect(0, 0, 4096, 1024);
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png');
      });
      const embed = await (window as any).__POWERNOTE_UTILS__.embedImage(blob);
      return {
        src: embed.src as string,
        w: embed.naturalWidth as number,
        h: embed.naturalHeight as number,
      };
    });

    expect(result.src.startsWith('data:image/jpeg')).toBe(true);
    expect(Math.max(result.w, result.h)).toBe(2048);
    expect(result.w).toBe(2048);
    expect(result.h).toBe(512);
  });

  test('oversized image with transparency exports PNG and keeps alpha', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const canvas = document.createElement('canvas');
      canvas.width = 4096;
      canvas.height = 1024;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#00aa44';
      ctx.fillRect(0, 0, 4096, 1024);
      // Hole large enough that the every-16th-pixel alpha scan cannot miss it.
      ctx.clearRect(200, 200, 400, 400);
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png');
      });
      const embed = await (window as any).__POWERNOTE_UTILS__.embedImage(blob);
      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('result decode failed'));
        img.src = embed.src;
      });
      const out = document.createElement('canvas');
      out.width = img.naturalWidth;
      out.height = img.naturalHeight;
      const octx = out.getContext('2d')!;
      octx.drawImage(img, 0, 0);
      // Scaled hole: (100,100) size 200×200 on 2048×512.
      const px = octx.getImageData(150, 150, 1, 1).data;
      return {
        src: embed.src as string,
        w: embed.naturalWidth as number,
        h: embed.naturalHeight as number,
        alpha: px[3],
      };
    });

    expect(result.src.startsWith('data:image/png')).toBe(true);
    expect(result.w).toBe(2048);
    expect(result.h).toBe(512);
    expect(result.alpha).toBeLessThan(255);
  });

  test('URL insert embeds a data URI and never stores the stub URL', async ({ page }) => {
    await page.route(STUB_URL, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'image/png',
        headers: { 'access-control-allow-origin': '*' },
        body: Buffer.from(PNG_1X1_B64, 'base64'),
      });
    });

    await page.locator('[data-testid="nav-image-tool"]').click();
    await expect(page.locator('[data-testid="image-url-button"]')).toBeVisible();
    await page.locator('[data-testid="image-url-button"]').click();
    await page.locator('[data-testid="image-url-input"]').fill(STUB_URL);
    await page.locator('[data-testid="image-url-submit"]').click();
    await waitForImageNode(page);

    const store = await getCanvasStore(page);
    const image = store.nodes.find((n: { type: string }) => n.type === 'image');
    expect(image).toBeTruthy();
    expect(image.data.src.startsWith('data:image/')).toBe(true);
    expect(image.data.src).not.toContain(STUB_URL);
    expect(image.data.src).not.toContain('images.example.test');
  });

  test('URL fetch abort shows an error toast and adds no node', async ({ page }) => {
    await page.route(STUB_URL, (route) => route.abort('failed'));

    await page.locator('[data-testid="nav-image-tool"]').click();
    await page.locator('[data-testid="image-url-button"]').click();
    const before = (await getCanvasStore(page)).nodes.length;
    await page.locator('[data-testid="image-url-input"]').fill(STUB_URL);
    await page.locator('[data-testid="image-url-submit"]').click();

    const toast = page.locator('.toast--error');
    await expect(toast).toBeVisible();
    await expect(toast).toContainText(/fetch|network|CORS|image/i);

    const store = await getCanvasStore(page);
    expect(store.nodes.length).toBe(before);
    expect(store.nodes.some((n: { type: string }) => n.type === 'image')).toBe(false);
  });

  test('paste route still lands a data-URI image node', async ({ page }) => {
    await page.evaluate(async () => {
      const canvas = document.createElement('canvas');
      canvas.width = 40;
      canvas.height = 30;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#cc5533';
      ctx.fillRect(0, 0, 40, 30);
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png');
      });
      const file = new File([blob], 'pasted.png', { type: 'image/png' });
      const dt = new DataTransfer();
      dt.items.add(file);
      const ev = new ClipboardEvent('paste', { bubbles: true, cancelable: true });
      Object.defineProperty(ev, 'clipboardData', { value: dt });
      window.dispatchEvent(ev);
    });

    await waitForImageNode(page);
    const store = await getCanvasStore(page);
    const image = store.nodes.find((n: { type: string }) => n.type === 'image');
    expect(image).toBeTruthy();
    expect(image.data.src.startsWith('data:image/')).toBe(true);
  });
});
