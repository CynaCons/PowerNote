/**
 * Test 96: Agent Markdown Blocks
 * Covers: REQ-AGENT-007, REQ-AGENT-008, REQ-AGENT-009, REQ-AGENT-010 —
 * Appending, rendering, reading back and updating markdown blocks.
 *
 * Verifies blocks stack without overlapping, render as markdown (including
 * checklists the user can click), read back in order with stable ids, and can
 * be replaced by id.
 */
import { test, expect } from '@playwright/test';
import {
  waitForCanvasReady,
  waitForBridgeReady,
  runBridge,
  getCanvasStore,
} from '../helpers';

const CHECKLIST = ['- [ ] Draft the SRS', '- [ ] Wire the bridge', '- [ ] Ship it'].join('\n');

test.describe('96 - Agent Blocks (REQ-AGENT-007..010)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForCanvasReady(page);
    await waitForBridgeReady(page);
  });

  test('append_block creates a full-page-width text node', async ({ page }) => {
    const result = await runBridge(page, 'append_block', { markdown: 'Hello from the agent' });
    expect(result.blockId).toBeTruthy();

    const canvas = await getCanvasStore(page);
    const node = canvas.nodes.find((n: any) => n.id === result.blockId);
    expect(node.type).toBe('text');
    expect(node.data.text).toBe('Hello from the agent');
    expect(node.width).toBe(794); // A4_WIDTH
    expect(node.x).toBe(60); // PAGE_MARGIN
  });

  test('successive blocks stack downward without overlapping', async ({ page }) => {
    await runBridge(page, 'append_block', { markdown: '# Meeting notes' });
    await runBridge(page, 'append_block', { markdown: CHECKLIST });
    await runBridge(page, 'append_block', { markdown: 'Follow up on Friday.' });

    const canvas = await getCanvasStore(page);
    const nodes = [...canvas.nodes].sort((a: any, b: any) => a.y - b.y);
    expect(nodes).toHaveLength(3);

    for (let i = 1; i < nodes.length; i++) {
      const prev = nodes[i - 1];
      const curr = nodes[i];
      expect(curr.y).toBeGreaterThanOrEqual(prev.y + prev.height);
    }
  });

  test('read_page returns blocks in order with stable ids', async ({ page }) => {
    const a = await runBridge(page, 'append_block', { markdown: 'First' });
    const b = await runBridge(page, 'append_block', { markdown: 'Second' });
    const c = await runBridge(page, 'append_block', { markdown: 'Third' });

    const content = await runBridge(page, 'read_page');
    expect(content.blocks.map((x: any) => x.markdown)).toEqual(['First', 'Second', 'Third']);
    expect(content.blocks.map((x: any) => x.blockId)).toEqual([a.blockId, b.blockId, c.blockId]);
  });

  test('update_block replaces content by id', async ({ page }) => {
    const block = await runBridge(page, 'append_block', { markdown: '- [ ] Todo' });
    await runBridge(page, 'update_block', { blockId: block.blockId, markdown: '- [x] Todo' });

    const content = await runBridge(page, 'read_page');
    const updated = content.blocks.find((x: any) => x.blockId === block.blockId);
    expect(updated.markdown).toBe('- [x] Todo');
  });

  test('an agent-written checklist renders as checkboxes the user can tick', async ({ page }) => {
    const block = await runBridge(page, 'append_block', { markdown: CHECKLIST });

    const checkboxes = page.locator('input[type="checkbox"]');
    await expect(checkboxes).toHaveCount(3);
    await expect(checkboxes.first()).not.toBeChecked();

    // Clicking the rendered checkbox must write back into the raw markdown.
    await checkboxes.first().click();

    await expect
      .poll(async () => {
        const content = await runBridge(page, 'read_page');
        return content.blocks.find((x: any) => x.blockId === block.blockId).markdown;
      })
      .toContain('- [x] Draft the SRS');
  });

  test('markdown formatting renders rather than showing raw syntax', async ({ page }) => {
    await runBridge(page, 'append_block', {
      markdown: '## Agenda\n\n1. **Bold item**\n2. `code item`',
    });

    await expect(page.locator('h2', { hasText: 'Agenda' })).toBeVisible();
    await expect(page.locator('strong', { hasText: 'Bold item' })).toBeVisible();
    await expect(page.locator('code', { hasText: 'code item' })).toBeVisible();
  });
});
