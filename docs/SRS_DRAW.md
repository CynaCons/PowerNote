# SRS: Drawing & Eraser

**Project:** PowerNote
**Version:** 0.10.4
**Date:** 2026-03-25

## Purpose

Allow users to draw freehand strokes on the canvas using a pen tool and erase strokes using stroke-level or zone-level erasers, with full persistence through save/load.

## Requirements

| ID | Description | Priority | Test Ref |
|----|-------------|----------|----------|
| REQ-DRAW-001 | With the draw tool active, clicking and dragging on the canvas shall create a freehand stroke composed of recorded points | Must | — |
| REQ-DRAW-002 | Stroke color shall be configurable via the draw toolbar | Must | — |
| REQ-DRAW-003 | Stroke width shall be configurable between 1px and 20px via the draw toolbar | Must | — |
| REQ-DRAW-004 | Stroke eraser mode shall delete an entire stroke when the eraser cursor contacts any part of it | Should | — |
| REQ-DRAW-005 | Zone eraser mode shall remove only the portion of a stroke that falls under the eraser cursor | Should | — |
| REQ-DRAW-006 | Zone eraser size shall be configurable (small, medium, large) | Should | — |
| REQ-DRAW-007 | Strokes shall persist when navigating away from a page and returning | Must | — |
| REQ-DRAW-008 | Strokes shall be included in the exported HTML file and restored on import | Must | — |
