# SRS: Collapsible Containers

**Project:** PowerNote
**Version:** 0.2.0
**Date:** 2026-03-21

## Purpose

Allow users to group canvas nodes into collapsible containers that can be moved as a unit, providing visual organization on the infinite canvas.

## Requirements

| ID | Description | Priority | Test Ref |
|----|-------------|----------|----------|
| REQ-CONT-001 | The user shall be able to place a container on the canvas using the container tool | Must | T17 |
| REQ-CONT-002 | Containers shall be collapsible — collapsed shows only the title bar, expanded shows full area | Must | T18 |
| REQ-CONT-003 | Dragging a container shall move all its children by the same delta | Must | T19 |
| REQ-CONT-004 | Dragging a node into a container's bounds shall parent it to that container | Must | T20 |
| REQ-CONT-005 | Dragging a node outside its parent container's bounds shall unparent it | Must | T20 |
| REQ-CONT-006 | Containers shall NOT be nestable (one level deep only) | Must | — |
| REQ-CONT-007 | Deleting a container shall release its children to the canvas root | Must | T18 |
| REQ-CONT-008 | The container title shall be editable via double-click | Should | T17 |
