# SRS — Image Features

**Project:** PowerNote
**Version:** 0.24.1
**Date:** 2026-04-14

## Purpose

Allow users to place, transform, and edit images on the canvas. Images must round-trip through save/load as embedded base64 data.

## Status Notes (post-audit, 2026-04-14)

Most REQ-IMAGE-004..016 entries were authored as planned specs in v0.10 and actually shipped in v0.11 via commit `badcbfb`. However, **three requirements have not yet shipped** and are marked `Status: Planned` in the tables below:

- **REQ-IMAGE-007** — the current crop UX uses toolbar sliders, not a visual overlay with drag handles.
- **REQ-IMAGE-011** — only 90° rotate increments are implemented; free rotation via drag handle is not.
- **REQ-IMAGE-015** — multiple imported images are placed with a linear Y-stagger, not in a proper grid layout.

Many shipped requirements also lack dedicated E2E coverage and are tracked in the `Test Coverage Gaps (tracked)` section of `PLAN.md`. Backfilling tests for these is a known debt item.

## Existing (v0.6)

| ID | Requirement | Priority | Test |
|----|------------|----------|------|
| REQ-IMAGE-001 | User can add images via clipboard paste (Ctrl+V) | Must | T40 |
| REQ-IMAGE-002 | User can add images via drag-drop from OS | Must | T40 |
| REQ-IMAGE-003 | User can add images via file picker in NavRail | Must | T40 |

## Image Toolbar + Editing (shipped v0.11, commit `badcbfb` unless noted)

| ID | Requirement | Priority | Status | Test |
|----|------------|----------|--------|------|
| REQ-IMAGE-004 | Clicking image tool opens ImageToolbar in bottom bar | Must | Shipped | — (needs test) |
| REQ-IMAGE-005 | ImageToolbar shows import button when no image selected | Must | Shipped | — (needs test) |
| REQ-IMAGE-006 | ImageToolbar shows edit tools (crop, rotate) when image selected | Must | Shipped | — (needs test) |
| REQ-IMAGE-007 | Crop mode: dark overlay, drag handles to adjust crop region | Should | **Planned** (currently toolbar sliders only) | — |
| REQ-IMAGE-008 | Crop is non-destructive (stores original + normalized crop rect) | Must | Shipped | — (needs test) |
| REQ-IMAGE-009 | Reset button restores original uncropped image | Must | Shipped | — (needs test) |
| REQ-IMAGE-010 | Rotate: 90-degree increments via CW/CCW buttons | Must | Shipped | — (needs test) |
| REQ-IMAGE-011 | Rotate: free rotation via drag handle | Should | **Planned** | — |
| REQ-IMAGE-012 | Resize maintains aspect ratio by default | Must | Shipped (Shift-override **planned**) | — (needs test) |
| REQ-IMAGE-013 | Resize is lossless (display-only scaling, `naturalWidth/naturalHeight` preserved) | Must | Shipped | — (needs test) |
| REQ-IMAGE-014 | File picker accepts multiple images at once | Must | Shipped | — (needs test) |
| REQ-IMAGE-015 | Multiple images auto-arranged in grid layout (no overlap) | Should | **Planned** (currently linear Y-stagger) | — |
| REQ-IMAGE-016 | Drag-drop multiple files from OS file explorer | Must | Shipped | — (needs test) |
