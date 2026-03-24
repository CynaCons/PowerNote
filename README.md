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

- **Infinite canvas** — pan, zoom, pinch on touch devices
- **Rich text** — Markdown rendering (headers, bold, italic, lists, tables, code, checkboxes)
- **Images** — paste from clipboard, drag-drop, or file picker
- **Freehand drawing** — pen with color/size options, stroke and zone erasers
- **Shapes** — rectangles, circles, triangles, arrows, lines with fill/stroke/dash styling
- **Hierarchy** — sections and pages like OneNote, drag to reorder
- **Search** — Ctrl+F for current page, Ctrl+Shift+F across notebook
- **Undo/Redo** — per-page history (Ctrl+Z / Ctrl+Shift+Z)
- **Links** — external URLs and internal page links
- **Self-contained** — every file is both the editor and the data
- **Offline-first** — works without internet, no cloud dependency

## How It Works

Each PowerNote file is a standalone HTML application. When you save, your notes are serialized as JSON and embedded inside the HTML file alongside the editor code. Reopen the file to continue editing. Share the file to share your notes — the recipient gets a fully editable copy.

## Development

```bash
npm install
npm run dev          # Dev server at localhost:5173
npm run build:template  # Build standalone HTML
npx playwright test  # Run E2E tests (155 tests)
```

## Tech Stack

React 18 + TypeScript + Vite + Konva.js + Zustand

## License

MIT
