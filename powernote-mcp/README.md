# powernote-notes MCP

Lets an agent create pages and write markdown content into a **running**
PowerNote notebook.

## How it connects

```
agent  ──MCP/stdio──▶  powernote-mcp/server.js  ──WebSocket──▶  PowerNote (browser)
                       (hosts ws://127.0.0.1:41777)             (dials out)
```

The server hosts the socket and the app dials **out** to it. A browser page
cannot listen on a port, and PowerNote ships as a single static HTML file with
no runtime backend, so the app is necessarily the client.

Commands mutate the app's live stores, so agent edits flow through the same
auto-save pipeline as anything you type — there is no separate write path to
the `.html` file and nothing to reconcile.

## Setup

```bash
npm install --prefix powernote-mcp
```

Already registered in the project's `.mcp.json`. Restart your agent session
after changing that file so the tools load.

## Turning it on

1. Open your notebook in PowerNote.
2. Settings → **Agent bridge** → *"Let a local agent write into this notebook"*.
3. The status dot goes green when the app reaches the server. Order doesn't
   matter — the app retries with backoff, so either side can start first.

The bridge is **off by default** and the flag is stored in `localStorage`, not
in the notebook. A notebook you send to someone else will never try to dial a
socket on their machine.

## Tools

| Tool | What it does |
|------|--------------|
| `list_pages` | Every section and page, with block counts and which is open. Call first to get ids. |
| `read_page` | A page as ordered markdown blocks with stable block ids. |
| `create_section` | New section (sidebar tab), with an initial empty page. |
| `create_page` | New titled page, opened. Also writes an `# Title` block unless `withHeading: false`. |
| `append_block` | Append a markdown block to the bottom of a page. The main way to write. |
| `update_block` | Replace an existing block's markdown, by id. |
| `create_diagram` | Draw a UML diagram from PlantUML source, as native canvas shapes. See [Diagrams](#diagrams). |
| `rename_page` | Retitle a page, and its `# Title` block if that still matches. |
| `move_page` | Move a page into another section. |
| `list_scrolls` | The named scrolls (columns) on a page, with block counts. Call before writing to a shared page. |
| `create_scroll` | New titled scroll to the right of the existing ones. Returns a `scrollId`. |
| `rename_scroll` | Retitle a scroll. The title shows at the top of the column on the canvas. |
| `delete_page` | Delete a page and its content. Requires `confirm`. |
| `delete_section` | Delete a section and every page in it. Requires `confirm`. |
| `delete_scroll` | Delete a scroll; keeps its blocks unless `withBlocks`. Requires `confirm`. |
| `delete_block` | Delete one markdown block by id. Requires `confirm`. |
| `get_background` | The notebook's current guide style and background colour. |
| `set_background` | Change the guide style (`pages`/`scroll`/`grid`/`none`) and/or colour. Stored in the notebook. |
| `rename_notebook` | Rename the notebook in the app (not the file on disk). |
| `save_notebook` | Write the notebook back to the file it was opened from. |
| `check_update` | Is a newer PowerNote release available? |
| `run_update` | Install it. Overwrites the file and reloads the app. |

### Diagrams

`create_diagram` takes PlantUML and draws it onto the page. What lands is
ordinary PowerNote shapes and text inside a diagram frame — **not an image** —
so the user can drag any part of it afterwards. We take PlantUML's syntax and
throw its renderer away; that is what makes the result editable.

Two grammars are supported, and the right one is detected from the source:

**Component and composite structure**

```
component "gateway" as gw {
  portin telemetry
  portout storage
  component "broker : MqttBroker [1]" as broker
  component "buffer : StoreForward [1..*]" as buffer
  broker --> buffer : Queue
  telemetry --> broker
  buffer --> storage
}
```

Nested components, ports (`port` / `portin` / `portout`), provided and required
interfaces, assembly and delegation connectors. A composite-structure part puts
its role in the label: `"role : Type [multiplicity]"`. Connector kind is derived
from UML's rule, not declared — an end on a port that is not on a part is a
delegation, otherwise an assembly.

**Activity with swimlanes**

```
|Sensor|
start
:sample burst;
|Gateway|
:buffer to flash;
if (uplink up?) then (yes)
|Cloud|
:ingest batch;
else (no)
:hold in store-forward;
endif
stop
```

`|Lane|` switches the swimlane, `start` and `stop` are the pseudostates,
`:action;` is a step, and `if (cond) then (label) / else (label) / endif` adds a
decision with guards on the arrows. Steps run top to bottom in source order and
the lane fixes the column.

**Rules worth knowing**

- Supply semantics only. Every coordinate is computed from real text metrics,
  and there is no syntax for positioning anything yourself.
- `skinparam`, `!include` and `!theme` are **reported back as skipped**, not
  silently dropped — PowerNote supplies the style.
- `fork`, `split`, `while` and `repeat` are refused with a diagnostic rather
  than drawn wrong.
- Activity `if/else` branches currently render in source order rather than as
  parallel paths that rejoin.
- The response carries the diagnostics, so one call is enough to know whether it
  came out right. A source that draws nothing is a `PRECONDITION` error, not an
  empty frame.

### Blocks, not rows

A block is one text node holding one markdown chunk. Prefer one block per
logical unit — a whole list, a whole paragraph — rather than one per line.
Blocks are full page width and stack down a column; their height is measured
against the real renderer at write time, so they never overlap.

### Scrolls (columns)

A page is divided into vertical bands. Each band can be a named **scroll**, with
its title drawn at the top of the column in the app. Scrolls stack
independently, so writing into a second scroll starts at the top of the page
regardless of how long the first one is — which is what makes it safe for two
workstreams to share a page.

Target one with `append_block({ scrollId })`, using an id from `list_scrolls`.
`read_page` reports each block's `scrollId` and returns blocks column-major —
all of the leftmost scroll top to bottom, then the next.

Membership is **positional**: a block belongs to whichever scroll it physically
sits in, so a block the user drags into another scroll moves with it, and
nothing can end up filed under a scroll it is not visibly in.

`append_block` and `create_page` still accept a raw `column` integer (0 = the
leftmost band). It keeps working, but prefer `scrollId` — a column index points
at a position, and positions shift when scrolls are reordered.

Markdown is rendered live, so `- [ ]` checkboxes arrive as real checkboxes the
user can click, and clicking one writes back into the block's markdown.

### Saving, and what the agent cannot do

Edits land in the live app immediately, but they are only on disk once the
notebook is saved. `save_notebook` overwrites the file the notebook was opened
from — and only that file. It cannot Save As: the browser's file picker needs a
real click, so a notebook that was never saved has nothing for the agent to
write to, and the tool says so instead of quietly doing nothing.

`rename_notebook` is the same story from the other side. It renames the notebook
*inside* the app; the `.html` on disk keeps the name it already had until the
user saves it somewhere new. The result includes the bound filename so the agent
can tell the user the two now differ.

### Updates

`check_update` compares the running build against the latest GitHub release.
Read the `checked` field before trusting `available`: when GitHub is unreachable
or rate-limiting, `checked` is `false` and the status is simply unknown — not
"up to date".

`run_update` downloads the new build, injects the current notebook into it,
overwrites the file on disk and reloads the app. That drops this bridge until
the notebook reconnects, so the tool acknowledges *before* reloading rather than
letting the agent time out on a success. It requires `confirm: true`; ask the
user first. A safety backup is downloaded beforehand where the browser permits
it — an unattended browser may block the download, so the backup is best-effort,
not a guarantee.

## Config

| Env var | Default | Purpose |
|---------|---------|---------|
| `POWERNOTE_BRIDGE_PORT` | `41777` | WebSocket port (loopback only). |
| `POWERNOTE_BRIDGE_TIMEOUT_MS` | `10000` | How long to wait for the app to answer. |
| `POWERNOTE_BRIDGE_SLOW_TIMEOUT_MS` | `120000` | Budget for the network-bound tools (`check_update`, `run_update`, `save_notebook`). |

If the port is taken the server says so on stderr rather than dying silently.

## Security

The bridge has no authentication. Anything that can reach the port can edit the
open notebook, so only enable it on a machine you control. It binds `127.0.0.1`
and never `0.0.0.0`. A handshake token is the obvious next step if this ever
runs somewhere shared.

## One notebook at a time

The newest connection wins, so a stale socket can never lock out the notebook
you are actually looking at. The displaced notebook is sent a `displaced` frame
before its socket closes, and it then stops for good rather than retrying — it
also unticks its own Agent bridge box and says why. Tick the box again to take
the connection back.

That handshake matters. Without it the displaced client reconnects on backoff,
displaces the newcomer in turn, and the two trade the slot forever while writes
land in whichever notebook currently holds it.

## Tests

```bash
npm test --prefix powernote-mcp
```

Covers the connection-slot behaviour, including that the `displaced` frame
arrives *before* the close. The app-side half is covered by Playwright T98.

## Notes

- `stdout` is the MCP transport; all logging goes to `stderr`.
- If no notebook is connected, tools fail immediately with instructions rather
  than hanging. Requests already in flight to a displaced notebook fail straight
  away too, instead of waiting out the timeout.
