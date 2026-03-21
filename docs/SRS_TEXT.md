# SRS: Text Blocks

**Project:** PowerNote
**Version:** 0.2.0
**Date:** 2026-03-21

## Purpose

Allow users to create, edit, move, resize, and delete text blocks on the canvas.

## Requirements

| ID | Description | Priority | Test Ref |
|----|-------------|----------|----------|
| REQ-TEXT-001 | With the text tool active, clicking the canvas shall place a new text block at the click position | Must | T03 |
| REQ-TEXT-002 | A newly placed text block shall immediately enter inline edit mode | Must | T03 |
| REQ-TEXT-003 | Double-clicking an existing text block shall enter inline edit mode | Must | T04 |
| REQ-TEXT-004 | Pressing Enter (without Shift) during edit shall commit the text | Must | T04 |
| REQ-TEXT-005 | Pressing Escape during edit shall cancel and revert | Must | T04 |
| REQ-TEXT-006 | Text blocks shall be draggable to reposition on the canvas | Must | T05 |
| REQ-TEXT-007 | Selected text blocks shall display resize handles via Transformer | Must | T03 |
| REQ-TEXT-008 | Text shall reflow (word-wrap) when the text block width is changed via resize | Must | T16 |
| REQ-TEXT-009 | Delete/Backspace key shall delete the selected text block (when not in edit mode) | Must | T06 |
| REQ-TEXT-010 | The T key shall toggle the text tool on/off | Should | T06 |
