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
