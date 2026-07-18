# PowerNote — Product Requirements Document (PRD v2)

## 1. Overview

PowerNote is an offline-first, file-based visual note-taking application that combines:

- Structured hierarchy (like OneNote)
- Freeform canvas editing (like PowerPoint)
- Infinite whiteboard interaction (like Whiteboard)

**Core innovation:** Each file is a fully self-contained, editable application (HTML-based) containing both the data and the editor.

## 2. Vision

Enable users to:

- Organize knowledge hierarchically
- Think visually on a free canvas
- Own their data completely (no lock-in)
- Work offline in secure environments
- Share editable knowledge as a single file

## 3. Product Definition

"OneNote + PowerPoint + Whiteboard — but file-based and offline-first."

## 4. Core Principles

- Offline-first
- File-based (local filesystem as source of truth)
- Visual-first editing
- Simple, fast, minimal friction
- No mandatory account

## 5. Core User Model

```
Workspace
├── Section
│   ├── Page (canvas)
│   ├── Page
├── Section
│   ├── Page
```

- Each Page = infinite canvas
- Navigation via sidebar (OneNote-style)

## 6. Key Features

### 6.1 Canvas Editor (MVP)

Each page is a freeform canvas with:

- Pan / zoom
- Add elements:
  - Text blocks
  - Images
  - Basic shapes (rectangle, arrow)
- Drag & drop
- Resize / edit
- Simple drawing (optional v1.1)

### 6.2 Hierarchical Navigation

- Sidebar with:
  - Sections
  - Pages
- Create / rename / delete
- Fast navigation between pages

### 6.3 File-Based System (CORE)

**Export:**
- Save as `.html` file
- Contains:
  - App (JS bundle)
  - Data (JSON)
  - Assets (embedded)

**Import:**
- Open directly in browser
- Fully editable

### 6.4 Data Model (v1)

```json
{
  "version": "1.0",
  "sections": [
    {
      "id": "section-1",
      "title": "System Design",
      "pages": [
        {
          "id": "page-1",
          "title": "Architecture",
          "nodes": []
        }
      ]
    }
  ],
  "assets": {
    "images": {}
  }
}
```

### 6.5 Save Mechanism

- Serialize app state
- Inject into HTML template
- Trigger download (fallback) or write directly via File System Access API (Chrome/Edge)

### 6.6 MVP Success Criteria

The MVP is complete when all of the following are true. Each criterion is binary and testable.

- **SC-1 — Round-trip:** User can create a notebook, add ≥2 pages, place at least one text / shape / image / drawing node on each, save as standalone HTML, reopen the file in Chrome, and observe no data loss.
- **SC-2 — Load performance:** A notebook of 20 pages × 10 nodes loads in under 2 seconds on a mid-range laptop.
- **SC-3 — Traceability:** Every SRS requirement marked `Priority: MUST` has a passing E2E test referenced in its `Test Ref` column.
- **SC-4 — Offline export:** Standalone HTML export works fully offline — no runtime CDN fetches, no network calls required to open or edit.
- **SC-5 — Undo/redo parity:** Undo and redo round-trip cleanly for every node type (text, image, shape, drawing, arrow/line).
- **SC-6 — State preservation:** File round-trip (save → close → reopen) preserves 100% of canvas state: positions, z-order, styles, crop, rotation, markdown content, selection-independent properties.

## 7. Business Model

> **Status: Deferred.** The free, offline, file-based tier is the only tier in scope for the MVP. A paid tier (cloud sync, multi-device, version history, collaboration) will be designed once cloud deployment infrastructure exists. Early product ideas for that tier are tracked in [`VISION.md`](./VISION.md) so they are not lost but do not pollute MVP planning.

## 8. Non-Goals (MVP)

- Advanced diagram libraries
- Animations (PowerPoint-style)
- Complex databases
- Plugins
- Mobile apps

## 9. UX Principles

- Instant start (no login)
- Low cognitive load
- Keyboard-friendly
- Visual clarity
- Fast interaction

## 10. Technical Architecture

**Frontend:** React 18 + TypeScript + Vite

**Canvas:** Konva.js (react-konva) — MIT-licensed, chosen over tldraw to avoid a $6K/year commercial license

**State:** 4 Zustand stores (workspace, canvas, draw, tool)

**Text:** `marked` for markdown, `KaTeX` for math rendering, raw editing via textarea overlay

**File Format:**
```html
<script id="powernote-data" type="application/json">
{ ... }
</script>
```

**Persistence:** File System Access API (Chrome/Edge) for direct disk write, `<a download>` fallback for Firefox/Safari, auto-save to `localStorage` every 30 s.

## 11. Risks

- **Browser save limitations** — mitigated by dual path: File System Access API where available, `<a download>` fallback elsewhere; auto-save to localStorage as safety net.
- **File size growth** — mitigated by embedding images as compressed data URLs; assets reference original `naturalWidth/naturalHeight` for lossless resize; future work may externalize large assets.
- **Security concerns (HTML execution)** — mitigated by serializing data as JSON inside `<script type="application/json">` (never executed) and escaping `<script>` sequences inside the bundled JS; users only run HTML they themselves open.
- **Feature creep** — mitigated by explicit Non-Goals (§8), SC-* success criteria (§6.6), and deferred paid-tier scope (§7).

## 12. Roadmap

| Phase | Status | Scope |
|-------|--------|-------|
| Phase 1 (MVP, v0.1–v0.22) | **Shipped** | Canvas (pan/zoom/scroll-to-pan), text + markdown + math, images (toolbar, crop, rotate, multi-import, drag-drop), shapes (rect/circle/triangle/arrow/line with two-vertex handles), freehand drawing + eraser, hierarchy (sections + pages), search + replace, lasso select, undo/redo, save/load standalone HTML, File System Access direct save, auto-save, auto-update |
| Phase 2 (current) | In progress | Production polish: SRS coverage for shipped features, test backfill, SC-* success criteria green |
| Phase 3 (planned) | Planned | Mobile touch polish, keyboard shortcuts overlay, richer image tooling (visual crop overlay, free rotation, grid layout) |
| Phase 4 (deferred) | Deferred | Cloud sync, multi-device, collaboration — requires cloud deployment infrastructure; scope tracked in `VISION.md` |

## 13. Positioning

Structured visual notes, fully owned by the user.

## 14. Summary

PowerNote introduces: Editable, portable knowledge files combining structure and visual thinking — without requiring the cloud.

---

**Owner:** Constantin Chabirand
**Date:** 2026-03-21
**Status:** v2 (Validated Concept)
