# SRS: Scrolls

**Project:** PowerNote  
**Version:** 0.31.0  
**Date:** 2026-08-11

## Purpose

Give the vertical column bands on a page an identity — a stable id and a visible
title — so that more than one workstream can share a page without their content
interleaving, and so an agent can target a specific column instead of guessing
an index.

## Design notes

A **scroll** is a named band, not a container. `ScrollRecord { id, title, column }`
lives on the page and owns identity only; which blocks belong to a scroll is
**derived** from each block's `x`, through the same `columnAt` band test the page
guides draw with.

Storing membership on the block (as groups do with `groupId`) was rejected
deliberately. A group is a user-formed set that cannot be derived from position;
a scroll *is* a position. With stored membership, dragging a block into another
scroll would leave it filed under the old one, and the next agent append would
stack beneath a block that is no longer visibly there. Deriving it means the
canvas and the record can never disagree.

Because bands are positional, any operation that renumbers them (reorder, delete)
must move the affected blocks in the same state update — see `compactColumns`,
where array order is the instruction and every node move is resolved against a
snapshot of the pre-move layout.

Scroll titles are drawn as canvas **chrome**, not as text nodes. A title is not
content: as a node it would be selectable, draggable, deletable, and would
surface in `read_page` as the scroll's first block.

Untitled scrolls draw no header. Every page written before v0.31 is backfilled
with an untitled record on load, so drawing a placeholder would put a header on
every page of every existing notebook. A name is chosen, not inherited.

Scrolls provide **spatial isolation, not concurrency**. The bridge still holds a
single app socket, so agent commands arrive sequentially; what scrolls guarantee
is that sequential writes from different workstreams land in different columns.

## Requirements

| ID | Requirement | Priority | Test |
|---|---|---|---|
| REQ-SCROLL-001 | Every page shall carry at least one scroll record, created with the page and backfilled on load for pages written before v0.31 | Must | T104 |
| REQ-SCROLL-002 | A scroll record shall have a stable id that survives save → open, reorder and deletion of other scrolls | Must | T104 |
| REQ-SCROLL-003 | A block shall belong to the scroll whose column band it physically occupies; membership shall not be stored on the block | Must | T104 |
| REQ-SCROLL-004 | Reordering a scroll shall move its blocks into the new band in the same update | Must | T104 |
| REQ-SCROLL-005 | Deleting a scroll shall close the resulting gap; blocks in the removed band shall be preserved unless deletion is explicitly requested with them, and the last scroll on a page shall not be deletable | Must | T104 |
| REQ-SCROLL-006 | An agent shall be able to list a page's scrolls with their ids, titles, columns and block counts | Must | T105 |
| REQ-SCROLL-007 | An agent shall be able to create and rename scrolls, and to target one by id when appending a block | Must | T105 |
| REQ-SCROLL-008 | A named scroll's title shall be shown at the top of its column on the canvas, in the hierarchy panel, and renameable by double-clicking the header; untitled scrolls shall render no header | Must | T104 |
| REQ-SCROLL-009 | An unknown `scrollId` shall be rejected with NOT_FOUND and shall not fall back to another band | Must | T105 |
| REQ-SCROLL-010 | The legacy `column` parameter shall keep working for `append_block` and `create_page` | Should | T105 |
| REQ-SCROLL-011 | Exactly one scroll on the active page shall be *active*, set by an explicit click (sidebar entry or canvas header) and defaulting to the leftmost; it shall be marked in both places, and shall reset when the page changes | Must | T108 |
| REQ-SCROLL-012 | Clicking a scroll in the sidebar shall open its page, make it active, and move the viewport to the top of that scroll | Must | T108 |

## Traceability

- T104 — `tests/scroll/104-scroll-identity.spec.ts`
- T105 — `tests/agent/105-agent-parallel-scrolls.spec.ts`

See also `docs/SRS_AGENT.md` for the bridge transport and the single-connection
constraint that bounds what "parallel" means here.
