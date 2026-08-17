/**
 * Test 145: Installable app manifest
 * Covers: REQ-SETTINGS-017
 *
 * index.html links a manifest.webmanifest declaring display: standalone and
 * two icon sizes (192/512), generated from public/favicon.svg's colours.
 * No service worker is added — the manifest link comments that offline
 * support is deferred deliberately; this only makes the app installable.
 */
import { test, expect } from '@playwright/test';
import { waitForCanvasReady } from '../helpers';

test.describe('145 - Installable app manifest (REQ-SETTINGS-017)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForCanvasReady(page);
  });

  test('the manifest link resolves to valid JSON with standalone display and 2 fetchable icons', async ({ page }) => {
    const linkCount = await page.locator('link[rel="manifest"]').count();
    expect(linkCount).toBe(1);

    const href = await page.locator('link[rel="manifest"]').getAttribute('href');
    expect(href).toBeTruthy();

    const manifestRes = await page.request.get(href!);
    expect(manifestRes.status()).toBe(200);

    const manifest = await manifestRes.json();
    expect(manifest.display).toBe('standalone');
    expect(Array.isArray(manifest.icons)).toBe(true);
    expect(manifest.icons).toHaveLength(2);

    for (const icon of manifest.icons) {
      expect(typeof icon.src).toBe('string');
      const iconRes = await page.request.get(icon.src);
      expect(iconRes.status()).toBe(200);
    }
  });
});
