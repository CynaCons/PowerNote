# SRS: Document Outline

**Project:** PowerNote  
**Version:** 0.33.0  
**Date:** 2026-08-11

## Purpose

Give a scroll's markdown structure a navigable index, so a long document can be
scanned and jumped around without panning the canvas looking for a heading.

## Design notes

The outline is **derived, never stored**. Headings are not a data type in
PowerNote — they are `#` lines inside ordinary text blocks — so it is computed
from the live nodes on each render. It cannot drift out of sync with the
content, and editing a heading updates the outline with no bookkeeping.

Vertical precision is the non-obvious part. One block often holds several
headings, so anchoring each entry to `node.y` would send every entry in that
block to the same place. Each heading's offset *inside* its block is measured
against the real renderer, using the same probe the block-layout code uses.

The outline is scoped to **one active scroll**, not the page. A page with
parallel workstreams would otherwise produce a single interleaved list spanning
several unrelated documents, which is not an outline of anything.

It lives in the sidebar rather than floating over the canvas: a floating overlay
covered the very content it described, and the sidebar placement inherits the
user-controlled panel width, which is what makes long headings readable.

Navigation never changes zoom. A jump that also rescaled would cost the reader
their sense of place, which is the one thing navigation must preserve.

## Requirements

| ID | Requirement | Priority | Test |
|---|---|---|---|
| REQ-OUTLINE-001 | The sidebar shall offer an Outline tab listing the markdown headings (`#`..`###`) of the active scroll, in document order | Must | T108 |
| REQ-OUTLINE-002 | The outline shall be derived from block content on each render, so an edited, added or removed heading is reflected without further action | Must | T108 |
| REQ-OUTLINE-003 | An entry's position shall be the heading's own position, measured within its block, so several headings in one block resolve to distinct targets | Must | T108 |
| REQ-OUTLINE-004 | Clicking an entry shall move the viewport to that heading without changing the zoom level | Must | T108 |
| REQ-OUTLINE-005 | A scroll with no headings shall show an explanatory empty state rather than a blank panel | Should | T108 |
| REQ-OUTLINE-006 | Headings inside fenced code blocks shall not be treated as headings | Should | — |

## Traceability

- T108 — `tests/scroll/108-outline-active-scroll.spec.ts`

See also `docs/SRS_SCROLL.md` for the active-scroll concept the outline follows.
