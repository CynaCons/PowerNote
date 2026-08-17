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

import type {
  BackgroundMode,
  CanvasBgColor,
  CanvasNode,
  TextNodeData,
  WorkspaceSettings,
} from '../types/data';
import { notebookSettings, resolvePageSettings } from '../utils/pageSettings';
import { useWorkspaceStore } from '../stores/useWorkspaceStore';
import { useCanvasStore } from '../stores/useCanvasStore';
import { useDrawStore } from '../stores/useDrawStore';
import { createBlockNode, blockHeight, columnOf, orderedTextNodes, nextBlockY } from './blocks';
import { columnX } from './blocks';
import { placeDiagramOnCanvas } from '../diagram/canvasOps';
import { sniffFormat, normalizeDrawioSource } from '../diagram';
import { A4_WIDTH } from '../utils/pageLayout';
import { scrollById } from '../utils/scrolls';
import type {
  AppendBlockResult,
  CreateDiagramResult,
  BackgroundResult,
  BridgeCommandName,
  BridgeErrorCode,
  CheckUpdateResult,
  CreatePageResult,
  CreateScrollResult,
  CreateSectionResult,
  DeleteResult,
  DiagramSourceFormat,
  ListPagesResult,
  ListScrollsResult,
  MovePageResult,
  PageContent,
  RenameNotebookResult,
  RenamePageResult,
  RenameScrollResult,
  RunUpdateResult,
  SaveNotebookResult,
  ScrollSummary,
  UpdateBlockResult,
} from './protocol';
import { APP_VERSION } from '../version';
import { checkForUpdate, performUpdate } from '../utils/updateChecker';
import { isFSASupported } from '../utils/fileSystemAccess';
import { getCurrentHandle } from '../utils/fileHandleStore';

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
 * Resolve where a write lands, preferring an explicit scroll over a raw column.
 *
 * `scrollId` is the supported way to target a band: it survives reordering, and
 * it fails loudly when the agent is holding a stale id. `column` predates
 * scrolls and stays working, but it is positional — an agent using it can
 * silently write into a scroll that moved under it.
 */
function resolveColumn(
  params: Record<string, unknown>,
  page: import('../types/data').Page,
): number {
  const scrollId = optionalString(params, 'scrollId');
  if (scrollId) {
    const scroll = scrollById(page.scrolls, scrollId);
    if (!scroll) {
      const known = (page.scrolls ?? [])
        .map((s) => `"${s.id}"${s.title ? ` (${s.title})` : ''}`)
        .join(', ');
      throw new BridgeCommandError(
        'NOT_FOUND',
        `No scroll with id "${scrollId}" on page "${page.title}". ` +
          (known ? `Known scrolls: ${known}.` : 'This page has no scrolls.') +
          ' Call list_scrolls to refresh.',
      );
    }
    return scroll.column;
  }
  return optionalColumn(params);
}

/** Scroll id covering a column band, if the page has a record for it. */
function scrollIdForColumn(
  page: import('../types/data').Page,
  column: number,
): string | undefined {
  return page.scrolls?.find((s) => s.column === column)?.id;
}

function summariseScrolls(page: import('../types/data').Page): ScrollSummary[] {
  return [...(page.scrolls ?? [])]
    .sort((a, b) => a.column - b.column)
    .map((scroll) => ({
      scrollId: scroll.id,
      title: scroll.title,
      column: scroll.column,
      blockCount: page.nodes.filter(
        (n) => n.type === 'text' && columnOf(n) === scroll.column,
      ).length,
    }));
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
    blocks: orderedTextNodes(page.nodes).map((node) => {
      const column = columnOf(node);
      return {
        blockId: node.id,
        markdown: (node.data as TextNodeData).text,
        column,
        scrollId: scrollIdForColumn(page, column),
      };
    }),
    scrolls: summariseScrolls(page),
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
    const node = createBlockNode(`# ${title}`, useCanvasStore.getState().nodes, column, page.scrolls);
    useCanvasStore.getState().addNode(node);
    headingBlockId = node.id;
  }
  flush();

  return { sectionId, pageId: page.id, title, headingBlockId };
}

