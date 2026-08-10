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
| `rename_page` | Retitle a page, and its `# Title` block if that still matches. |
| `move_page` | Move a page into another section. |
| `rename_notebook` | Rename the notebook in the app (not the file on disk). |
| `save_notebook` | Write the notebook back to the file it was opened from. |
| `check_update` | Is a newer PowerNote release available? |
| `run_update` | Install it. Overwrites the file and reloads the app. |

### Blocks, not rows

A block is one text node holding one markdown chunk. Prefer one block per
logical unit — a whole list, a whole paragraph — rather than one per line.
Blocks are full page width and stack down a column; their height is measured
against the real renderer at write time, so they never overlap.

### Columns

`append_block` and `create_page` take an optional `column` (0 = the leftmost A4
page guide, 1 = the guide immediately right of it, and so on). Columns stack
independently, so writing into column 1 starts at the top of the page regardless
of how long column 0 is. `read_page` reports each block's column and returns
blocks column-major — all of column 0 top to bottom, then column 1.

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
