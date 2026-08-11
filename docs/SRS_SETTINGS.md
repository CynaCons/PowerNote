# SRS: Settings

**Project:** PowerNote
**Version:** 0.31.0
**Date:** 2026-07-18

## Purpose

Provide a settings panel for configuring application preferences such as canvas background mode and page guide visibility.

## Requirements

| ID | Description | Priority | Test Ref |
|----|-------------|----------|----------|
| REQ-SETTINGS-001 | A settings gear icon at the bottom of the NavRail shall toggle a settings panel | Must | — |
| REQ-SETTINGS-002 | The settings panel shall provide a background mode toggle with options: pages (A4 guides), grid, and none | Must | T85 |
| REQ-SETTINGS-003 | Settings selections shall live in workspace state and survive page navigation within the session | Must | T85 |
| REQ-SETTINGS-004 | Canvas settings (`backgroundMode`, `bgColor`) shall be serialized inside `#powernote-data` and restored on open/reload so each notebook remembers its look; older files without `settings` shall hydrate with defaults (pages, white) | Must | T85 |
| REQ-SETTINGS-005 | A `scroll` guide style shall render each occupied column as one continuous sheet with a light separator at every page boundary, rather than as detached A4 cards, and shall keep one blank page of headroom below the last block | Must | T101 |
| REQ-SETTINGS-006 | An agent shall read (`get_background`) and change (`set_background`) the guide style and background colour; the change shall mark the notebook dirty so the existing save pipeline persists it, with no separate persistence path | Must | T102, T103 |