async function appendBlock(params: Record<string, unknown>): Promise<AppendBlockResult> {
  flush();
  const markdown = requireString(params, 'markdown');
  const { section, page } = resolvePage(optionalString(params, 'pageId'));
  const column = resolveColumn(params, page);

  navigateToPage(section.id, page.id);

  const node = createBlockNode(markdown, useCanvasStore.getState().nodes, column, page.scrolls);
  useCanvasStore.getState().addNode(node);
  flush();

  return {
    sectionId: section.id,
    pageId: page.id,
    blockId: node.id,
    column,
    scrollId: scrollIdForColumn(page, column),
  };
}

// ── Scrolls ─────────────────────────────────────────────────

function listScrolls(params: Record<string, unknown>): ListScrollsResult {
  flush();
  const { section, page } = resolvePage(optionalString(params, 'pageId'));
  return {
    sectionId: section.id,
    pageId: page.id,
    pageTitle: page.title,
    scrolls: summariseScrolls(page),
  };
}

function createScrollCmd(params: Record<string, unknown>): CreateScrollResult {
  flush();
  const title = requireString(params, 'title');
  const { section, page } = resolvePage(optionalString(params, 'pageId'));

  const record = useWorkspaceStore.getState().createScroll(page.id, title);
  if (!record) {
    throw new BridgeCommandError('INTERNAL', `Could not create a scroll on page "${page.id}"`);
  }

  return {
    sectionId: section.id,
    pageId: page.id,
    scrollId: record.id,
    title: record.title,
    column: record.column,
  };
}

