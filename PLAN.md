# PowerNote — Implementation Plan

**Goal:** Ship a working MVP where a user can open the app, create a page, place text on an infinite canvas, organize notes hierarchically, and edit visually.

**Philosophy:** Simplicity > completeness. Speed > features. Ship fast.

**Canvas Engine:** Konva.js (react-konva) — MIT license, 60KB, total UI control
**Stack:** React 18 + TypeScript + Vite + Zustand

---

## v0.1 — Text on Canvas (Foundation)
> First usable version: app shell, infinite canvas, text blocks, hierarchy

### v0.1.0 — Project Scaffold + App Shell
- [x] Initialize Vite React-TS project
- [x] Install deps: konva, react-konva, react-konva-utils, zustand, nanoid, lucide-react
- [x] Create folder structure (types, stores, components/*, utils)
- [x] Define TypeScript types in `src/types/data.ts`
- [x] `AppShell.tsx` — CSS Grid layout (48px nav rail | top bar 40px | canvas area)
- [x] `NavRail.tsx` — 3 icon buttons: hierarchy (top), text tool, draw tool (disabled)
- [x] `TopBar.tsx` — static breadcrumb placeholder
- [x] Canvas area: empty div with background
- [x] Smoke test: `npm run dev` launches clean

### v0.1.1 — Zustand Stores + Default Data
- [x] `useWorkspaceStore.ts` — workspace state, CRUD, active selection
- [x] `useToolStore.ts` — activeTool, setTool, textOptions
- [x] `useCanvasStore.ts` — nodes array, viewport, CRUD, loadPageNodes
- [x] `utils/defaults.ts` — factory functions
- [x] `utils/ids.ts` — nanoid wrapper
- [x] Wire TopBar to workspace store (live breadcrumb)
- [x] Wire NavRail to tool store (active tool highlighting)
- [x] Page-switch node sync logic
- [x] Smoke test: stores hydrate, UI wired

### v0.1.2 — Infinite Canvas with Pan/Zoom
- [x] `InfiniteCanvas.tsx` — Stage fills canvas area (ResizeObserver)
- [x] Pan via Stage `draggable={true}`
- [x] Zoom via `onWheel` with Ctrl modifier, pointer-relative math
- [x] Clamp scale [0.1, 5.0]
- [x] Store viewport state in useCanvasStore
- [x] Auto-resize on window resize
- [x] Smoke test: pan/zoom smooth

### v0.1.3 — Text Tool: Place + Display
- [x] Click-to-place handler (screen→stage coordinate transform)
- [x] `CanvasNode.tsx` — dispatcher component
- [x] `TextNode.tsx` — Konva `<Text>`, draggable, position syncs to store
- [x] Cursor changes per active tool
- [x] Smoke test: place + drag text blocks

### v0.1.4 — Inline Text Editing (HTML Overlay)
- [x] `TextEditor.tsx` — `<Html>` portal textarea, styled to match
- [x] Position accounts for scale + pan offset
- [x] Double-click → edit mode
- [x] Enter to commit, Escape to cancel, blur to commit
- [x] Auto-enter edit on new text placement
- [x] Textarea auto-height
- [x] Smoke test: edit inline, works at different zoom levels

### v0.1.5 — Selection + Resize (Transformer)
- [x] `SelectionTransformer.tsx` — Konva Transformer
- [x] selectedNodeId in canvas store
- [x] Click node → select, background → deselect
- [x] Resize via handles, update store
- [x] Text reflows on width change
- [x] Minimum size constraints
- [x] Smoke test: select, resize, deselect

### v0.1.6 — Hierarchy Panel
- [x] `HierarchyPanel.tsx` — overlay panel (~240px), toggle from NavRail
- [x] `SectionItem.tsx` — expand/collapse
- [x] `PageItem.tsx` — click to navigate, active highlighted
- [x] Add Section / Add Page buttons
- [x] Page navigation triggers node sync
- [x] TopBar breadcrumb updates dynamically
- [x] Smoke test: create sections/pages, navigate, content persists

### v0.1.7 — Bottom Toolbar (Text Options)
- [x] `BottomToolbar.tsx` — shows when text tool active OR text node selected
- [x] `TextToolbar.tsx` — font size, bold, italic, color
- [x] Two modes: tool defaults (new text) OR selected node (existing text)
- [x] Floating bar styling
- [x] Smoke test: change properties, real-time canvas update

### v0.1.8 — Polish + Stabilization
- [x] Delete node with Delete/Backspace
- [x] Escape to deselect / exit editing
- [x] T shortcut for text tool
- [x] Guard: always >= 1 section and page (in workspace store)
- [x] Full end-to-end smoke test
- [ ] Git tag v0.1.0

---

## v0.2 — Testing, CRUD, Containers
> ASPICE-like SRS + Playwright E2E, hierarchy CRUD, text fixes, collapsible containers

### v0.2.0 — Testing Infrastructure
- [x] Install Playwright, create config + test directories
- [x] Test helpers + store exposure for dev mode
- [x] Add data-testid attributes to key DOM elements
- [x] Smoke test: `npx playwright test` passes

### v0.2.1 — SRS Documents + Baseline E2E Tests
- [x] SRS_CANVAS.md (REQ-CANVAS-001..006)
- [x] SRS_TEXT.md (REQ-TEXT-001..010)
- [x] SRS_HIERARCHY.md (REQ-HIER-001..011)
- [x] SRS_TOOLBAR.md (REQ-TOOL-001..006)
- [x] E2E tests 00-11 covering all v0.1 features (36 tests, all green)
- [x] All tests pass

### v0.2.2 — Hierarchy CRUD UI
- [x] Section rename (dblclick) + delete (hover icon)
- [x] Page rename (hover pencil) + delete (hover X)
- [x] Wire existing store actions through UI
- [x] Guards: can't delete last section/page

### v0.2.3 — Text Interaction Fixes
- [x] Fix height reflow bug in SelectionTransformer
- [x] Add selection visual highlight (background Rect)
- [x] Remove duplicate width from TextNodeData

### v0.2.4 — Collapsible Containers
- [x] Data model: ContainerNodeData, parentContainerId, union type
- [x] ContainerNode.tsx component (collapse/expand, title edit)
- [x] Container drag moves children, auto-parent on drop
- [x] NavRail container tool (C shortcut)

### v0.2.5 — E2E Tests for v0.2 Features
- [x] SRS_CONTAINERS.md (REQ-CONT-001..008)
- [x] E2E tests 12-20 covering CRUD + containers
- [x] All 62 tests pass

### v0.2.6 — Polish + Tag v0.2.0
- [x] Full test suite green (62 tests)
- [x] Version bump to 0.2.0
- [x] Git tag v0.2.0

### v0.2.7 — Interaction Overhaul (user feedback)
- [x] Fix drag teleportation bug (Group coordinate doubling)
- [x] Remove container feature (deferred to later)
- [x] One-shot text tool (reverts to select after placing)
- [x] Click = select, double-click = edit
- [x] Multi-select with Ctrl+Click
- [x] Copy-paste (Ctrl+C/V), select all (Ctrl+A)
- [x] Selection actions panel (top-right: count, copy, duplicate, delete)
- [x] Rich text editor (Tab indent, auto-continue bullets/numbered lists)
- [x] Markdown rendering (Jupyter-style: headers, bold, italic, code, lists, blockquotes)
- [x] Snap alignment guides (Shift+drag, red dashed lines at edge/center alignment)
- [x] Remove text resize handles (OneNote-style, auto-size to content)
- [x] Auto-enter edit mode on new text placement
- [x] CLAUDE.md created with project instructions
- [x] 52 tests pass

### v0.2.8 — UX Hardening (user feedback)
- [x] Fix: text tool strictly one-shot, no accidental text creation on canvas clicks
- [ ] UX assessment and improvements
- [x] Fix: double-click on text must immediately focus textarea for typing

---

## v0.3 — Core UX Maturity
> Undo/redo, A4 page guides, auto-width text, drag reorder, search

### v0.3.0 — Undo/Redo (per-page)
- [x] Undo/redo history stack per page in canvas store
- [x] Ctrl+Z undo, Ctrl+Shift+Z / Ctrl+Y redo
- [x] Track: add, delete, move, edit operations
- [x] History clears on page switch
- [x] SRS: REQ-CANVAS-007..009
- [x] E2E tests

### v0.3.1 — A4 Page Guides (visual only)
- [x] Render dotted A4 page boundary rectangles on canvas background layer
- [x] Multiple pages tile vertically (infinite scroll of A4 pages)
- [x] Light gray dotted lines, no snap behavior
- [x] Toggle visibility from a button or setting
- [x] SRS: REQ-CANVAS-010..011

### v0.3.2 — Markdown Checkboxes (Task Lists)
- [x] Support `- [ ]` and `- [x]` syntax in markdown rendering
- [x] Render as clickable checkboxes in display mode
- [x] Clicking a checkbox toggles its state in the node's text data
- [x] SRS: REQ-TEXT-022
- [x] E2E test

### v0.3.3 — Auto-Width Text Blocks
- [x] Text blocks grow horizontally to fit content (no fixed 200px)
- [x] No max-width cap — wraps only on manual Enter
- [x] Measure rendered markdown HTML width and sync to node
- [x] Minimum width (e.g. 60px) for empty blocks
- [x] SRS: REQ-TEXT-020..021
- [x] E2E tests

### v0.3.4 — Drag Reorder (Hierarchy Panel)
- [x] Drag sections to reorder in the hierarchy panel
- [x] Drag pages to reorder within a section
- [x] Drag pages between sections
- [x] Visual drag indicator (insertion line)
- [x] SRS: REQ-HIER-012..014
- [x] E2E tests

### v0.3.5 — Search (Ctrl+F / Ctrl+Shift+F)
- [x] Ctrl+F: search bar for current page — highlights matching text blocks
- [x] Ctrl+Shift+F: notebook-wide search — searches across all sections/pages
- [x] Results list with page/section context, click to navigate
- [x] Search input in a floating panel (top-center or sidebar)
- [x] SRS: REQ-SEARCH-001..005
- [x] E2E tests

### v0.3.6 — E2E Tests + Polish
- [x] New E2E tests for all v0.3 features (tests 22-33, 39 tests, all green)
- [x] SRS documents updated
- [x] Full test suite green
- [ ] Git tag v0.3.0

---

## v0.4 — Save/Load (Self-Contained HTML)
> Export the entire app + data as a single editable HTML file. Open to restore.

### v0.4.0 — Serialization + Download Button
- [x] Serialize full workspace state (all sections, pages, nodes) to JSON
- [x] Download button in TopBar (right side) + Ctrl+S shortcut
- [x] `<script id="powernote-data" type="application/json">{ ... }</script>`
- [x] File downloads as `<notebook-name>.html`
- [ ] Generate HTML file using Vite production bundle (not dev server HTML)
- [ ] Build system: `vite build` produces self-contained app, export injects data

### v0.4.1 — Load / Hydrate from HTML
- [x] On app start, check for embedded `#powernote-data` script tag
- [x] If found, parse JSON and hydrate workspace store
- [x] If not found, start with default empty workspace
- [x] "Open" button in TopBar to import an existing .html file
- [x] File input reads HTML, extracts JSON from the script tag, hydrates

### v0.4.2 — Round-Trip Testing
- [x] E2E test: fill real content (multi-section, multi-page, markdown, checkboxes)
- [x] Export to HTML file
- [x] Open exported HTML in a new Playwright page (dev server re-hydration)
- [x] Verify all content matches (sections, pages, node positions, text)
- [x] 4-cycle workflow persistence test (EV motor control report)
- [x] SRS: REQ-FILE-001..006

### v0.4.3 — Polish + Tag v0.4.0
- [x] Edge cases handled
- [x] Error handling for corrupt/invalid HTML files
- [x] Full test suite green (94 tests)
- [x] Git tag v0.4.0

---

## v0.5 — Standalone Export + Editor Polish
> Production-bundled HTML export, auto-save, links, toast, settings

### v0.5.0 — Standalone HTML Export (Production Bundle)
- [x] `vite build` produces single-file HTML (all JS/CSS inlined) via vite-plugin-singlefile
- [x] Vite export config: IIFE-safe, favicon inlined, script moved after root div
- [x] Export function: fetch built HTML template in dev, use outerHTML in prod
- [x] Exported file opens standalone in any browser via file:// (no server needed)
- [x] E2E test 39: export → open as `file://` → verify content → re-export
- [x] SRS: REQ-FILE-007..008

### v0.5.1 — Auto-Save + Dirty Indicator
- [x] Track dirty state: isDirty flag in workspace store, set on any mutation
- [x] Visual dirty indicator in TopBar (asterisk " *" next to filename)
- [x] Dirty flag resets after save
- [x] Warn on browser close if unsaved changes (beforeunload)

### v0.5.2 — Toast Notifications
- [x] Lightweight Toast component (bottom-right, fixed position)
- [x] Show toast on: save success, save error, file opened, file invalid
- [x] Auto-dismiss after 3 seconds
- [x] No external dependency (custom component, showToast() function)

### v0.5.3 — Links (Internal + External)
- [x] External links: markdown `[text](url)` rendered as clickable `<a>` tags
- [x] Internal page links: right-click on text block → "Insert Link to Page"
- [x] Page picker dropdown showing all sections/pages
- [x] Link format: `[Page Title](powernote://section-id/page-id)`
- [x] Clicking internal link navigates to that page (saves current, loads target)
- [x] Visual distinction: external=blue, internal=purple dashed underline

### v0.5.4 — Notebook Filename Rename
- [x] Editable notebook name in TopBar (click to edit, Enter to confirm)
- [x] Default: "Untitled Notebook"
- [x] Filename used as download filename: `<notebook-name>.html`
- [x] Stored in workspace state, persisted in export

### v0.5.5 — Zoom to Fit
- [x] Maximize button in TopBar
- [x] Calculate bounding box of all nodes on current page
- [ ] Animate camera to fit all content with padding
- [ ] SRS: REQ-CANVAS-012

### v0.5.6 — Settings Panel
- [x] Settings gear icon anchored at bottom of NavRail
- [x] Settings panel popup: toggle A4 page guides on/off
- [x] InfiniteCanvas accepts showPageGuides prop

### v0.5.7 — E2E Tests + Polish + Tag v0.5.0
- [x] E2E test 39: standalone HTML export (file:// round-trip)
- [x] Full test suite green (101 tests)
- [ ] Rebuild export template
- [ ] Git tag v0.5.0

---

## v0.6 — Images on Canvas
> Image nodes: paste, drag-drop, file picker, resize, base64 in export

### v0.6.0 — Image Data Model + Component
- [x] ImageNodeData type (src, alt, naturalWidth, naturalHeight)
- [x] NodeData union type (TextNodeData | ImageNodeData)
- [x] ImageNode.tsx — renders base64 image on Konva canvas
- [x] CanvasNode dispatcher routes image type

### v0.6.1 — Clipboard Paste (Ctrl+V)
- [x] Paste handler detects image items from clipboard
- [x] Converts to base64 data URI, places at canvas center

### v0.6.2 — Drag-Drop Files
- [x] dragover/drop handlers on canvas container
- [x] Converts drop position to canvas coordinates
- [x] Auto-scales images to max 600px width

### v0.6.3 — Image Tool in NavRail
- [x] Image icon button in NavRail (between text and draw)
- [x] Hidden file input with accept="image/*"
- [x] File picker opens on click, adds image to canvas

### v0.6.4 — Image Resize
- [x] SelectionTransformer enables resize handles for image nodes
- [x] Keep aspect ratio on resize
- [x] Transform end updates node dimensions in store

### v0.6.5 — Base64 in HTML Export
- [x] Images are base64 data URIs — automatically embedded in export
- [x] E2E test verifies image data survives save/load round-trip

### v0.6.6 — E2E Tests + Tag v0.6.0
- [x] Test 40: image add, select, save/load round-trip (3 tests)
- [x] Full test suite green (104 tests)
- [x] Git tag v0.6.0

---

## v0.7 — Drawing + Shapes (planned)
> Freehand drawing, rectangles, arrows, basic shape tools

## v0.8 — Cloud Sync (planned)
> Paid tier, multi-device sync

---

## Current Status

| Iteration | Status |
|-----------|--------|
| v0.1.x | **v0.1.0 tagged** |
| v0.2.x | **v0.2.0 tagged** |
| v0.3.x | **v0.3.0 tagged** |
| v0.4.x | **v0.4.0 tagged** |
| v0.5.x | **v0.5.0 tagged** |
| v0.6.x | **v0.6.0 tagged** |

---

**Last updated:** 2026-03-21
