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
  | 'update_block';

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
}

export interface PageContent {
  sectionId: string;
  pageId: string;
  title: string;
  blocks: BlockSummary[];
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
}

export interface UpdateBlockResult {
  blockId: string;
}

export function isBridgeErr(r: BridgeResponse): r is BridgeErr {
  return r.ok === false;
}
