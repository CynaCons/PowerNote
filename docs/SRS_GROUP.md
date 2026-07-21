# SRS: Shape & Drawing Groups

**Project:** PowerNote  
**Version:** 0.27.0  
**Date:** 2026-07-21

## Purpose

Allow users to group shapes and freehand strokes into a durable flat unit that
moves together, with isolation mode to edit individual members without ungrouping.

## Requirements

| ID | Description | Priority | Test Ref |
|----|-------------|----------|----------|
| REQ-GROUP-001 | User shall group ≥2 selected shapes and/or strokes into a flat group (Ctrl+G or context menu) | Must | T93 |
| REQ-GROUP-002 | Clicking any group member (outside isolation) shall select all members of that group | Must | T93 |
| REQ-GROUP-003 | Dragging a multi-selection or group shall move all selected members (nodes + strokes) by the same delta | Must | T93 |
| REQ-GROUP-004 | User shall ungroup a selected group (Ctrl+Shift+G or context menu) | Must | T93 |
| REQ-GROUP-005 | Double-click on a group member, Enter with group selected, or “Edit group” shall enter isolation for that group | Must | T93 |
| REQ-GROUP-006 | In isolation, user shall select and edit a single member without ungrouping | Must | T93 |
| REQ-GROUP-007 | Esc or Done shall exit isolation and restore group-level selection | Must | T93 |
| REQ-GROUP-008 | `groupId` on nodes and strokes shall round-trip in notebook HTML | Must | T93 |
| REQ-GROUP-009 | Nested groups shall not be created in v1 (regroup reassigns a single flat groupId) | Must | T93 |
| REQ-GROUP-010 | Group command shall only accept shape nodes and strokes; other node types show an error toast | Must | T93 |

## Related

- REQ-CANVAS-015 multi-select move (strengthened by multi-drag implementation)
- REQ-SHAPE family for shape create/select
- REQ-DRAW for freehand strokes
