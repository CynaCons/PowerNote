/**
 * Bridge command handlers.
 *
 * These drive the same Zustand stores the UI drives — the agent is just
 * another editor. Two invariants make that safe:
 *
 *  1. `savePageNodes` only ever writes the ACTIVE page, so any command
 *     touching page P must navigate to P first (`navigateToPage`).
 *  2. Auto-save subscribes to the WORKSPACE store only. A canvas-store write
 *     (`addNode`/`updateNode`) does not schedule a save on its own, so every
 *     mutating command must `flush()` afterwards or the edit can sit unsaved.
 */

import type { CanvasNode, TextNodeData } from '../types/data';
import { useWorkspaceStore } from '../stores/useWorkspaceStore';
import { useCanvasStore } from '../stores/useCanvasStore';
import { useDrawStore } from '../stores/useDrawStore';
import { createBlockNode, blockHeight, columnOf, orderedTextNodes } from './blocks';
import { A4_WIDTH } from '../utils/pageLayout';
import type {
  AppendBlockResult,
  BridgeCommandName,
  BridgeErrorCode,
  CreatePageResult,
  CreateSectionResult,
  ListPagesResult,
  PageContent,
  UpdateBlockResult,
} from './protocol';

export class BridgeCommandError extends Error {
  code: BridgeErrorCode;
  constructor(code: BridgeErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = 'BridgeCommandError';
  }
}

// ── State helpers ───────────────────────────────────────────

/** Push live canvas/draw state back into the workspace (and mark it dirty). */
function flush(): void {
  const ws = useWorkspaceStore.getState();
  ws.savePageNodes(useCanvasStore.getState().nodes);
  ws.savePageStrokes(useDrawStore.getState().strokes);
}

function locatePage(pageId: string) {
  const { workspace } = useWorkspaceStore.getState();
  for (const section of workspace.sections) {
    const page = section.pages.find((p) => p.id === pageId);
    if (page) return { section, page };
  }
  return null;
}

/** Resolve an optional pageId to a concrete page, defaulting to the active one. */
function resolvePage(pageId?: string) {
  if (!pageId) {
    const ws = useWorkspaceStore.getState();
    const located = locatePage(ws.activePageId);
    if (!located) {
      throw new BridgeCommandError('INTERNAL', 'No active page in this notebook');
    }
    return located;
  }
  const located = locatePage(pageId);
  if (!located) {
    throw new BridgeCommandError('NOT_FOUND', `No page with id "${pageId}"`);
  }
  return located;
}

/**
 * Save the current page, switch, then load the target page's content.
 * Mirrors the navigation sequence used by the hierarchy panel and search.
 */
function navigateToPage(sectionId: string, pageId: string): void {
  const current = useWorkspaceStore.getState();
  if (current.activeSectionId === sectionId && current.activePageId === pageId) return;

  flush();
  useWorkspaceStore.getState().setActivePage(sectionId, pageId);

  // Re-read AFTER the flush so we load post-save content, not a stale snapshot.
  const ws = useWorkspaceStore.getState();
  const section = ws.workspace.sections.find((s) => s.id === sectionId);
  const page = section?.pages.find((p) => p.id === pageId);
  useCanvasStore.getState().loadPageNodes(page?.nodes ?? []);
  useDrawStore.getState().loadPageStrokes(page?.strokes ?? []);
}

function requireString(params: Record<string, unknown>, key: string): string {
  const value = params[key];
  if (typeof value !== 'string' || value.length === 0) {
    throw new BridgeCommandError('BAD_PARAMS', `"${key}" must be a non-empty string`);
  }
  return value;
}

/**
 * A4 column index to write into. 0 is the leftmost page guide; 1 is the guide
 * immediately to its right, and so on.
 */
function optionalColumn(params: Record<string, unknown>): number {
  const value = params.column;
  if (value === undefined || value === null) return 0;
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    throw new BridgeCommandError(
      'BAD_PARAMS',
      '"column" must be a non-negative integer (0 = leftmost page guide)',
    );
  }
  return value;
}

function optionalString(params: Record<string, unknown>, key: string): string | undefined {
  const value = params[key];
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string') {
    throw new BridgeCommandError('BAD_PARAMS', `"${key}" must be a string when provided`);
  }
  return value;
}

// ── Commands ────────────────────────────────────────────────

function listPages(): ListPagesResult {
  flush();
  const { workspace, activePageId } = useWorkspaceStore.getState();
  const pages = workspace.sections.flatMap((section) =>
    section.pages.map((page) => ({
      sectionId: section.id,
      sectionTitle: section.title,
      pageId: page.id,
      title: page.title,
      blockCount: page.nodes.filter((n) => n.type === 'text').length,
      isActive: page.id === activePageId,
    })),
  );
  return { notebook: workspace.filename, pages };
}

