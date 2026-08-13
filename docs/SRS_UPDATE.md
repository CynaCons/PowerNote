# SRS: In-App Update

**Project:** PowerNote
**Version:** 0.25.0-proto
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
