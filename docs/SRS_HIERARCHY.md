# SRS: Hierarchy Panel

**Project:** PowerNote
**Version:** 0.2.0
**Date:** 2026-03-21

## Purpose

Organize the workspace into sections and pages, with a navigable hierarchy panel and live breadcrumb.

## Requirements

| ID | Description | Priority | Test Ref |
|----|-------------|----------|----------|
| REQ-HIER-001 | The app shall start with at least one section containing at least one page | Must | T00 |
| REQ-HIER-002 | The hierarchy panel shall be toggled via the NavRail layers button | Must | T07 |
| REQ-HIER-003 | Sections shall be expandable/collapsible in the hierarchy panel | Should | T07 |
| REQ-HIER-004 | Clicking a page in the hierarchy shall navigate to it and load its canvas nodes | Must | T08 |
| REQ-HIER-005 | The user shall be able to add new sections | Must | T09 |
| REQ-HIER-006 | The user shall be able to add new pages to any section | Must | T09 |
| REQ-HIER-007 | The user shall be able to rename sections via inline edit | Must | T12 |
| REQ-HIER-008 | The user shall be able to delete sections (minimum 1 must remain) | Must | T13 |
| REQ-HIER-009 | The user shall be able to rename pages via inline edit | Must | T14 |
| REQ-HIER-010 | The user shall be able to delete pages (minimum 1 per section must remain) | Must | T15 |
| REQ-HIER-011 | The TopBar breadcrumb shall reflect current section and page names in real time | Must | T08 |
| REQ-HIER-012 | The hierarchy panel shall be resizable by dragging a handle on its right edge, so section and page names longer than the default width can be read | Must | T107 |
| REQ-HIER-013 | Panel width shall be clamped to 180–560px; double-clicking the handle shall reset it to the 240px default | Must | T107 |
| REQ-HIER-014 | The resize handle shall be keyboard operable: focusable, with Arrow keys resizing in 16px steps and Home resetting to the default | Should | T107 |
| REQ-HIER-015 | Panel width shall be session-only — held in component state, written neither to the notebook file nor to localStorage, so a reload returns to the default | Must | T107 |
| REQ-HIER-016 | At viewport widths <=768px the hierarchy panel shall render as an overlay drawer over the canvas, with a dimmed backdrop, rather than sharing width with it; it shall close on backdrop click, on Escape, and after navigating to a page. Above 768px, layout and behavior shall be unchanged | Must | T144 |