function readPage(params: Record<string, unknown>): PageContent {
  flush();
  const { section, page } = resolvePage(optionalString(params, 'pageId'));
  return {
    sectionId: section.id,
    pageId: page.id,
    title: page.title,
    blocks: orderedTextNodes(page.nodes).map((node) => ({
      blockId: node.id,
      markdown: (node.data as TextNodeData).text,
      column: columnOf(node),
    })),
  };
}

function createSection(params: Record<string, unknown>): CreateSectionResult {
  flush();
  const title = requireString(params, 'title');
  useWorkspaceStore.getState().addSection(title);

  // addSection returns void — the new section is appended last.
  const { workspace } = useWorkspaceStore.getState();
  const section = workspace.sections[workspace.sections.length - 1];
  return { sectionId: section.id, title: section.title, pageId: section.pages[0].id };
}

async function createPage(params: Record<string, unknown>): Promise<CreatePageResult> {
  flush();
  const title = requireString(params, 'title');
  const withHeading = params.withHeading !== false;
  const column = optionalColumn(params);

  const sectionId = optionalString(params, 'sectionId')
    ?? useWorkspaceStore.getState().activeSectionId;
  const exists = useWorkspaceStore
    .getState()
    .workspace.sections.some((s) => s.id === sectionId);
  if (!exists) {
    throw new BridgeCommandError('NOT_FOUND', `No section with id "${sectionId}"`);
  }

  useWorkspaceStore.getState().addPage(sectionId, title);

  // addPage returns void — the new page is appended last in its section.
  const section = useWorkspaceStore
    .getState()
    .workspace.sections.find((s) => s.id === sectionId)!;
  const page = section.pages[section.pages.length - 1];

  navigateToPage(sectionId, page.id);

  let headingBlockId: string | undefined;
  if (withHeading) {
    // Put the title on the canvas too, not just in the sidebar, so the page
    // reads as a titled note.
    const node = createBlockNode(`# ${title}`, useCanvasStore.getState().nodes, column);
    useCanvasStore.getState().addNode(node);
    headingBlockId = node.id;
  }
  flush();

  return { sectionId, pageId: page.id, title, headingBlockId };
}

async function appendBlock(params: Record<string, unknown>): Promise<AppendBlockResult> {
  flush();
  const markdown = requireString(params, 'markdown');
  const column = optionalColumn(params);
  const { section, page } = resolvePage(optionalString(params, 'pageId'));

  navigateToPage(section.id, page.id);

  const node = createBlockNode(markdown, useCanvasStore.getState().nodes, column);
  useCanvasStore.getState().addNode(node);
  flush();

  return { sectionId: section.id, pageId: page.id, blockId: node.id, column };
}

async function updateBlock(params: Record<string, unknown>): Promise<UpdateBlockResult> {
  flush();
  const blockId = requireString(params, 'blockId');
  const markdown = requireString(params, 'markdown');

  const { workspace } = useWorkspaceStore.getState();
  let found: { sectionId: string; pageId: string; node: CanvasNode } | null = null;
  for (const section of workspace.sections) {
    for (const page of section.pages) {
      const node = page.nodes.find((n) => n.id === blockId);
      if (node) {
        found = { sectionId: section.id, pageId: page.id, node };
        break;
      }
    }
    if (found) break;
  }
  if (!found) {
    throw new BridgeCommandError('NOT_FOUND', `No block with id "${blockId}"`);
  }
  if (found.node.type !== 'text') {
    throw new BridgeCommandError(
      'UNSUPPORTED',
      `Block "${blockId}" is a ${found.node.type} node; only text blocks are editable over the bridge`,
    );
  }

  navigateToPage(found.sectionId, found.pageId);

  const previous = found.node.data as TextNodeData;
  const updated: TextNodeData = { ...previous, text: markdown };
  useCanvasStore.getState().updateNode(blockId, {
    data: updated,
    height: blockHeight(markdown, found.node.width || A4_WIDTH, updated),
  });
  flush();

  return { blockId };
}

// ── Dispatch ────────────────────────────────────────────────

type Handler = (params: Record<string, unknown>) => unknown | Promise<unknown>;

const HANDLERS: Record<BridgeCommandName, Handler> = {
  list_pages: listPages,
  read_page: readPage,
  create_section: createSection,
  create_page: createPage,
  append_block: appendBlock,
  update_block: updateBlock,
};

export async function runBridgeCommand(
  cmd: string,
  params: Record<string, unknown>,
): Promise<unknown> {
  const handler = HANDLERS[cmd as BridgeCommandName];
  if (!handler) {
    throw new BridgeCommandError('UNSUPPORTED', `Unknown command "${cmd}"`);
  }
  return await handler(params ?? {});
}
