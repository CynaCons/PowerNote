# SRS: Agent Bridge

**Project:** PowerNote  
**Version:** 0.28.0  
**Date:** 2026-08-10

## Purpose

Let an external agent structure information directly into a notebook — create
pages and fill them with markdown content (bullet lists, checklists, headings)
— so the user can delegate note-shaping instead of doing it by hand.

## Design notes

The MCP server hosts a WebSocket on loopback and the app dials **out** to it.
A browser page cannot listen on a port, and PowerNote ships as a single static
HTML file with no runtime backend, so the app is necessarily the client.

The agent mutates the live Zustand stores rather than rewriting the `.html` on
disk. This is what makes the design safe: agent edits flow through the same
auto-save pipeline as user edits, so there is no external-write vs. auto-save
race to arbitrate.

The unit of content is a **block** — one text node holding one markdown chunk,
laid out at full page width and stacked down a page-guide column. Blocks are
used rather than fixed "rows" because text nodes already render markdown and
already auto-measure their own height, so a chunk that wraps to six visual lines
needs no row bookkeeping.

Only one notebook may hold the bridge at a time. The newest connection wins, so
a stale socket cannot lock out the notebook the user is actually looking at, and
the displaced client is explicitly told to stand down. That handshake is
load-bearing: without it the displaced client's reconnect backoff makes the two
notebooks trade the slot indefinitely and writes land in whichever one happens
to hold it (found while demoing the bridge, fixed before release).

Block heights are measured, not estimated, and the measurement must apply the
renderer's **inline** styles rather than just its CSS class. Font size, line
height and padding all live inline; measuring without them under-reports a
heading by ~12px, which is enough to overlap the block below.

## Requirements

| ID | Description | Priority | Test Ref |
|----|-------------|----------|----------|
| REQ-AGENT-001 | The app shall connect to an agent bridge server only when the user enables it in Settings; the bridge shall be OFF by default | Must | T94 |
| REQ-AGENT-002 | The enable flag shall persist per-machine (localStorage) and shall never be written into the notebook file | Must | T94 |
| REQ-AGENT-003 | Settings shall show bridge connection status (off / connecting / connected / error) and a served-command count | Should | T94 |
| REQ-AGENT-004 | An agent shall list every section and page with title, block count, and which page is active | Must | T95 |
| REQ-AGENT-005 | An agent shall create a section, which shall receive an initial empty page | Must | T95 |
| REQ-AGENT-006 | An agent shall create a titled page; by default a matching `# Title` block shall also be written onto the canvas | Must | T95 |
| REQ-AGENT-007 | An agent shall append a markdown block below all existing content on a page, without overlapping it | Must | T96 |
| REQ-AGENT-008 | Appended blocks shall render as markdown, including GFM checklists that remain clickable by the user | Must | T96 |
| REQ-AGENT-009 | An agent shall read a page back as ordered markdown blocks with stable block ids | Must | T96 |
| REQ-AGENT-010 | An agent shall replace the markdown of an existing block by id | Must | T96 |
| REQ-AGENT-011 | A command targeting a non-active page shall save the current page, switch, and load the target before mutating | Must | T97 |
| REQ-AGENT-012 | Agent edits shall mark the notebook dirty and survive a save/reload round-trip | Must | T97 |
| REQ-AGENT-013 | Unknown commands, missing ids, and non-text targets shall return a typed error without crashing the app | Must | T97 |
| REQ-AGENT-014 | The bridge server shall bind to loopback (127.0.0.1) only | Must | — |
| REQ-AGENT-015 | Tool calls made with no notebook connected shall fail fast with actionable guidance, not hang | Must | — |

## Requirements — demo findings

Added after the feature was demoed live and before it shipped.

| ID | Description | Priority | Test Ref |
|----|-------------|----------|----------|
| REQ-AGENT-016 | When a second notebook connects, the server shall keep the newest, send the older one a `displaced` frame, and only then close it | Must | T98, powernote-mcp `displacement.test.mjs` |
| REQ-AGENT-017 | A displaced client shall stand down permanently — no reconnect — and report why in Settings | Must | T98 |
| REQ-AGENT-018 | Displacement shall clear the persisted enable flag, so a forgotten background tab cannot silently re-claim the slot after a reload | Must | T98 |
| REQ-AGENT-019 | In-flight requests to a displaced notebook shall fail immediately rather than waiting for the request timeout | Must | powernote-mcp `displacement.test.mjs` |
| REQ-AGENT-020 | An agent shall choose which A4 page-guide column to write into (`column`, 0 = leftmost) | Must | T98 |
| REQ-AGENT-021 | Each column shall stack independently — filling column 1 shall not depend on the length of column 0 | Must | T98 |
| REQ-AGENT-022 | `read_page` shall report each block's column and order blocks column-major | Must | T98 |
| REQ-AGENT-023 | A non-integer or negative column shall be rejected with `BAD_PARAMS` | Must | T98 |
| REQ-AGENT-024 | Block height measurement shall apply the renderer's inline styles, so a placed block's height needs no post-render correction | Must | T96, T98 |
| REQ-AGENT-025 | An unrecognised or malformed server frame shall be ignored without disturbing the bridge | Should | T98 |

## Related

- REQ-TEXT family — markdown rendering and clickable checkboxes in text nodes
- REQ-HIERARCHY family — section/page structure and navigation
- REQ-FILE family — auto-save and notebook persistence
