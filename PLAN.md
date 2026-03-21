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
- [ ] Undo/redo history stack per page in canvas store
- [ ] Ctrl+Z undo, Ctrl+Shift+Z / Ctrl+Y redo
- [ ] Track: add, delete, move, edit operations
- [ ] History clears on page switch
- [ ] SRS: REQ-CANVAS-007..009
- [ ] E2E tests

### v0.3.1 — A4 Page Guides (visual only)
- [ ] Render dotted A4 page boundary rectangles on canvas background layer
- [ ] Multiple pages tile vertically (infinite scroll of A4 pages)
- [ ] Light gray dotted lines, no snap behavior
- [ ] Toggle visibility from a button or setting
- [ ] SRS: REQ-CANVAS-010..011

### v0.3.2 — Markdown Checkboxes (Task Lists)
- [ ] Support `- [ ]` and `- [x]` syntax in markdown rendering
- [ ] Render as clickable checkboxes in display mode
- [ ] Clicking a checkbox toggles its state in the node's text data
- [ ] SRS: REQ-TEXT-022
- [ ] E2E test

### v0.3.3 — Auto-Width Text Blocks
- [ ] Text blocks grow horizontally to fit content (no fixed 200px)
- [ ] No max-width cap — wraps only on manual Enter
- [ ] Measure rendered markdown HTML width and sync to node
- [ ] Minimum width (e.g. 60px) for empty blocks
- [ ] SRS: REQ-TEXT-020..021
- [ ] E2E tests

### v0.3.4 — Drag Reorder (Hierarchy Panel)
- [ ] Drag sections to reorder in the hierarchy panel
- [ ] Drag pages to reorder within a section
- [ ] Drag pages between sections
- [ ] Visual drag indicator (insertion line)
- [ ] SRS: REQ-HIER-012..014
- [ ] E2E tests

### v0.3.5 — Search (Ctrl+F / Ctrl+Shift+F)
- [ ] Ctrl+F: search bar for current page — highlights matching text blocks
- [ ] Ctrl+Shift+F: notebook-wide search — searches across all sections/pages
- [ ] Results list with page/section context, click to navigate
- [ ] Search input in a floating panel (top-center or sidebar)
- [ ] SRS: REQ-SEARCH-001..005
- [ ] E2E tests

### v0.3.6 — E2E Tests + Polish
- [ ] New E2E tests for all v0.3 features
- [ ] SRS documents updated
- [ ] Full test suite green
- [ ] Git tag v0.3.0

---

## v0.4 — Save/Load + Images (planned)
> Save/load HTML files, image nodes, export

## v0.5 — Drawing + Shapes (planned)
> Freehand drawing, rectangles, arrows

## v0.6 — Cloud Sync (planned)
> Paid tier, multi-device

---

## Current Status

| Iteration | Status |
|-----------|--------|
| v0.1.x | **v0.1.0 tagged** |
| v0.2.x | **v0.2.0 tagged** |
| v0.2.7-v0.2.8 | **Done** |
| v0.3.0 Undo/Redo | **Done** |
| v0.3.1 A4 Page Guides | **Done** |
| v0.3.2 Markdown Checkboxes | **Done** |
| v0.3.3 Auto-Width Text | **Done** |
| v0.3.4 Drag Reorder | **Done** |
| v0.3.5 Search | **Done** |
| v0.3.6 Polish + Tag | **Done** |

---

**Last updated:** 2026-03-21
