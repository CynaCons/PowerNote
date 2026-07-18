# SRS: Bottom Toolbar

**Project:** PowerNote
**Version:** 0.2.0
**Date:** 2026-03-21

## Purpose

Provide a contextual toolbar for formatting text properties (font size, style, color) on new and existing text blocks.

## Requirements

| ID | Description | Priority | Test Ref |
|----|-------------|----------|----------|
| REQ-TOOL-001 | The bottom toolbar shall appear when the text tool is active or a text node is selected | Must | T10 |
| REQ-TOOL-002 | The toolbar shall provide font size selection from predefined sizes | Must | T11 |
| REQ-TOOL-003 | The toolbar shall provide bold, italic, underline, strikethrough, and inline-code buttons. Bold/italic toggle the whole node when no editor is open and operate on the substring selection when an editor is open. Underline/strike/code are only enabled while editing. | Must | T11, T83 |
| REQ-TOOL-004 | The toolbar shall provide text color selection | Must | T11 |
| REQ-TOOL-005 | When a text node is selected (not being edited), bold/italic shall toggle the whole block's style; size/color changes shall update that node in real-time | Must | T11 |
| REQ-TOOL-006 | When no node is selected (text tool mode), toolbar changes shall set defaults for new text blocks | Should | T11 |
| REQ-TOOL-007 | When a text block is being edited, formatting buttons shall format **only the selected text** (inline markdown), shall not blur the editor or commit the edit, and shall preserve the textarea selection across the click | Must | T83, T84 |
