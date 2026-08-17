# SRS: Hierarchy Panel

**Project:** PowerNote
**Version:** 0.54.0
**Date:** 2026-08-17

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
| REQ-HIER-017 | On a page with at least one TITLED scroll the workspace top is y=0 by convention (stored nowhere). Titled, because every page is born with one untitled scroll as an agent append target — gating on mere presence would bound every canvas in the app (caught by T01/T71). Scroll titles rest as one aligned row at the derived ceiling `min(0, topmostContentY − PAD)` spanning nodes and strokes, so legacy content at negative y stays reachable; the v0.35 pin-to-viewport-top behaviour when scrolled down is unchanged. Pages with no titled scroll keep a fully infinite canvas | Must | T150 |
| REQ-HIER-018 | The user shall be able to widen a scroll band to its widest member plus padding via an explicit "Fit scroll to content" action on the scroll title header. Scrolls to its right, and their members, shall shift rightward by the delta. The action is never automatic. One undo shall restore the band width and the shifted members | Must | T151 |
| REQ-HIER-019 | A titled scroll shall render its title in two visual states, switched by the existing v0.35 pin threshold (no extra stored state). At rest on the ceiling row the title is a heading (larger semibold ink, no background strip). When pinned over content it is a compact wayfinding strip (~22px tall, ~12px type, white background at ~0.92 opacity, hairline bottom edge). Both states remain double-click / double-tap renameable. An untitled scroll draws no header in either state | Must | T152 |
| REQ-HIER-020 | Renaming a scroll to an empty title shall untitled it: the header disappears (REQ-HIER-019) and the page ceiling disarms (REQ-HIER-017 titled gate). Re-titling shall restore both. Creating a scroll with an empty name still creates nothing (T122) | Must | T157 |
| REQ-HIER-021 | The last scroll on a page shall remain undeletable (the append-target invariant). A plain page is one untitled scroll — untitle it instead of deleting the last one. `delete_scroll` shall say so when it refuses | Must | T157, T109 |
| REQ-HIER-022 | Column operations that renumber bands (delete-keep, reorder, move) shall use one group-aware membership/shift path: a diagram or group belongs to the band of its FRAME origin and every member and grouped stroke follows that verdict, never split; ungrouped strokes belong to the band of their first point and shift with it. This closes the straddling-diagram tearing class for ALL column operations | Must | T158 |
