# SRS: In-App Update

**Project:** PowerScroll (formerly PowerNote)
**Version:** 0.67.0
**Date:** 2026-07-18

## Purpose

Allow users to detect a newer PowerNote release and apply it while preserving notebook data. Prefer an in-place “A/B swap” when a File System Access handle exists (overwrite the open file, then reload); otherwise fall back to downloading a backup plus an updated HTML file.

## Requirements

| ID | Description | Priority | Test Ref |
|----|-------------|----------|----------|
| REQ-UPDATE-001 | The app shall check GitHub Releases for a newer version than `APP_VERSION` and surface availability in Settings | Should | T69, T72 |
| REQ-UPDATE-002 | When a current `FileSystemFileHandle` has read-write permission and live-update is enabled, Update shall write the new app bundle with injected workspace data to that handle and reload the page | Must | T88 |
| REQ-UPDATE-003 | When live-swap is unavailable (no FSA handle, permission denied, write failure, or live-update disabled), Update shall download a backup of the current notebook and an updated notebook HTML for the user to open | Must | T89 |
| REQ-UPDATE-004 | After a successful live-swap reload (or after opening the downloaded updated file), workspace content shall match the pre-update data and the running app shall be the new bundle (`editorVersion` / Settings version reflect the new app) | Must | T87 |

## Download route and upgrade safety (v0.36.1)

| ID | Description | Priority | Test Ref |
|----|-------------|----------|----------|
| REQ-UPDATE-020 | The new build shall be fetched from a route that sends CORS headers; GitHub release assets do not, so `browser_download_url` and the API octet-stream endpoint cannot be relied on from a page | Must | — |
| REQ-UPDATE-021 | The download shall be pinned to the release tag, never to `main`, so an update installs the version it reported | Must | — |
| REQ-UPDATE-022 | A notebook written by an older version shall open on the current build with every section, page and node intact | Must | T131 |
| REQ-UPDATE-023 | Fields added since an older schema shall be hydrated on load, not left undefined | Must | T131 |
| REQ-UPDATE-024 | An upgraded notebook shall remain editable and re-savable, keeping both old and new content | Must | T131 |

**Why the order matters.** GitHub does not send `Access-Control-Allow-Origin`
on release-asset downloads — `browser_download_url` and the API's
octet-stream asset endpoint both 302 to objects.githubusercontent.com, and
neither response carries the header. From a page, both fail with a bare
`TypeError: Failed to fetch`. `raw.githubusercontent.com` does send it, and the
built single-file app is committed at `dist-template/index.html`, so that is the
route that works. It is kept first and pinned to the tag.

**Limit of the fix.** The updater lives inside each notebook file, so a build
that shipped with the broken order cannot repair itself. Users on those versions
must download the new build once by hand; from then on updating works.

| REQ-UPDATE-025 | Opening an older notebook file from a newer build shall migrate its workspace and rebind the file handle, so saving writes the newer build back over it | Must | T131 |
| REQ-UPDATE-026 | The update check shall be cached, so opening notebooks repeatedly does not exhaust GitHub's unauthenticated API quota (60/hour per IP) | Must | — |
| REQ-UPDATE-027 | The update check shall be skipped under automation, detected via `navigator.webdriver`, so a test run cannot spend a user's quota | Must | — |
| REQ-UPDATE-028 | A 403 from the API shall fall back to a host without an API quota rather than reporting failure | Must | — |
| REQ-UPDATE-029 | An explicit check requested by the user or an agent shall bypass the cache | Must | — |
| REQ-UPDATE-030 | The updated notebook shall embed the canvas AS IT IS at the moment Update is clicked, including edits never explicitly saved. The workspace must be re-read from the store AFTER savePageNodes/savePageStrokes run — zustand states are immutable, so a pre-save snapshot's `.workspace` silently drops those edits (found by the v0.37.5→v0.52.3 end-to-end update test: the output page had zero nodes). Note: notebooks built by v0.37.x–v0.52.3 still carry the old handler, so updating FROM them loses unsaved-at-click edits; saved content is unaffected | Must | T154 |
| REQ-UPDATE-031 | An app update shall carry the notebook's installed extension blocks into the fresh template: `buildUpdatedHtml` accepts the blocks and `performUpdate` collects them from the extension loader (memory → document block → IndexedDB) before building the final HTML. The template arrives pristine from the release, so anything not re-injected is silently uninstalled — with no extensions held, the output is byte-identical to the pre-v0.65 behaviour | Must | T183 |

## Release publication policy (v0.66.1)

| ID | Description | Priority | Test Ref |
|----|-------------|----------|----------|
| REQ-UPDATE-032 | A requested version tag shall build and publish the committed single-file artifact without installing a browser or rerunning the full Playwright campaign. The full campaign remains a required local pre-tag check and an independent `main`/pull-request CI signal, so its duration or an unrelated flake cannot strand an intentional release. | Must | workflow inspection |
| REQ-UPDATE-033 | Release hardening shall include a real upgrade proof from a previously shipped notebook artifact to the newly published tag, confirming that the new version runs and embedded notebook content survives. | Must | release smoke |

## PowerScroll rename compatibility (v0.67.0)

| ID | Description | Priority | Test Ref |
|----|-------------|----------|----------|
| REQ-UPDATE-034 | The PowerScroll updater shall query the renamed GitHub repository and prefer `PowerScroll.html`, while accepting the transitional `PowerNote.html` release asset so notebooks and releases spanning the rename remain updateable. | Must | T187 |
| REQ-UPDATE-035 | The v0.67.0 release shall publish both `PowerScroll.html` and a byte-identical `PowerNote.html` compatibility alias; the committed tag-pinned template route shall remain available after the repository rename. | Must | T187, release smoke |
