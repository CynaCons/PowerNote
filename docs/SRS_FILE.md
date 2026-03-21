# SRS: File System (Save/Load)

**Project:** PowerNote
**Version:** 0.4.0
**Date:** 2026-03-21

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
