# SRS: File System (Save/Load)

**Project:** PowerNote
**Version:** 0.4.1
**Date:** 2026-04-23

## Purpose

Enable users to save their entire notebook as a single self-contained HTML file and reopen it for continued editing.

## Requirements

| ID | Description | Priority | Test Ref |
|----|-------------|----------|----------|
| REQ-FILE-001 | The app shall serialize the full workspace state (sections, pages, nodes) to JSON | Must | T35 |
| REQ-FILE-002 | The app shall embed the serialized JSON inside a `<script id="powernote-data">` tag in the HTML file | Must | T35 |
| REQ-FILE-003 | A download button in the TopBar and Ctrl+S shortcut shall trigger the HTML file download | Must | T35 |
| REQ-FILE-004 | The exported HTML file shall contain the full app bundle and be editable when opened in a browser | Must | T36 |
| REQ-FILE-005 | On startup, the app shall detect and hydrate from embedded `#powernote-data` if present | Must | T36 |
| REQ-FILE-006 | An "Open" button shall allow importing an existing PowerNote HTML file to restore its workspace | Must | T36 |
| REQ-FILE-007 | A round-trip (save → open → edit → save) shall preserve all data exactly | Must | T37 |
| REQ-FILE-008 | The app shall detect whether the browser supports the File System Access API via `isFSASupported()` | Must | T79 |
| REQ-FILE-009 | When FSA is supported, a "Save As" action shall open `showSaveFilePicker()` and write the HTML bundle directly to disk | Must | T79 |
| REQ-FILE-010 | When FSA is not supported, the app shall fall back to `<a download>` behavior without user-visible errors | Must | T79 |
| REQ-FILE-011 | The active `FileSystemFileHandle` shall be persisted in IndexedDB so the session can resume without re-prompting the picker | Must | T80 |
| REQ-FILE-012 | The recent file handles list shall be LRU-capped at 5 entries, upserted by file name | Should | T80 |
| REQ-FILE-013 | The app shall expose `setCurrentHandle`, `getCurrentHandle`, `clearCurrentHandle`, `addRecentHandle`, `removeRecentHandle`, `getRecentHandles`, and `clearAllRecentHandles` APIs for handle management | Must | T80 |
| REQ-FILE-014 | The app shall verify or request permission on a persisted handle before writing, re-prompting the user if the permission has been revoked | Must | — |
| REQ-FILE-015 | While the notebook is dirty, the app shall debounce auto-save so that it fires 1.5 s after the last edit, and shall force a save no later than 5 s after the notebook first became dirty (whichever happens first) | Must | T61 |
| REQ-FILE-016 | Auto-save shall write to the notebook library (localStorage) and, when a current `FileSystemFileHandle` exists with granted read-write permission, to the live file on disk. Auto-save shall NOT write a `powernote-autosave` snapshot to localStorage | Must | T61 |
| REQ-FILE-017 | On startup, the app shall remove any legacy `powernote-autosave` localStorage key to avoid shipping stale state on upgrade | Must | T61 |
| REQ-FILE-018 | The app shall check for new releases on GitHub and offer an in-app update when a newer version is available | Should | T72 |
| REQ-FILE-019 | The TopBar shall expose a Revert action. On user confirmation, the app shall re-read the current `FileSystemFileHandle`, hydrate the workspace/canvas/draw stores from that content, and clear the dirty flag | Must | T82 |
| REQ-FILE-020 | The Revert action shall be enabled only when the workspace is dirty AND a current `FileSystemFileHandle` with granted read permission is available. Otherwise it shall be disabled (and not prompt the user) | Must | T82 |
