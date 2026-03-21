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
