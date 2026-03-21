# SRS: Text Blocks

**Project:** PowerNote
**Version:** 0.2.7
**Date:** 2026-03-21

## Purpose

Allow users to create, edit, move, and delete markdown-capable text blocks on the canvas.

## Requirements

| ID | Description | Priority | Test Ref |
|----|-------------|----------|----------|
| REQ-TEXT-001 | With the text tool active, clicking the canvas shall place a new text block at the click position | Must | T03 |
| REQ-TEXT-002 | A newly placed text block shall immediately enter inline edit mode | Must | T03 |
| REQ-TEXT-003 | Double-clicking an existing text block shall enter inline edit mode | Must | T04 |
| REQ-TEXT-004 | Blur (click away) shall commit the text edit | Must | T04 |
| REQ-TEXT-005 | Pressing Escape during edit shall cancel and revert | Must | T04 |
| REQ-TEXT-006 | Text blocks shall be draggable to reposition on the canvas | Must | T05 |
| REQ-TEXT-007 | Text blocks shall auto-size to content (no manual resize handles) | Must | — |
| REQ-TEXT-008 | Text shall reflow (word-wrap) within the block width | Must | T16 |
| REQ-TEXT-009 | Delete/Backspace key shall delete the selected text block(s) | Must | T06 |
| REQ-TEXT-010 | The T key shall toggle the text tool on/off | Should | T06 |
| REQ-TEXT-011 | The text tool shall revert to select after placing one text block (one-shot) | Must | — |
| REQ-TEXT-012 | Single click on a text block shall select it (not edit) | Must | — |
| REQ-TEXT-013 | Ctrl+Click shall toggle multi-selection | Must | — |
| REQ-TEXT-014 | Ctrl+C / Ctrl+V shall copy and paste selected text blocks | Must | — |
| REQ-TEXT-015 | Ctrl+A shall select all nodes on the current page | Should | — |
| REQ-TEXT-016 | Text content shall be rendered as markdown (headers, bold, italic, lists, code, blockquotes) | Must | — |
| REQ-TEXT-017 | The text editor shall support Tab/Shift+Tab for indentation | Should | — |
| REQ-TEXT-018 | The text editor shall auto-continue bullet points and numbered lists on Enter | Should | — |
| REQ-TEXT-019 | Shift+drag shall show snap alignment guides when edges/centers align with other nodes | Should | — |
| REQ-TEXT-020 | Text blocks shall auto-size width to fit rendered content (min 60px, max 800px) | Must | T21 |
| REQ-TEXT-021 | Markdown task list checkboxes (- [ ] / - [x]) shall be clickable to toggle state | Must | — |
