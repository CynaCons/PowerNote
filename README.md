# PowerNote

**Structured visual notes, fully owned by the user.**

PowerNote combines the hierarchy of OneNote, the freeform canvas of PowerPoint, and the freedom of a whiteboard — in a single HTML file that works offline.

## Get Started

1. Download **`PowerNote.html`** from the [latest release](https://github.com/CynaCons/PowerNote/releases/latest)
2. Open it in any browser
3. Start taking notes
4. Press **Ctrl+S** to save — your notes are embedded in the file itself

No install. No account. No server. Just open and write.

## Features

- **Infinite canvas** — pan, zoom, pinch on touch devices; scroll-to-pan, shift+scroll for horizontal
- **Rich text** — Markdown rendering (headers, bold, italic, lists, tables, code, checkboxes, clickable links)
- **Math / LaTeX** — inline `$E=mc^2$` and display `$$...$$` via KaTeX
- **Images** — paste from clipboard, drag-drop, multi-file import, crop, 90° rotate, notes
- **Freehand drawing** — pen with color/size options, stroke and zone erasers
- **Shapes** — rectangles, circles, triangles, arrows (two-vertex handles), lines with fill/stroke/dash styling
- **Hierarchy** — sections and pages like OneNote, drag to reorder
- **Search & Replace** — Ctrl+F for current page, Ctrl+Shift+F across notebook, replace mode
- **Lasso select** — drag-rectangle to select multiple nodes, move as a group
- **Undo/Redo** — per-page history (Ctrl+Z / Ctrl+Shift+Z)
- **Duplicate** — Ctrl+Alt+drag to clone nodes
- **Links** — external URLs and internal page links
- **Save to disk** — File System Access API (Chrome/Edge) or download fallback
- **Auto-save** — every 30s to localStorage while editing
- **Auto-update** — detects new releases on GitHub, in-app update
- **Self-contained** — every file is both the editor and the data
- **Offline-first** — works without internet, no cloud dependency

## How It Works

Each PowerNote file is a standalone HTML application. When you save, your notes are serialized as JSON and embedded inside the HTML file alongside the editor code. Reopen the file to continue editing. Share the file to share your notes — the recipient gets a fully editable copy.

## Development

```bash
npm install
npm run dev          # Dev server at localhost:5173
npm run build:template  # Build standalone HTML
npx playwright test  # Run E2E tests (246 tests across 65 files)
```

## Tech Stack

React 18 + TypeScript + Vite + Konva.js + Zustand

## License

MIT
