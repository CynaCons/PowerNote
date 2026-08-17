# SRS: Agent Bridge

**Project:** PowerNote  
**Version:** 0.31.0  
**Date:** 2026-08-11

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
| REQ-AGENT-026 | An agent shall rename a page (`rename_page`), defaulting to the open page | Must | T100 |
| REQ-AGENT-027 | `rename_page` shall also retitle the page's canvas H1 when that block still matches the previous title, and shall leave a hand-edited heading untouched | Must | T100 |
| REQ-AGENT-028 | An agent shall move a page to another section (`move_page`), appending to the end unless `toIndex` is given | Must | T100 |
| REQ-AGENT-029 | `move_page` shall refuse with `PRECONDITION` when the move would leave the source section with no pages, and shall leave the notebook unchanged | Must | T100 |
| REQ-AGENT-030 | When the moved page is the open one, its section shall follow it, so subsequent writes still reach the page rather than being dropped by `savePageNodes` | Must | T100 |
| REQ-AGENT-031 | An agent shall rename the notebook (`rename_notebook`); the file already on disk keeps its own name, which the result shall report | Must | T100 |
| REQ-AGENT-032 | An agent shall persist the notebook to its bound file (`save_notebook`) | Must | T100 |
| REQ-AGENT-033 | `save_notebook` shall fail with `PRECONDITION` when no file is bound, rather than opening a Save As picker the bridge cannot drive | Must | T100 |
| REQ-AGENT-034 | An agent shall query update status (`check_update`), reporting current and latest version | Must | T100 |
| REQ-AGENT-035 | `check_update` shall distinguish "up to date" from "could not check" via a `checked` flag, so an unreachable API is never reported as current | Must | T100 |
| REQ-AGENT-036 | `run_update` shall require `confirm: true`, refuse when no newer installable release exists, and acknowledge before the live-swap reload drops the connection | Must | T100 |
| REQ-AGENT-037 | An agent shall list, create and rename scrolls, and target one by `scrollId` when appending, so two workstreams can share a page without interleaving | Must | T105 |
| REQ-AGENT-038 | An unknown `scrollId` shall be rejected with `NOT_FOUND` naming the known scrolls, and shall not fall back to another column | Must | T105 |
| REQ-AGENT-039 | An agent shall read and set the canvas look (`get_background`, `set_background`); background colour shall be addressed by name (`white`, `light-gray`, `gray`, `paper`), with the stored hex accepted as an alias | Must | T102 |
| REQ-AGENT-040 | `set_background` shall validate before writing: an unknown guide style or colour shall be rejected with `BAD_PARAMS` listing the valid values, leaving the notebook unchanged, and a call setting neither field shall be an error rather than a silent no-op | Must | T102 |
| REQ-AGENT-041 | `set_background` shall accept an optional `scope` (`notebook` by default, or `page`) and reject any other value with `BAD_PARAMS`. The default is fixed by compatibility, not preference: the tool shipped meaning notebook-wide, so re-pointing it at the current page would silently change what already-written agents do | Must | T102 |
| REQ-AGENT-041 | An agent-set canvas look shall persist through the normal auto-save/save path, requiring no persistence path of its own | Must | T103 |
| REQ-AGENT-042 | An agent shall delete pages, sections, scrolls and blocks (`delete_page`, `delete_section`, `delete_scroll`, `delete_block`) | Must | T109 |
| REQ-AGENT-043 | Every delete verb shall require `confirm: true`, since the bridge exposes no undo; without it the call shall fail with `BAD_PARAMS` and change nothing | Must | T109 |
| REQ-AGENT-044 | Deletes that the store refuses — the last page in a section, the last section, the last scroll on a page — shall report `PRECONDITION` naming the reason, never a silent no-op | Must | T109 |
| REQ-AGENT-045 | `delete_scroll` shall preserve the blocks in its band unless `withBlocks: true`, and shall report how many blocks were removed | Must | T109 |
| REQ-AGENT-046 | Deleting the open page shall reload the canvas from the newly active page, so the deleted page's blocks are not flushed onto it | Must | T109 |

## Related

- REQ-SCROLL family — scroll identity, titles and derived band membership
- REQ-TEXT family — markdown rendering and clickable checkboxes in text nodes
- REQ-HIERARCHY family — section/page structure and navigation
- REQ-FILE family — auto-save and notebook persistence

## Multiple agents (v0.36)

Several agents may connect at once; they may not operate at once.

One MCP server process is spawned per agent session, so they race for the bridge
port. The winner is the **hub** and owns the single connection to the notebook;
the losers are **peers** and forward their tool calls to the hub. Exactly one
socket ever reaches the app, which is why the app side is unchanged.

| ID | Description | Priority | Test Ref |
|----|-------------|----------|----------|
| REQ-AGENT-040 | A server that cannot bind the bridge port shall join the existing server as a peer rather than failing | Must | test:bridge |
| REQ-AGENT-041 | A peer's tool calls shall be executed by the hub against the one connected notebook | Must | test:bridge |
| REQ-AGENT-042 | A mutating tool shall acquire a lease before running; a second agent's mutating tool shall be refused with `LOCKED` | Must | test:bridge |
| REQ-AGENT-043 | The `LOCKED` message shall name the holder, how long it has held, roughly when it frees up, and the caller's queue position | Must | test:bridge |
| REQ-AGENT-044 | The lease shall be held for the whole duration of a command, so a slow command cannot lose it mid-flight | Must | test:bridge |
| REQ-AGENT-045 | Read-only tools shall never be blocked — an agent that cannot read cannot discover why it is blocked | Must | test:bridge |
| REQ-AGENT-046 | The lease shall be released on idle, on holder disconnect, and on notebook disconnect, so no crash can wedge the notebook | Must | test:bridge |
| REQ-AGENT-047 | A holder past the maximum hold shall yield at its next command, but only when another agent is waiting | Should | — |
| REQ-AGENT-048 | `bridge_status` shall report the notebook, every connected agent, the holder, and whether the caller is the holder | Must | test:bridge |
| REQ-AGENT-049 | Every tool result shall carry the calling agent's identity | Must | test:bridge |
| REQ-AGENT-050 | If the hub exits, a surviving peer shall take the port and continue serving | Must | test:bridge |

**Expiry is evaluated on use, not on a timer.** A timer firing while nothing is
happening tells us nothing, and one firing mid-command would be wrong.

**Coverage.** `npm run test:bridge` spawns two real server processes and a stub
notebook. The Playwright suite drives the app side of the bridge and never
starts the server, so this topology has no coverage there.
