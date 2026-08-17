/**
 * Wire protocol shared by the PowerNote app and the `powernote-notes` MCP server.
 *
 * Direction matters: the MCP server HOSTS the WebSocket and the app dials OUT
 * to it. A browser page cannot listen on a port, and PowerNote ships as a
 * single static HTML file with no runtime backend, so the app is always the
 * client here.
 *
 * Because the agent mutates the live Zustand stores (rather than rewriting the
 * .html on disk), the normal auto-save pipeline persists agent edits exactly
 * like user edits — there is no external-write/auto-save collision to resolve.
 */

import type { BackgroundMode } from '../types/data';

export const BRIDGE_PROTOCOL_VERSION = 1;

/** Loopback only — the bridge must never be reachable off-machine. */
export const DEFAULT_BRIDGE_PORT = 41777;
export const DEFAULT_BRIDGE_URL = `ws://127.0.0.1:${DEFAULT_BRIDGE_PORT}`;

export type BridgeCommandName =
  | 'list_pages'
  | 'read_page'
  | 'create_section'
  | 'create_page'
  | 'append_block'
  | 'create_diagram'
  | 'update_block'
  | 'rename_page'
  | 'move_page'
  | 'list_scrolls'
  | 'create_scroll'
  | 'rename_scroll'
  | 'delete_page'
  | 'delete_section'
  | 'delete_scroll'
  | 'delete_block'
  | 'get_background'
  | 'set_background'
  | 'rename_notebook'
  | 'save_notebook'
  | 'check_update'
  | 'run_update';

/** Sent by the app immediately after the socket opens. */
export interface BridgeHello {
  v: number;
  type: 'hello';
  app: 'powernote';
  appVersion: string;
  /** Notebook filename, so the agent can confirm it is writing where it thinks. */
  notebook: string;
}

/**
 * Sent by the server to a client it is about to disconnect because another
 * notebook has claimed the slot.
 *
 * This frame exists to stop a flip-flop: without it, the displaced client's
 * reconnect backoff kicks in, it displaces the new client in turn, and the two
 * trade the slot forever while commands land in whichever notebook happens to
 * hold it. A displaced client must stand down and NOT retry.
 */
export interface BridgeDisplaced {
  v: number;
  type: 'displaced';
  reason: string;
}

/** Control frames the server can push outside of request/response. */
export type BridgeControlFrame = BridgeDisplaced;

export interface BridgeRequest {
  v: number;
  id: string;
  cmd: BridgeCommandName;
  params: Record<string, unknown>;
}

export type BridgeErrorCode =
  | 'BAD_PARAMS'
  | 'NOT_FOUND'
  | 'UNSUPPORTED'
  /** Command is valid but the app cannot run it in its current state. */
  | 'PRECONDITION'
  | 'INTERNAL';

export interface BridgeOk<T = unknown> {
  v: number;
  id: string;
  ok: true;
  result: T;
}

export interface BridgeErr {
  v: number;
  id: string;
  ok: false;
  error: { code: BridgeErrorCode; message: string };
}

export type BridgeResponse<T = unknown> = BridgeOk<T> | BridgeErr;

// ── Result payloads ─────────────────────────────────────────

export interface PageSummary {
  sectionId: string;
  sectionTitle: string;
  pageId: string;
  title: string;
  /** Number of text blocks currently on the page. */
  blockCount: number;
  isActive: boolean;
}

export interface BlockSummary {
  blockId: string;
  markdown: string;
  /** A4 page-guide column the block sits in (0 = leftmost). */
  column: number;
  /** Scroll the block sits in, derived from its position. */
  scrollId?: string;
}

/** A named column band. Blocks belong to it by position, not by a stored link. */
export interface ScrollSummary {
  scrollId: string;
  title: string;
  /** 0 = leftmost band. */
  column: number;
  blockCount: number;
}

export interface PageContent {
  sectionId: string;
  pageId: string;
  title: string;
  blocks: BlockSummary[];
  scrolls: ScrollSummary[];
}

export interface ListScrollsResult {
  sectionId: string;
  pageId: string;
  pageTitle: string;
  scrolls: ScrollSummary[];
}

export interface CreateScrollResult {
  sectionId: string;
  pageId: string;
  scrollId: string;
  title: string;
  column: number;
}

export interface RenameScrollResult {
  scrollId: string;
  title: string;
  previousTitle: string;
}

/** What a delete removed. Deletes are irreversible over the bridge — there is
 *  no agent-facing undo — so each result names exactly what went. */
