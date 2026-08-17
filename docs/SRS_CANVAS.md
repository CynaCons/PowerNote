# SRS: Infinite Canvas

**Project:** PowerNote
**Version:** 0.2.0
**Date:** 2026-03-21

## Purpose

Provide an infinite, pannable, zoomable canvas as the primary workspace for placing and arranging nodes.

## Requirements

| ID | Description | Priority | Test Ref |
|----|-------------|----------|----------|
| REQ-CANVAS-001 | The app shall display an infinite canvas that fills the available viewport area | Must | T00 |
| REQ-CANVAS-002 | The user shall be able to pan the canvas by clicking and dragging the background | Must | T01 |
| REQ-CANVAS-003 | The user shall be able to zoom in/out using Ctrl+scroll wheel, centered on the cursor position | Must | T02 |
| REQ-CANVAS-004 | Zoom level shall be clamped between 0.1x and 5.0x | Must | T02 |
| REQ-CANVAS-005 | The canvas shall resize responsively when the browser window is resized | Should | T00 |
| REQ-CANVAS-006 | Clicking the background with the select tool shall deselect any selected node | Must | T03 |
| REQ-CANVAS-013 | With the select tool active, dragging on the canvas background shall draw a lasso selection rectangle | Must | T74 |
| REQ-CANVAS-014 | Releasing the lasso shall select every node whose bounding box intersects the lasso rectangle (text, shapes, images) | Must | T74 |
| REQ-CANVAS-015 | Dragging any node in a multi-selection shall move all selected nodes (and selected strokes) together | Must | T74, T93 |
| REQ-CANVAS-016 | Pressing Escape or clicking the background shall clear the multi-selection | Must | T74 |
| REQ-CANVAS-017 | Scrolling without Ctrl shall pan the canvas vertically; Shift+scroll shall pan horizontally | Must | — |
| REQ-CANVAS-018 | A floating zoom bar shall be displayed at the bottom-right of the canvas, showing the current zoom level as a percentage | Must | T99 |
| REQ-CANVAS-019 | The zoom readout shall track the viewport scale regardless of how the zoom changed (wheel, pinch, bar or shortcut) | Must | T99 |
| REQ-CANVAS-020 | The zoom bar shall provide + and − buttons that step the zoom by a factor of 1.25 | Must | T99 |
| REQ-CANVAS-021 | Zoom applied from the bar or shortcuts shall be anchored on the centre of the visible canvas | Must | T99 |
| REQ-CANVAS-022 | The + / − buttons shall be disabled once the zoom reaches its 5.0x / 0.1x bound | Should | T99 |
| REQ-CANVAS-023 | Clicking the zoom readout shall open a menu offering zoom-to-fit, actual size, and the presets 25/50/75/100/150/200/400%, dismissed by outside click or Escape | Must | T99 |
| REQ-CANVAS-024 | Shift+1 shall zoom to fit and Shift+0 shall reset to 100%; neither shall fire while a text field has focus | Must | T99 |
| REQ-CANVAS-025 | A two-finger pinch on a touch device shall zoom the canvas, anchored on the midpoint between the two fingers | Must | T106 |
| REQ-CANVAS-026 | Pinch zoom shall respect the same 0.1x–5.0x bounds as wheel and bar zoom | Must | T106 |
| REQ-CANVAS-027 | Moving two fingers together shall pan the canvas without changing zoom; each pinch gesture initializes its own finger-distance baseline so a malformed touchend cannot leak the previous gesture's zoom into the next | Should | T136 |
| REQ-CANVAS-028 | With the select tool active, a ~500ms still press on a node (touch) shall select it and open the same context menu right-click uses, at the press position; moving past ~10px or lifting early cancels it, and it shall not fire while draw/shape/lasso own touch for their own gestures | Should | T138 |
| REQ-CANVAS-029 | The top bar's filename/section/page breadcrumb shall ellipsize each segment individually when the bar is too narrow to show them in full, rather than hard-clipping the trailing (active-page) segment invisibly with no truncation indicator | Should | T143 |

### Not implemented

Recorded so the gap is visible rather than inferred from silence.

| ID | Description | Priority | Status |
|----|-------------|----------|--------|
| REQ-CANVAS-010 | A visible undo control shall sit in the top bar, immediately left of zoom-to-fit, disabled when there is nothing to undo and titled to say so | Must | T134 |
| REQ-CANVAS-011 | The button and Ctrl+Z shall unwind the SAME history, routed by the active tool from one shared definition (`src/utils/undoOps.ts`) — there are two independent stacks (nodes in the canvas store, strokes in the draw store) and a second copy of the routing rule would eventually disagree with the first | Must | T134 |

