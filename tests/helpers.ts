import type { Page } from '@playwright/test';

/**
 * Read the canvas store state from the app via window.__POWERNOTE_STORES__
 */
export async function getCanvasStore(page: Page) {
  return page.evaluate(() => {
    const stores = (window as any).__POWERNOTE_STORES__;
    if (!stores) throw new Error('Stores not exposed on window');
    const state = stores.canvas.getState();
    return {
      nodes: state.nodes,
      viewport: state.viewport,
      selectedNodeIds: state.selectedNodeIds,
      // Backward compat: first selected or null
      selectedNodeId: state.selectedNodeIds?.[0] ?? null,
    };
  });
}

/**
 * Read the workspace store state
 */
export async function getWorkspaceStore(page: Page) {
  return page.evaluate(() => {
    const stores = (window as any).__POWERNOTE_STORES__;
    if (!stores) throw new Error('Stores not exposed on window');
    const state = stores.workspace.getState();
    return {
      workspace: state.workspace,
      activeSectionId: state.activeSectionId,
      activePageId: state.activePageId,
    };
  });
}

/**
 * Read the tool store state
 */
export async function getToolStore(page: Page) {
  return page.evaluate(() => {
    const stores = (window as any).__POWERNOTE_STORES__;
    if (!stores) throw new Error('Stores not exposed on window');
    const state = stores.tool.getState();
    return {
      activeTool: state.activeTool,
      textOptions: state.textOptions,
    };
  });
}

/**
 * Click on the Konva canvas at specific viewport coordinates
 */
export async function clickCanvas(page: Page, x: number, y: number) {
  const canvas = page.locator('[data-testid="canvas-container"] canvas').last();
  await canvas.click({ position: { x, y } });
}

/**
 * Double-click on the Konva canvas at specific viewport coordinates
 */
export async function dblClickCanvas(page: Page, x: number, y: number) {
  const canvas = page.locator('[data-testid="canvas-container"] canvas').last();
  await canvas.dblclick({ position: { x, y } });
}

/**
 * Wait for the canvas to be ready (Stage rendered)
 */
export async function waitForCanvasReady(page: Page) {
  await page.locator('[data-testid="canvas-container"] canvas').first().waitFor({ state: 'visible' });
}

/**
 * Activate a tool by clicking its NavRail button
 */
export async function activateTool(page: Page, tool: 'text' | 'hierarchy') {
  const testId = tool === 'text' ? 'nav-text-tool' : 'nav-hierarchy';
  await page.locator(`[data-testid="${testId}"]`).click();
}

/**
 * Disable the File System Access API in the page, forcing the app to use
 * the legacy download-based save flow. Call this in beforeEach for tests
 * that rely on `page.waitForEvent('download')`.
 *
 * Must be called BEFORE page.goto() — uses addInitScript to run before
 * any app code executes.
 */
export async function disableFSA(page: Page) {
  await page.addInitScript(() => {
    try {
      delete (window as any).showSaveFilePicker;
      delete (window as any).showOpenFilePicker;
      delete (window as any).showDirectoryPicker;
    } catch {
      // Some browsers don't allow deleting window properties; override with undefined
      (window as any).showSaveFilePicker = undefined;
      (window as any).showOpenFilePicker = undefined;
      (window as any).showDirectoryPicker = undefined;
    }
  });
}