export interface DeleteResult {
  deleted: 'page' | 'section' | 'scroll' | 'block';
  id: string;
  title?: string;
  /** Blocks removed alongside the target (delete_scroll with withBlocks). */
  blocksRemoved?: number;
}

/**
 * The notebook's canvas look.
 *
 * `color` is an agent-facing NAME ("paper", "light-gray") rather than the hex
 * stored in `WorkspaceSettings.bgColor`. The app offers four presets, not free
 * colour, so a name is both easier for a model to reason about and impossible
 * to get subtly wrong by a digit.
 */
export interface BackgroundResult {
  /** The look the page is actually drawn with, override resolved. */
  guideStyle: BackgroundMode;
  color: string;
  /** Which layer each value came from, so an agent can tell inherited from set. */
  source?: { guideStyle: 'page' | 'notebook'; color: 'page' | 'notebook' };
  /** What a page without an override falls back to. */
  notebookDefault?: { guideStyle: BackgroundMode; color: string };
  /** The page the answer is about. */
  pageId?: string;
  /** Which layer a write went to. */
  scope?: 'page' | 'notebook';
  /** Only present on set_background, so the agent can report what it changed. */
  previous?: { guideStyle: BackgroundMode; color: string };
}

export interface ListPagesResult {
  notebook: string;
  pages: PageSummary[];
}

export interface CreateSectionResult {
  sectionId: string;
  title: string;
  /** First page auto-created with the section. */
  pageId: string;
}

export interface CreatePageResult {
  sectionId: string;
  pageId: string;
  title: string;
  /** Present when a heading block was written onto the canvas. */
  headingBlockId?: string;
}

export interface AppendBlockResult {
  sectionId: string;
  pageId: string;
  blockId: string;
  column: number;
  /** Scroll the block landed in, when the page has a record for that band. */
  scrollId?: string;
}

/**
 * Language a diagram source is written in.
 *
 * Duplicated from `src/diagram` rather than imported: this module is the wire
 * contract, and the MCP server reads it without pulling in the renderer.
 */
export type DiagramSourceFormat = 'plantuml' | 'mermaid' | 'svg' | 'drawio';

/** What `create_diagram` drew. Diagnostics travel back with the write, so a
 *  clean diagram costs one round trip and a flawed one still reports why. */
export interface CreateDiagramResult {
  sectionId: string;
  pageId: string;
  /** Id of the diagram node. Its contents carry this as their groupId. */
  diagramId: string;
  title: string;
  /** Grammar that read the source, so the agent can see which tool ran. */
  format: DiagramSourceFormat;
  column: number;
  /** Native shape and text nodes drawn inside the frame. */
  elementCount: number;
  width: number;
  height: number;
  diagnostics: { line: number; severity: 'error' | 'ignored'; message: string }[];
  /**
   * Geometric placement notes (v0.51). Empty when the diagram was not
   * scaled. A floor-scale fit names the scroll, the requested width and
   * the applied scale, riding the v0.34 "warnings in the same response"
   * contract so the agent does not need a second call.
   */
  warnings: string[];
}

export interface UpdateBlockResult {
  blockId: string;
}

export interface RenamePageResult {
  sectionId: string;
  pageId: string;
  title: string;
  previousTitle: string;
  /** Set when the canvas H1 was rewritten to match the new title. */
  headingBlockId?: string;
}

export interface MovePageResult {
  pageId: string;
  title: string;
  fromSectionId: string;
  toSectionId: string;
  /** Final position of the page within the target section. */
  index: number;
}

export interface RenameNotebookResult {
  filename: string;
  previousFilename: string;
  /**
   * The bound file on disk is NOT renamed — the handle keeps its own name.
   * Present when a file is bound, so the agent can say so.
   */
  boundFilename?: string;
}

export interface SaveNotebookResult {
  filename: string;
  /** Name of the file actually written on disk. */
  savedTo: string;
  saveRevision: number;
}

export interface CheckUpdateResult {
  currentVersion: string;
  /** False when up to date OR when the check could not run — see `checked`. */
  available: boolean;
  /** False when GitHub was unreachable or rate-limited. */
  checked: boolean;
  latestVersion?: string;
  releaseUrl?: string;
  message?: string;
}

export interface RunUpdateResult {
  fromVersion: string;
  toVersion: string;
  mode: 'live-swap' | 'download';
  /**
   * True for live-swap: the app reloads shortly after this response is sent,
   * which drops the bridge connection until the notebook reconnects.
   */
  reloading: boolean;
}

export function isBridgeErr(r: BridgeResponse): r is BridgeErr {
  return r.ok === false;
}
