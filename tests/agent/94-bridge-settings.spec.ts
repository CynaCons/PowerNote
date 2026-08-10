/**
 * Test 94: Agent Bridge Settings
 * Covers: REQ-AGENT-001, REQ-AGENT-002, REQ-AGENT-003 — The bridge is opt-in,
 * the flag is per-machine rather than per-notebook, and Settings reports status.
 *
 * Verifies the bridge does not dial out until the user enables it, that
 * enabling it writes to localStorage and NOT into the notebook data, and that
 * the status indicator reflects connection state.
 */
import { test, expect } from '@playwright/test';
import {
  waitForCanvasReady,
  waitForBridgeReady,
  getWorkspaceStore,
  stubBridgeUrl,
} from '../helpers';

test.describe('94 - Agent Bridge Settings (REQ-AGENT-001, REQ-AGENT-002, REQ-AGENT-003)', () => {
  test.beforeEach(async ({ page }) => {
    await stubBridgeUrl(page);
    await page.goto('/');
    await waitForCanvasReady(page);
    await waitForBridgeReady(page);
    await page.locator('[data-testid="nav-settings"]').click();
    await expect(page.locator('[data-testid="settings-panel"]')).toBeVisible();
  });

  test('bridge is off by default and reports "off"', async ({ page }) => {
    const toggle = page.locator('[data-testid="settings-bridge-toggle"]');
    await expect(toggle).not.toBeChecked();

    const status = page.locator('[data-testid="settings-bridge-status"]');
    await expect(status).toHaveAttribute('data-status', 'off');
  });

  test('bridge does not connect while disabled', async ({ page }) => {
    const state = await page.evaluate(() =>
      (window as any).__POWERNOTE_BRIDGE__.store.getState().status,
    );
    expect(state).toBe('off');
  });

  test('enabling the bridge starts dialing and persists to localStorage', async ({ page }) => {
    await page.locator('[data-testid="settings-bridge-toggle"]').check();

    // No server in the test env, so it settles into connecting/error — either
    // proves it left the "off" state and is actually trying.
    await expect
      .poll(async () =>
        page.locator('[data-testid="settings-bridge-status"]').getAttribute('data-status'),
      )
      .not.toBe('off');

    const persisted = await page.evaluate(() =>
      localStorage.getItem('powernote-bridge-enabled'),
    );
    expect(persisted).toBe('true');
  });

  test('the enable flag is never written into the notebook data', async ({ page }) => {
    await page.locator('[data-testid="settings-bridge-toggle"]').check();
    await expect(page.locator('[data-testid="settings-bridge-url"]')).toBeVisible();

    const { workspace } = await getWorkspaceStore(page);
    const serialized = JSON.stringify(workspace);
    expect(serialized).not.toContain('bridge');
    expect(workspace.settings).not.toHaveProperty('bridgeEnabled');
  });

  test('disabling the bridge returns status to off', async ({ page }) => {
    const toggle = page.locator('[data-testid="settings-bridge-toggle"]');
    await toggle.check();
    await toggle.uncheck();

    await expect(page.locator('[data-testid="settings-bridge-status"]')).toHaveAttribute(
      'data-status',
      'off',
    );
  });
});
