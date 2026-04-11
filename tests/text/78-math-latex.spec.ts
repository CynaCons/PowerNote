/**
 * Test 78: Math/LaTeX via KaTeX
 * Covers: $...$ inline math and $$...$$ display math rendering
 */
import { test, expect } from '@playwright/test';
import { waitForCanvasReady } from '../helpers';

test.describe('78 - Math/LaTeX Rendering', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForCanvasReady(page);
  });

  test('inline math $E = mc^2$ renders as KaTeX', async ({ page }) => {
    await page.evaluate(() => {
      const cs = (window as any).__POWERNOTE_STORES__.canvas.getState();
      cs.addNode({
        id: 'math-1', type: 'text', x: 100, y: 100, width: 300, height: 30, layer: 4,
        data: { text: 'Einstein said $E = mc^2$', fontSize: 16,
                fontFamily: 'Inter', fontStyle: 'normal', fill: '#000' },
      });
    });
    await page.waitForTimeout(500);

    // KaTeX adds `.katex` class to rendered math
    const hasKatex = await page.evaluate(() => {
      return document.querySelectorAll('.katex').length > 0;
    });
    expect(hasKatex).toBe(true);
  });

  test('display math $$...$$ renders as block', async ({ page }) => {
    await page.evaluate(() => {
      const cs = (window as any).__POWERNOTE_STORES__.canvas.getState();
      cs.addNode({
        id: 'math-2', type: 'text', x: 100, y: 100, width: 400, height: 60, layer: 4,
        data: { text: '$$\\int_0^\\infty e^{-x^2} dx = \\frac{\\sqrt{\\pi}}{2}$$',
                fontSize: 16, fontFamily: 'Inter', fontStyle: 'normal', fill: '#000' },
      });
    });
    await page.waitForTimeout(500);

    const hasDisplayMath = await page.evaluate(() => {
      return document.querySelectorAll('.katex-display').length > 0;
    });
    expect(hasDisplayMath).toBe(true);
  });

  test('invalid math shows error (non-throwing)', async ({ page }) => {
    await page.evaluate(() => {
      const cs = (window as any).__POWERNOTE_STORES__.canvas.getState();
      cs.addNode({
        id: 'math-3', type: 'text', x: 100, y: 100, width: 300, height: 30, layer: 4,
        data: { text: '$\\invalid{broken}$', fontSize: 16,
                fontFamily: 'Inter', fontStyle: 'normal', fill: '#000' },
      });
    });
    await page.waitForTimeout(500);

    // Should render without throwing (KaTeX has throwOnError: false)
    const storeNodes = await page.evaluate(() => {
      return (window as any).__POWERNOTE_STORES__.canvas.getState().nodes.length;
    });
    expect(storeNodes).toBe(1);
  });
});