function renameScrollCmd(params: Record<string, unknown>): RenameScrollResult {
  flush();
  const scrollId = requireString(params, 'scrollId');
  const title = requireString(params, 'title');

  const { workspace } = useWorkspaceStore.getState();
  for (const section of workspace.sections) {
    for (const page of section.pages) {
      const scroll = scrollById(page.scrolls, scrollId);
      if (!scroll) continue;
      useWorkspaceStore.getState().renameScroll(page.id, scrollId, title);
      return { scrollId, title, previousTitle: scroll.title };
    }
  }

  throw new BridgeCommandError(
    'NOT_FOUND',
    `No scroll with id "${scrollId}" in this notebook. Call list_scrolls to refresh.`,
  );
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

// ── Deletes ─────────────────────────────────────────────────

/**
 * Every delete verb demands `confirm: true`.
 *
 * The bridge has no undo an agent can reach, so a mistaken delete is final for
 * anything not yet saved elsewhere. The flag makes destruction an explicit act
 * rather than something a model can do by getting one argument wrong — the same
 * guard `run_update` uses.
 */
function requireConfirm(params: Record<string, unknown>, what: string): void {
  if (params.confirm !== true) {
    throw new BridgeCommandError(
      'BAD_PARAMS',
      `Deleting ${what} cannot be undone from the bridge. Pass confirm:true once the user has agreed.`,
    );
  }
}

function deletePageCmd(params: Record<string, unknown>): DeleteResult {
  flush();
  requireConfirm(params, 'a page');
  const { section, page } = resolvePage(optionalString(params, 'pageId'));

  // The store silently refuses to empty a section; say why rather than
  // reporting a success that did not happen.
  if (section.pages.length <= 1) {
    throw new BridgeCommandError(
      'PRECONDITION',
      `"${page.title}" is the only page in "${section.title}". Every section must keep at least ` +
        'one page — create another there first, or delete the section instead.',
    );
  }

  const wasActive = useWorkspaceStore.getState().activePageId === page.id;
  useWorkspaceStore.getState().deletePage(section.id, page.id);

  // deletePage moves activePageId but cannot touch the canvas store, so the
  // deleted page's blocks would otherwise stay on screen and be flushed back
  // onto whichever page became active.
  if (wasActive) {
    const ws = useWorkspaceStore.getState();
    const nowActive = ws.workspace.sections
      .find((s) => s.id === ws.activeSectionId)
      ?.pages.find((p) => p.id === ws.activePageId);
    useCanvasStore.getState().loadPageNodes(nowActive?.nodes ?? []);
    useDrawStore.getState().loadPageStrokes(nowActive?.strokes ?? []);
  }

  return { deleted: 'page', id: page.id, title: page.title };
}

function deleteSectionCmd(params: Record<string, unknown>): DeleteResult {
  flush();
  requireConfirm(params, 'a section and every page in it');
  const sectionId = requireString(params, 'sectionId');

  const ws = useWorkspaceStore.getState();
  const section = ws.workspace.sections.find((s) => s.id === sectionId);
  if (!section) {
    throw new BridgeCommandError('NOT_FOUND', `No section with id "${sectionId}"`);
  }
  if (ws.workspace.sections.length <= 1) {
    throw new BridgeCommandError(
      'PRECONDITION',
      `"${section.title}" is the only section in this notebook, and a notebook must keep at least one.`,
    );
  }

  const hadActive = section.pages.some((p) => p.id === ws.activePageId);
  useWorkspaceStore.getState().deleteSection(sectionId);

  if (hadActive) {
    const next = useWorkspaceStore.getState();
    const page = next.workspace.sections
      .find((s) => s.id === next.activeSectionId)
      ?.pages.find((p) => p.id === next.activePageId);
    useCanvasStore.getState().loadPageNodes(page?.nodes ?? []);
    useDrawStore.getState().loadPageStrokes(page?.strokes ?? []);
  }

  return { deleted: 'section', id: sectionId, title: section.title };
}

async function deleteScrollCmd(params: Record<string, unknown>): Promise<DeleteResult> {
  flush();
  const withBlocks = params.withBlocks === true;
  requireConfirm(params, withBlocks ? 'a scroll and its blocks' : 'a scroll');
  const scrollId = requireString(params, 'scrollId');

  const { workspace } = useWorkspaceStore.getState();
  for (const section of workspace.sections) {
    for (const page of section.pages) {
      const scroll = scrollById(page.scrolls, scrollId);
      if (!scroll) continue;

      if ((page.scrolls ?? []).length <= 1) {
        throw new BridgeCommandError(
          'PRECONDITION',
          `"${scroll.title || scrollId}" is the only scroll on "${page.title}", and a page must ` +
            'keep at least one for content to be appended to.',
        );
      }

      const blocksRemoved = withBlocks
        ? page.nodes.filter((n) => columnOf(n) === scroll.column).length
        : 0;

      const { deleteScroll } = await import('../utils/scrollOps');
      deleteScroll(page.id, scrollId, withBlocks);

      return {
        deleted: 'scroll',
        id: scrollId,
        title: scroll.title,
        blocksRemoved,
      };
    }
  }

  throw new BridgeCommandError(
    'NOT_FOUND',
    `No scroll with id "${scrollId}" in this notebook. Call list_scrolls to refresh.`,
  );
}

function deleteBlockCmd(params: Record<string, unknown>): DeleteResult {
  flush();
  requireConfirm(params, 'a block');
  const blockId = requireString(params, 'blockId');

  const { workspace } = useWorkspaceStore.getState();
  for (const section of workspace.sections) {
    for (const page of section.pages) {
      const node = page.nodes.find((n) => n.id === blockId);
      if (!node) continue;

      navigateToPage(section.id, page.id);
      useCanvasStore.getState().deleteNode(blockId);
      flush();

      return { deleted: 'block', id: blockId };
    }
  }

  throw new BridgeCommandError('NOT_FOUND', `No block with id "${blockId}"`);
}

// ── Canvas look ─────────────────────────────────────────────

const GUIDE_STYLES: BackgroundMode[] = ['pages', 'scroll', 'grid', 'none'];

/**
 * Agent-facing colour names ↔ stored `CanvasBgColor`.
 *
 * The hex values are accepted too: an agent that has read the notebook file
 * will have seen `"#f5f5f5"`, and rejecting what we ourselves persisted would
 * be a needless trap.
 */
const COLOR_BY_NAME: Record<string, CanvasBgColor> = {
  white: '#ffffff',
  'light-gray': '#f5f5f5',
  gray: '#e5e5e5',
  paper: 'paper',
};

const NAME_BY_COLOR: Record<CanvasBgColor, string> = {
  '#ffffff': 'white',
  '#f5f5f5': 'light-gray',
  '#e5e5e5': 'gray',
  paper: 'paper',
};

/** The look a page is actually drawn with — its override over the default. */
function currentSettings(pageId?: string): WorkspaceSettings {
  const { workspace } = useWorkspaceStore.getState();
  const page = pageId
    ? workspace.sections.flatMap((s) => s.pages).find((p) => p.id === pageId)
    : useWorkspaceStore.getState().getActivePage();
  return resolvePageSettings(page, workspace);
}

function describeBackground(settings: WorkspaceSettings) {
  return { guideStyle: settings.backgroundMode, color: NAME_BY_COLOR[settings.bgColor] };
}

const BACKGROUND_SCOPES = ['notebook', 'page'];

function readScope(params: Record<string, unknown>): 'notebook' | 'page' {
  const scope = optionalString(params, 'scope');
  if (scope === undefined) return 'notebook';
  if (!BACKGROUND_SCOPES.includes(scope)) {
    throw new BridgeCommandError(
      'BAD_PARAMS',
      `"${scope}" is not a scope. Valid values: ${BACKGROUND_SCOPES.join(', ')}.`,
    );
  }
  return scope as 'notebook' | 'page';
}

/**
 * Reports the EFFECTIVE look of a page plus where each value came from.
 *
 * Resolving rather than reading the notebook default straight off is what makes
 * the answer match the screen; `notebookDefault` and `source` are additive, so
 * an agent that only reads `guideStyle`/`color` is unaffected.
 */
function getBackground(params: Record<string, unknown>): BackgroundResult {
  const { workspace } = useWorkspaceStore.getState();
  const { page } = resolvePage(optionalString(params, 'pageId'));
  const resolved = resolvePageSettings(page, workspace);

  return {
    ...describeBackground(resolved),
    source: { guideStyle: resolved.source.backgroundMode, color: resolved.source.bgColor },
    notebookDefault: describeBackground(notebookSettings(workspace)),
    pageId: page.id,
  };
}

function setBackground(params: Record<string, unknown>): BackgroundResult {
  flush();
  // Notebook by default. `set_background` shipped meaning notebook-wide, and
  // quietly re-pointing it at the current page would change what every agent
  // already written against it does.
  const scope = readScope(params);
  const { section, page } = resolvePage(optionalString(params, 'pageId'));
  const previous = describeBackground(currentSettings(page.id));
  const updates: Partial<WorkspaceSettings> = {};

  const guideStyle = optionalString(params, 'guideStyle');
  if (guideStyle !== undefined) {
    if (!GUIDE_STYLES.includes(guideStyle as BackgroundMode)) {
      throw new BridgeCommandError(
        'BAD_PARAMS',
        `"${guideStyle}" is not a guide style. Valid values: ${GUIDE_STYLES.join(', ')}.`,
      );
    }
    updates.backgroundMode = guideStyle as BackgroundMode;
  }

  const color = optionalString(params, 'color');
  if (color !== undefined) {
    const resolved =
      COLOR_BY_NAME[color] ??
      (color in NAME_BY_COLOR ? (color as CanvasBgColor) : undefined);
    if (!resolved) {
      throw new BridgeCommandError(
        'BAD_PARAMS',
        `"${color}" is not a background colour. Valid values: ` +
          `${Object.keys(COLOR_BY_NAME).join(', ')}.`,
      );
    }
    updates.bgColor = resolved;
  }

  // Both optional individually, but a call that changes nothing is a mistake
  // worth surfacing rather than a successful no-op.
  if (Object.keys(updates).length === 0) {
    throw new BridgeCommandError(
      'BAD_PARAMS',
      'Pass at least one of "guideStyle" or "color".',
    );
  }

  // Either action marks the notebook dirty, so the normal auto-save pipeline
  // persists this exactly like a change made from the settings panel.
  if (scope === 'page') {
    useWorkspaceStore.getState().updatePageSettings(updates, {
      sectionId: section.id,
      pageId: page.id,
    });
  } else {
    useWorkspaceStore.getState().updateSettings(updates);
  }

  const { workspace } = useWorkspaceStore.getState();
  const after = resolvePageSettings(
    workspace.sections.flatMap((s) => s.pages).find((p) => p.id === page.id),
    workspace,
  );

  return {
    ...describeBackground(after),
    source: { guideStyle: after.source.backgroundMode, color: after.source.bgColor },
    notebookDefault: describeBackground(notebookSettings(workspace)),
    pageId: page.id,
    scope,
    previous,
  };
}

// ── Notebook management ─────────────────────────────────────

function renamePage(params: Record<string, unknown>): RenamePageResult {
  flush();
  const title = requireString(params, 'title');
  const { section, page } = resolvePage(optionalString(params, 'pageId'));
  const previousTitle = page.title;
  const updateHeading = params.updateHeading !== false;

  useWorkspaceStore.getState().renamePage(section.id, page.id, title);

  // The sidebar title and the canvas H1 are separate pieces of state, so a
  // rename would leave them disagreeing. Only rewrite a heading that still
  // matches the old title — a hand-edited one is the user's, not ours.
  let headingBlockId: string | undefined;
  if (updateHeading) {
    const heading = orderedTextNodes(page.nodes)[0];
    const headingText = heading && (heading.data as TextNodeData).text.trim();
    if (heading && headingText === `# ${previousTitle}`) {
      navigateToPage(section.id, page.id);
      const previous = heading.data as TextNodeData;
      const updated: TextNodeData = { ...previous, text: `# ${title}` };
      useCanvasStore.getState().updateNode(heading.id, {
        data: updated,
        height: blockHeight(updated.text, heading.width || A4_WIDTH, updated),
      });
      headingBlockId = heading.id;
    }
  }
  flush();

  return { sectionId: section.id, pageId: page.id, title, previousTitle, headingBlockId };
}

function movePage(params: Record<string, unknown>): MovePageResult {
  flush();
  const toSectionId = requireString(params, 'toSectionId');
  const { section: from, page } = resolvePage(optionalString(params, 'pageId'));

  const ws = useWorkspaceStore.getState();
  const target = ws.workspace.sections.find((s) => s.id === toSectionId);
  if (!target) {
    throw new BridgeCommandError('NOT_FOUND', `No section with id "${toSectionId}"`);
  }
  if (from.id === toSectionId) {
    throw new BridgeCommandError(
      'BAD_PARAMS',
      `Page "${page.id}" is already in section "${toSectionId}"`,
    );
  }
  // The store refuses to empty a section, so say why rather than no-op silently.
  if (from.pages.length <= 1) {
    throw new BridgeCommandError(
      'PRECONDITION',
      `"${from.title}" would be left with no pages. Every section must keep at least one — ` +
        'create another page there first, or move a different page.',
    );
  }

  const rawIndex = params.toIndex;
  if (rawIndex !== undefined && rawIndex !== null) {
    if (typeof rawIndex !== 'number' || !Number.isInteger(rawIndex) || rawIndex < 0) {
      throw new BridgeCommandError('BAD_PARAMS', '"toIndex" must be a non-negative integer');
    }
  }
  const index = Math.min(
    typeof rawIndex === 'number' ? rawIndex : target.pages.length,
    target.pages.length,
  );

  useWorkspaceStore.getState().movePageToSection(page.id, from.id, toSectionId, index);
  flush();

  return {
    pageId: page.id,
    title: page.title,
    fromSectionId: from.id,
    toSectionId,
    index,
  };
}

async function renameNotebook(
  params: Record<string, unknown>,
): Promise<RenameNotebookResult> {
  flush();
  const filename = requireString(params, 'filename');
  const previousFilename = useWorkspaceStore.getState().workspace.filename;

  useWorkspaceStore.getState().updateWorkspace({ filename });
  useWorkspaceStore.getState().markDirty();

  // Renaming inside the app does not rename the file on disk — the FSA handle
  // keeps whatever name it was opened under. Report it so the agent can say so.
  let boundFilename: string | undefined;
  if (isFSASupported()) {
    const handle = await getCurrentHandle();
    boundFilename = handle?.name;
  }

  return { filename, previousFilename, boundFilename };
}

async function saveNotebookCmd(): Promise<SaveNotebookResult> {
  flush();
  const { saveNotebook } = await import('../utils/saveNotebook');
  const outcome = await saveNotebook(false, { existingFileOnly: true });

  if (!outcome.ok) {
    if (outcome.reason === 'busy') {
      throw new BridgeCommandError('PRECONDITION', 'A save is already in progress');
    }
    if (outcome.reason === 'no-bound-file') {
      throw new BridgeCommandError(
        'PRECONDITION',
        'This notebook is not bound to a file on disk, so there is nothing to overwrite. ' +
          'The Save As picker needs a user gesture the bridge cannot provide — ask the user ' +
          'to save once from the app, then this command will work.',
      );
    }
    throw new BridgeCommandError('INTERNAL', `Save failed (${outcome.reason})`);
  }

  return {
    filename: useWorkspaceStore.getState().workspace.filename,
    savedTo: outcome.savedTo,
    saveRevision: outcome.revision,
  };
}

// ── App updates ─────────────────────────────────────────────

async function checkUpdate(): Promise<CheckUpdateResult> {
  const info = await checkForUpdate(APP_VERSION, { force: true });

  // checkForUpdate returns null for offline / CORS / rate-limit. That is not
  // the same as "up to date", and conflating them would have the agent report
  // a current version it never actually verified.
  if (info === null) {
    return {
      currentVersion: APP_VERSION,
      available: false,
      checked: false,
      message:
        'Could not reach the GitHub releases API (offline, CORS-blocked, or rate limited). ' +
        'Update status is unknown.',
    };
  }

  if (!info.available) {
    const latest = info.latestVersion ?? APP_VERSION;
    return {
      currentVersion: APP_VERSION,
      available: false,
      checked: true,
      latestVersion: latest,
      message:
        latest === APP_VERSION
          ? `PowerNote ${APP_VERSION} is the latest release.`
          : `Nothing to install — running ${APP_VERSION}, ahead of the latest release ${latest}.`,
    };
  }

  return {
    currentVersion: APP_VERSION,
    available: true,
    checked: true,
    latestVersion: info.latestVersion,
    releaseUrl: info.releaseUrl,
    message: `PowerNote ${info.latestVersion} is available (running ${APP_VERSION}).`,
  };
}

async function runUpdate(params: Record<string, unknown>): Promise<RunUpdateResult> {
  if (params.confirm !== true) {
    throw new BridgeCommandError(
      'BAD_PARAMS',
      'run_update rewrites the notebook file on disk and reloads the app. ' +
        'Pass confirm:true once the user has agreed.',
    );
  }

  const info = await checkForUpdate(APP_VERSION, { force: true });
  if (info === null) {
    throw new BridgeCommandError(
      'PRECONDITION',
      'Could not reach the GitHub releases API, so there is no update to install.',
    );
  }
  if (!info.available || !info.latestVersion) {
    throw new BridgeCommandError(
      'PRECONDITION',
      `Already on the latest release (${APP_VERSION}).`,
    );
  }
  if (!info.downloadUrl) {
    throw new BridgeCommandError(
      'PRECONDITION',
      `Release ${info.latestVersion} has no PowerNote.html asset to install.`,
    );
  }

  // Persist first: performUpdate injects the in-memory workspace into the new
  // template, so anything unflushed would be silently dropped by the swap.
  flush();
  const workspace = useWorkspaceStore.getState().workspace;

  // The live-swap path reloads the page. Reloading synchronously would tear the
  // socket down before the response frame is flushed, so the agent would see a
  // timeout on a successful update. Defer it just past the ack.
  const result = await performUpdate(
    info.downloadUrl,
    workspace,
    APP_VERSION,
    info.latestVersion,
    { reload: () => setTimeout(() => window.location.reload(), 500) },
  );

  if (!result.ok) {
    throw new BridgeCommandError(
      'INTERNAL',
      'Update failed — could not download or write the new version. See the app console.',
    );
  }

  return {
    fromVersion: APP_VERSION,
    toVersion: info.latestVersion,
    mode: result.mode,
    reloading: result.mode === 'live-swap',
  };
}

// ── Dispatch ────────────────────────────────────────────────

type Handler = (params: Record<string, unknown>) => unknown | Promise<unknown>;


const DIAGRAM_FORMATS: DiagramSourceFormat[] = ['plantuml', 'mermaid', 'svg', 'drawio'];

/**
 * Draws a diagram onto the page as a native diagram node.
 *
 * The agent supplies semantics only — entities and relationships — and the app
 * computes every coordinate from real text metrics. What lands is ordinary
 * shape and text nodes inside a frame, so the user can drag any part of it
 * afterwards exactly like something they drew by hand.
 *
 * `format` names the language. It is optional so the pre-Mermaid callers keep
 * working by sniffing, but an agent that states it gets told when its source is
 * in the other language instead of watching it half-render.
 *
 * Diagnostics come back with the write rather than needing a second call, so a
 * clean diagram costs one round trip. A source that parses to nothing is a
 * PRECONDITION error, not a silently empty frame.
 */
async function createDiagram(params: Record<string, unknown>): Promise<CreateDiagramResult> {
  flush();
  const source = requireString(params, 'source');
  const title = optionalString(params, 'title') ?? 'Diagram';
  const declared = optionalString(params, 'format');
  if (declared !== undefined && !DIAGRAM_FORMATS.includes(declared as DiagramSourceFormat)) {
    throw new BridgeCommandError(
      'BAD_PARAMS',
      `"${declared}" is not a diagram format. Valid values: ${DIAGRAM_FORMATS.join(', ')}.`,
    );
  }
  const format = declared as DiagramSourceFormat | undefined;
  const sniffed = sniffFormat(source);
  // Stored source is always readable XML: inflate before build and before
  // writing data.source, so the redraw dialog never shows a base64 blob.
  const text =
    format === 'drawio' || sniffed === 'drawio' ? await normalizeDrawioSource(source) : source;
  const { section, page } = resolvePage(optionalString(params, 'pageId'));
  const column = resolveColumn(params, page);

  navigateToPage(section.id, page.id);

  // Placed below whatever is already in that column, like an appended block.
  const nodes = useCanvasStore.getState().nodes;
  const placed = placeDiagramOnCanvas({
    x: columnX(column, page.scrolls),
    y: nextBlockY(nodes, column, page.scrolls),
    source: text,
    title,
    format,
  });
  if (!placed.placed) {
    throw new BridgeCommandError(
      'PRECONDITION',
      `Nothing in that source could be drawn. ${placed.diagnostics.map((d) => d.message).join(' ')}`.trim(),
    );
  }
  flush();

  return {
    sectionId: section.id,
    pageId: page.id,
    diagramId: placed.frameId,
    title,
    format: format ?? sniffFormat(text),
    column,
    elementCount: placed.elementCount,
    width: placed.width,
    height: placed.height,
    diagnostics: placed.diagnostics,
    warnings: placed.warning ? [placed.warning] : [],
  };
}

const HANDLERS: Record<BridgeCommandName, Handler> = {
  list_pages: listPages,
  read_page: readPage,
  create_section: createSection,
  create_page: createPage,
  append_block: appendBlock,
  create_diagram: createDiagram,
  update_block: updateBlock,
  rename_page: renamePage,
  move_page: movePage,
  list_scrolls: listScrolls,
  create_scroll: createScrollCmd,
  rename_scroll: renameScrollCmd,
  delete_page: deletePageCmd,
  delete_section: deleteSectionCmd,
  delete_scroll: deleteScrollCmd,
  delete_block: deleteBlockCmd,
  get_background: getBackground,
  set_background: setBackground,
  rename_notebook: renameNotebook,
  save_notebook: saveNotebookCmd,
  check_update: checkUpdate,
  run_update: runUpdate,
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
