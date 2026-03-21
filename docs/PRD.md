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
- Trigger download

## 7. Business Model

**Free:**
- Full editor
- File-based workflow
- Offline usage
- No account required

**Paid (€1.99–€4.99/month):**
- Cloud sync
- Multi-device access
- Backup
- Version history
- Collaboration (future)

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

**Frontend:** React + Vite

**Canvas:** Preferred: tldraw or Konva.js

**File Format:**
```html
<script id="powernote-data" type="application/json">
{ ... }
</script>
```

## 11. Risks

- Browser save limitations
- File size growth
- Security concerns (HTML execution)
- Feature creep

## 12. Roadmap

| Phase | Scope |
|-------|-------|
| Phase 1 (MVP) | Canvas, Text/images/shapes, Save/load HTML |
| Phase 2 | Hierarchy (sections/pages) |
| Phase 3 | Cloud sync (paid) |
| Phase 4 | Collaboration |

## 13. Positioning

Structured visual notes, fully owned by the user.

## 14. Summary

PowerNote introduces: Editable, portable knowledge files combining structure and visual thinking — without requiring the cloud.

---

**Owner:** Constantin Chabirand
**Date:** 2026-03-21
**Status:** v2 (Validated Concept)
