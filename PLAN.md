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
- [x] Git tag v0.1.0

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
- [x] UX assessment and improvements (addressed in v0.2.7 + v0.8.8)
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
- [x] Git tag v0.3.0

---

## v0.4 — Save/Load (Self-Contained HTML)
> Export the entire app + data as a single editable HTML file. Open to restore.

### v0.4.0 — Serialization + Download Button
- [x] Serialize full workspace state (all sections, pages, nodes) to JSON
- [x] Download button in TopBar (right side) + Ctrl+S shortcut
- [x] `<script id="powernote-data" type="application/json">{ ... }</script>`
- [x] File downloads as `<notebook-name>.html`
- [x] Generate HTML file using Vite production bundle (vite-plugin-singlefile)
- [x] Build system: `npm run build:template` produces self-contained 568KB HTML

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
- [x] Zoom to fit (instant jump to bounding box)
- [x] SRS: REQ-CANVAS-012

### v0.5.6 — Settings Panel
- [x] Settings gear icon anchored at bottom of NavRail
- [x] Settings panel popup: toggle A4 page guides on/off
- [x] InfiniteCanvas accepts showPageGuides prop

### v0.5.7 — E2E Tests + Polish + Tag v0.5.0
- [x] E2E test 39: standalone HTML export (file:// round-trip)
- [x] Full test suite green (101 tests)
- [x] Rebuild export template (vite.export.config.ts)
- [x] Git tag v0.5.0

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

## Current Status

| Iteration | Status |
|-----------|--------|
| v0.1.x | **v0.1.0 tagged** — Text on Canvas (Foundation) |
| v0.2.x | **v0.2.0 tagged** — Testing, CRUD, Interaction Overhaul |
| v0.3.x | **v0.3.0 tagged** — Core UX Maturity (undo, search, reorder) |
| v0.4.x | **v0.4.0 tagged** — Save/Load Self-Contained HTML |
| v0.5.x | **v0.5.0 tagged** — Standalone Export, Links, Settings |
| v0.6.x | **v0.6.0 tagged** — Images on Canvas |
| v0.7.x | **v0.7.0 tagged** — Drawing + Eraser Tools |
| v0.8.x | **v0.8.1 tagged** — Shapes, Arrows & Z-Index |
| v0.9.x | **v0.9.1 tagged** — Production Build + GitHub Release |
| v0.10.x | **v0.10 complete** — Production Polish (208 tests, retro-checked) |
| v0.11.x | **v0.11 shipped** — Image Overhaul + Vertex Handles (`badcbfb`, `6395f7c`) |
| v0.12.x | **shipped** — Select Mode, Scroll-to-Pan (`310f4eb`, `be88913`) |
| v0.13.x | **shipped** — Auto-Update + Data Migration (`3119f82`, `72f1875`) |
| v0.14.x | **shipped** — Edit Parity, Find/Replace, Math, Markdown Export (`c61db80`) |
| v0.15.x | **shipped** — Lasso Select + Duplicate (`0287b41`, `1b694ac`) |
| v0.16.0–v0.21.0 | **tagged** — Stabilization, standalone HTML fixes, hot-swap via Blob URL |
| v0.22.0 | **current** — File System Access API direct save (`1ec0237`) |

---

## v0.8 — Shapes, Arrows & Z-Index Layers
> Geometric shapes (rect, circle, triangle, arrow, line) with styling, resize, and z-ordering

### v0.8.0 — Data Model + Shape Tool Button
- [x] ShapeNodeData interface (shapeType, fill, stroke, strokeWidth, strokeDash)
- [x] 'shape' added to ToolType, ShapeOptions in tool store
- [x] Shape tool button in NavRail (Shapes icon, S shortcut)
- [x] `layer` field on CanvasNode (1-5, default 3)

### v0.8.1 — ShapeNode Component
- [x] ShapeNode.tsx renders rect, circle, triangle via Konva primitives
- [x] Standard Group wrapper, click to select, drag to move

### v0.8.2 — Click+Drag Creation
- [x] Mouse down sets origin, drag defines size, mouse up commits
- [x] Shape preview ghost while dragging
- [x] Shift constrains to square/circle
- [x] Nodes sorted by layer for z-ordering

### v0.8.3 — Arrow + Line Shapes
- [x] Arrow with Konva Arrow (arrowhead)
- [x] Line with Konva Line (round lineCap)
- [x] Both stored as shape nodes with signed width/height

### v0.8.4 — ShapeToolbar
- [x] Shape type selector (5 icons)
- [x] Fill toggle + ColorPopover
- [x] Stroke ColorPopover + SizePopover
- [x] Dash style toggle (solid/dashed/dotted)
- [x] Works for tool defaults AND selected shape editing

### v0.8.5 — Resize for Shapes
- [x] SelectionTransformer enabled for shapes
- [x] Free resize (no ratio lock)

### v0.8.6 — 5-Layer Z-Index + Context Menu
- [x] Right-click context menu on any node
- [x] Layer selector (1=Back, 3=Default, 5=Front)
- [x] Copy, Duplicate, Delete actions
- [x] Nodes rendered in layer order

### v0.8.7 — SRS + E2E Tests
- [x] SRS_SHAPES.md (REQ-SHAPE-001..015)
- [x] E2E tests 51-53: shape creation, toolbar, context menu

### v0.8.8 — UX Fixes (9 items)
- [x] Shape click+drag creation fixed (stale closure in handleDrawMouseUp)
- [x] Crosshair cursor removed — normal pointer everywhere
- [x] Hover highlight added to TextNode and ShapeNode
- [x] Arrow/line hit area fixed for signed width/height (bounding box)
- [x] Mode isolation: nodes not draggable/selectable in draw mode
- [x] Z-index: text defaults to layer 4 (above shapes at layer 3)
- [x] Keyboard shortcuts verified (already guarded against input fields)
- [x] Shape toolbar live updates verified (already working)
- [x] E2E tests 54-56: click+drag creation, mode isolation, styling (17 tests)
- [x] All 155 tests pass
- [x] Tag v0.8.1

## v0.9 — Production Build + GitHub Release
> TS fixes, CI/CD, README, automated release pipeline

### v0.9.0 — Build + Release Infrastructure
- [x] Fix all TypeScript compilation errors for clean `tsc -b`
- [x] `npm run build:template` produces 568KB standalone HTML
- [x] GitHub Actions workflow: auto-build + attach PowerNote.html on tag push
- [x] README.md with download link, feature list, dev instructions
- [x] .gitignore updated for build artifacts
- [x] Git tag v0.9.0, published release

### v0.9.1 — Shape Resize Fix
- [x] Wire up SelectionTransformer for shapes (explicit Group dimensions)
- [x] All 155 tests pass
- [x] Git tag v0.9.1, published release

---

## v0.10 — Production Polish
> Auto-save, export quality, code decomposition, test hardening

### v0.10.0 — Auto-Save to localStorage
- [x] Periodic auto-save every 30s to localStorage (commit `63634d1`)
- [x] Restore from localStorage on app start (if no embedded data)
- [x] Clear localStorage after successful file export
- [x] SRS: REQ-FILE-009..011
- [x] E2E tests (test 61: auto-save to localStorage, 4 tests)

### v0.10.1 — In-App Export Uses Production Bundle
- [x] Dev mode: fetch dist-template HTML, inject data, trigger download
- [x] Prod mode (standalone): serialize into self, trigger download
- [x] Ctrl+S always produces a truly standalone HTML file (commits `0ffc268`, `6180991`)
- [x] E2E test: export from dev mode, open as file://, verify content
- [x] SRS: REQ-FILE-012

### v0.10.2 — Decompose InfiniteCanvas.tsx
- [x] Extract shape creation logic → useShapeCreation.ts hook
- [x] Extract text placement logic → useTextPlacement.ts hook
- [x] Extract keyboard shortcuts → useCanvasKeyboard.ts hook
- [x] Extract context menu logic → useContextMenu.ts hook
- [x] Extract drag-drop/paste logic → useCanvasDragDrop.ts hook
- [x] InfiniteCanvas.tsx under 400 lines (350 lines)
- [x] All existing tests still pass (155/155)

### v0.10.3 — Centralized Tool State Machine
- [x] Define explicit tool transitions (select↔text↔draw↔shape↔eraser) (commit `210d670`)
- [x] Guard: what's selectable/draggable per tool mode
- [x] Guard: what canvas clicks do per tool mode
- [x] Remove ad-hoc mode checks scattered through components (`src/utils/toolConfig.ts`)
- [x] E2E tests for mode transitions (test 62: 9 tests)

### v0.10.4 — Test Coverage Hardening
- [x] Add SRS_DRAW.md (REQ-DRAW-001..008 — drawing + eraser requirements)
- [x] Add SRS_SEARCH.md (REQ-SEARCH-001..005 — search requirements)
- [x] Add SRS_SETTINGS.md (REQ-SETTINGS-001..003 — background modes, page guides)
- [x] E2E test 57: undo/redo edge cases (7 tests)
- [x] E2E test 58: advanced markdown rendering — tables, code, blockquotes, nested lists (9 tests)
- [x] E2E test 59: multi-select operations — move, copy-paste, select-all, Ctrl+Click (8 tests)
- [x] E2E test 60: zoom-to-fit button and behavior (5 tests)
- [x] E2E test 61: auto-save to localStorage (4 tests)
- [x] E2E test 62: tool state machine transitions (9 tests)
- [x] E2E test 63: shape resize via Transformer (6 tests)
- [x] E2E test 64: wheel zoom + scale bounds (6 tests)
- [x] All 208 tests green (was 155)

---

## v0.11 — UX Refinement
> Keyboard shortcuts, cursor polish, empty state, tool feedback

### v0.11.0 — Keyboard Shortcut Overlay
- [ ] Press `?` to show a modal listing all shortcuts
- [ ] Grouped by category: navigation, tools, editing, file
- [ ] Dismissable with Escape or click outside
- [ ] SRS: REQ-UI-001

### v0.11.1 — Cursor Improvements
- [ ] Per-tool cursors: crosshair for shape creation, text cursor for text, pen for draw
- [ ] Resize cursors on shape handles (nw-resize, etc.)
- [ ] Grab/grabbing cursor for panning
- [ ] SRS: REQ-UI-002

### v0.11.2 — Empty State Guidance
- [ ] When canvas is empty: show centered hint text ("Click T or press T to add text")
- [ ] When hierarchy is empty: show "Create a section" prompt
- [ ] Hints disappear once first element is added
- [ ] SRS: REQ-UI-003

### v0.11.3 — Zoom Controls (visual)
- [ ] Zoom percentage display in TopBar or bottom-right corner
- [ ] Zoom in/out buttons (+/- icons)
- [ ] Scroll to zoom indicator on first use

### v0.11.4 — Pinch-to-Zoom (Touch)
- [ ] Multi-touch pinch zoom on canvas
- [ ] Two-finger pan
- [ ] Touch-friendly selection (long-press = select)
- [ ] SRS: REQ-CANVAS-013..015
- [ ] E2E tests, tag v0.11.0

---

## v0.12 — File Management
> Open files, recent files, file system integration (shipped as part of v0.22.0 FSA work)

### v0.12.0 — Open Existing PowerNote Files
- [x] Drag-drop `.html` file onto the app to open it
- [x] File picker button ("Open" in TopBar or File menu) (commit `1ec0237`)
- [x] Uses File System Access API in supported browsers
- [x] Falls back to `<input type="file">` in others
- [x] Warns if current notebook has unsaved changes
- [x] SRS: REQ-FILE-013..015 (to be added in SRS_FILE.md FSA section)

### v0.12.1 — Recent Files List
- [x] Store recent file handles in IndexedDB (5-handle LRU cap)
- [x] `clearAllRecentHandles()` API available
- [x] SRS: REQ-FILE-016..017

### v0.12.2 — Save-in-Place (File System Access API)
- [x] `showSaveFilePicker()` direct save when supported (Chrome/Edge)
- [x] Fallback: `<a download>` in unsupported browsers
- [x] SRS: REQ-FILE-018

### v0.12.3 — E2E Tests + Tag v0.12.0
- [x] Tests for open, recent, save-in-place (tests 79, 80)
- [x] Shipped as part of v0.22.0 (tagged 2026-04-11)

---

## v0.13 — Advanced Text
> Heading sizes, link navigation, find-and-replace

### v0.13.0 — Visual Heading Sizes
- [ ] `# H1` renders at 28px, `## H2` at 22px, `### H3` at 18px on canvas
- [ ] Heading size affects text block auto-width
- [ ] Bold/italic rendering matches markdown spec
- [ ] SRS: REQ-TEXT-023..025

### v0.13.1 — Clickable Links on Canvas
- [x] External links clickable in rendered markdown (commit `def02e8`)
- [x] Internal page links navigate to linked page
- [x] SRS: REQ-TEXT-026..028

### v0.13.2 — Find and Replace
- [x] Ctrl+F opens search panel, replace mode toggle (commit `c61db80`)
- [x] Search across current page text nodes + notebook-wide
- [x] Replace all
- [x] Highlight matches in real-time
- [x] SRS: REQ-SEARCH-006..008 (to be added in SRS_SEARCH.md)
- [x] E2E test 76: find-and-replace

---

## v0.14 — Export & Sharing
> PDF export, image export, print support

### v0.14.0 — PDF Export
- [ ] Export current page as PDF (via browser print API or html2canvas + jsPDF)
- [ ] A4 page boundaries guide the page breaks
- [ ] Include all visible elements: text, images, shapes, drawings
- [ ] SRS: REQ-EXPORT-001..003

### v0.14.1 — Image Export (PNG/SVG)
- [ ] Export current page as PNG (Konva Stage toDataURL)
- [ ] Optional: SVG export for vector quality
- [ ] Configurable resolution/scale
- [ ] SRS: REQ-EXPORT-004..005

### v0.14.2 — Print Support
- [ ] Ctrl+P triggers browser print with proper styling
- [ ] Print CSS: hide nav rail, toolbar, hierarchy panel
- [ ] Content laid out for A4 pages
- [ ] SRS: REQ-EXPORT-006
- [ ] E2E tests, tag v0.14.0

## v0.15 — Advanced Image Tools (shipped in v0.11.0, commit `badcbfb`)
> Full image editing toolbar: import, crop (slider-based), 90° rotate, lossless resize, multi-import. Three items not yet shipped — tracked in Planned section at bottom.

### v0.15.0 — Image Toolbar (Bottom Bar)
- [x] Clicking image tool in NavRail opens ImageToolbar in bottom bar
- [x] Import/Open file button (multi-select enabled)
- [x] Toolbar adapts: import-mode when no image selected, edit-mode when image selected
- [x] SRS: REQ-IMAGE-004..006 (see SRS_IMAGE.md)

### v0.15.1 — Image Crop (slider-based, non-destructive)
- [x] Crop sliders in toolbar when image is selected
- [x] Non-destructive: stores normalized crop rect in `ImageNodeData.crop`, original untouched
- [x] Reset button restores original
- [x] SRS: REQ-IMAGE-008..009 (SHIPPED)
- [ ] REQ-IMAGE-007 Visual crop overlay with drag handles — **NOT SHIPPED** (slider-based only; tracked in Planned section)

### v0.15.2 — Image Rotate
- [x] 90° CW/CCW rotate buttons in toolbar
- [x] Rotation stored in node data, applied via Konva Group rotation
- [x] SRS: REQ-IMAGE-010 (SHIPPED)
- [ ] REQ-IMAGE-011 Free rotation via drag handle — **NOT SHIPPED** (tracked in Planned section)

### v0.15.3 — Lossless Image Resize
- [x] Resize handles on selected image (SelectionTransformer)
- [x] Aspect ratio always maintained (currently no Shift-override)
- [x] Original `naturalWidth/naturalHeight` stored, display-only scaling
- [x] SRS: REQ-IMAGE-012..013 (SHIPPED)
- [ ] Shift-key free-resize override — **NOT SHIPPED** (tracked in Planned section)

### v0.15.4 — Multi-Image Import
- [x] File picker accepts multiple files at once
- [x] Drag-drop multiple files from OS file explorer
- [x] SRS: REQ-IMAGE-014, REQ-IMAGE-016 (SHIPPED)
- [ ] REQ-IMAGE-015 Grid layout — **NOT SHIPPED** (currently linear Y-stagger; tracked in Planned section)

### v0.15.5 — E2E Tests + Tag v0.15.0
- [x] SRS_IMAGE.md added with 16 requirements (commit `c0abb27`)
- [ ] E2E tests for toolbar, crop, rotate, multi-import — **MISSING** (tracked in Test Coverage Gaps section)

---

### v0.10.2b — Arrow/Line Vertex Handles
- [x] Custom two-vertex handles for arrows and lines (commit `6395f7c`)
- [x] Disable standard rectangle Transformer for arrow/line shapes
- [x] Dragging a vertex updates position/direction independently
- [x] Live redraw while dragging vertex handles (commit `dd5c0ef`)
- [x] Arrow/line hover highlights the line itself, not bounding box (commit `545e7fd`)
- [x] Fix bold/italic toolbar not applying to selected text (commit `e8b38e7`)
- [ ] Dedicated E2E test for vertex handle interactions — tracked in Test Coverage Gaps

---

## v0.16–v0.22 — Retro (Shipped Beyond Original Plan)
> These iterations shipped between 2026-04-07 and 2026-04-11 but were not in the original v0.10-era plan. Documented here retro for traceability. All items `[x]` since the commits exist on `main` and tags are pushed.

### v0.16.0 — Auto-Update + Data Migration
- [x] Auto-update check against GitHub Releases (commit `3119f82`)
- [x] Data migration hooks for notebook version bumps
- [x] Versioned filenames on export
- [x] Robust update with 3 download strategies (commit `72f1875`)
- [x] CORS-safe GitHub API asset endpoint (commit `4c27c6b`)
- [x] Better error message for rate-limited update check (commit `524648b`)
- [x] Bump APP_VERSION to 0.17.3 (commit `7edd1bc`)

### v0.17.0 — Select Mode + Scroll Navigation
- [x] Dedicated Select Mode with toolbar persistence (commit `310f4eb`)
- [x] Scroll to pan canvas, shift+scroll for horizontal pan (commit `be88913`)
- [x] Toolbar buttons unhighlight in select mode (commit `a56d012`)
- [x] Shape type buttons switch to creation mode, never convert selected shape (commit `5248c41`)

### v0.18.0 — Edit Parity Batch (commit `c61db80`)
- [x] Find/replace panel and notebook-wide scope
- [x] Math/LaTeX rendering via KaTeX (inline `$...$` and display `$$...$$`)
- [x] Markdown export
- [x] Library (reusable snippets)
- [x] Tab robustness (nested list indent verified)
- [x] 53 new E2E tests + 3 SRS docs (commit `6c5d1ba`, 208 → was 155 tests)

### v0.19.0 — Lasso Select + Duplicate
- [x] Lasso selects nodes (text/shapes/images) (commit `0287b41`)
- [x] Verified nested list indent behavior
- [x] Ctrl+Alt+drag duplicates nodes (commit `1b694ac`)
- [x] Clickable checkboxes in rendered markdown (commit `def02e8`)

### v0.20.0 — Standalone HTML Stabilization
- [x] Standalone HTML works: escape `<script>` in minified JS bundle (commit `0ffc268`)
- [x] Update downloads files instead of hot-swap (commit `6180991`)
- [x] Hot-swap uses Blob URL instead of `document.write()` (commit `0ecb2d6`)

### v0.22.0 — File System Access API
- [x] Save notebooks directly to disk via `showSaveFilePicker()` (commit `1ec0237`)
- [x] IndexedDB persistence of `FileSystemFileHandle` objects
- [x] "Save As" button visibility conditional on FSA support
- [x] Recent handles LRU-capped at 5
- [x] Graceful fallback when FSA unavailable (Firefox/Safari)
- [x] E2E tests 79 (fsa-capability), 80 (fsa-handle-store)
- [x] Remove test output logs and gitignore them (commit `7b5b367`)

### v0.22.3 — Revert to Last Saved (current)
> Standard revert flow: discard unsaved in-memory changes and reload the current file from disk via the FSA handle. Matches Word/VS Code/Google Docs behavior.
- [ ] `src/utils/revertNotebook.ts` — confirm-and-reload helper that re-reads the FSA handle, hydrates stores, marks clean
- [ ] `TopBar.tsx` — revert button (RotateCcw icon), disabled unless `isDirty && FSA handle available`
- [ ] `docs/SRS_FILE.md` — REQ-FILE-019 (revert semantics), REQ-FILE-020 (enablement gating)
- [ ] E2E test 82 (`tests/file/82-revert.spec.ts`)
- [ ] Smoke + Playwright run

### v0.22.2 — Draw Over Images (Strokes on Top)
> Swap Konva layer order so freehand strokes always render above images/text/shapes. Unblocks annotating screenshots.
- [ ] `InfiniteCanvas.tsx`: reorder layers → guides, nodes, drawings, selection-transformer
- [ ] `docs/SRS_DRAW.md`: add REQ-DRAW-009 (stroke z-order above nodes) → T81
- [ ] E2E test 81 (`tests/draw/81-stroke-above-image.spec.ts`) — stroke renders above an image at the same coordinates
- [ ] Smoke + Playwright run

### v0.22.1 — Faster Autosave + Drop localStorage Snapshot
> Replace 30s interval with 1.5s debounce + 5s max-wait. Remove `powernote-autosave` localStorage key now that FSA handle writes the live file. Keep notebook library and IDB handle store untouched.
- [ ] Rewrite `startAutoSave` in `src/utils/serialization.ts` — debounce 1.5s, max-wait 5s, driven by workspace store subscription
- [ ] Remove `autoSaveToLocalStorage` / `loadFromLocalStorage` / `clearAutoSave` APIs
- [ ] `main.tsx`: drop localStorage-fallback hydration; add one-shot migration that removes any legacy `powernote-autosave` key
- [ ] `saveNotebook.ts`: drop `clearAutoSave` calls
- [ ] `docs/SRS_FILE.md`: update REQ-FILE-015 (new cadence, no localStorage snapshot) and REQ-FILE-016 (remove — hot-restore comes from FSA handle)
- [ ] Rewrite `tests/file/61-auto-save.spec.ts` to verify debounced behavior + absence of legacy key
- [ ] Smoke test + full Playwright run

---

## Planned (Not Yet Shipped)
> Features specified in SRS or earlier iterations that have not yet shipped. Moving here so PLAN.md reflects reality.

### Image Tools (advanced)
- [ ] REQ-IMAGE-007 Visual crop overlay with drag handles (currently toolbar sliders only)
- [ ] REQ-IMAGE-011 Free rotation via drag handle (currently 90° increments only)
- [ ] REQ-IMAGE-012 Shift-key free-resize override (currently aspect ratio always locked)
- [ ] REQ-IMAGE-015 Grid layout for multi-image paste (currently linear Y-stagger)

### UX Refinement (from v0.11 plan)
- [ ] Keyboard shortcut overlay (press `?`)
- [ ] Empty state guidance on blank canvas / hierarchy
- [ ] Zoom percentage display + zoom in/out buttons
- [ ] Full pinch-to-zoom on touch devices (multi-touch, two-finger pan)

### Export & Sharing (from v0.14 plan)
- [ ] PDF export (via print API or html2canvas + jsPDF)
- [ ] PNG / SVG image export
- [ ] Print support (Ctrl+P with print CSS)

### Advanced Text (from v0.13 plan)
- [ ] Explicit heading sizes on canvas (`# H1` 28px, `## H2` 22px, `### H3` 18px)

---

## Test Coverage Gaps (tracked)
> Shipped features that lack dedicated E2E test coverage. No blocker for shipping, but should be backfilled.

- [ ] Two-vertex arrow/line handles — shipped v0.11 (`6395f7c`, `dd5c0ef`), no dedicated drag test
- [ ] Image toolbar visibility & context switching — REQ-IMAGE-004..006
- [ ] Non-destructive crop (toolbar sliders) — REQ-IMAGE-008..009
- [ ] 90° rotate buttons — REQ-IMAGE-010
- [ ] Aspect-ratio resize + lossless scaling — REQ-IMAGE-012..013
- [ ] Multi-file import via picker — REQ-IMAGE-014
- [ ] Drag-drop multi-file from OS — REQ-IMAGE-016
- [ ] Ctrl+Alt+drag duplicate (shipped `1b694ac`, no test)
- [ ] Select mode toolbar persistence (shipped `310f4eb`, `a56d012`)
- [ ] Scroll-to-pan + shift+scroll horizontal pan (shipped `be88913`)
- [ ] Auto-update check against GitHub (shipped `3119f82`, `72f1875` has E2E)

---

## Future (Backlog)
> Not yet planned — will be prioritized when earlier iterations are complete. Paid tier moved to `docs/VISION.md`.

- **Collapsible Containers** — Canvas-in-canvas grouping (deferred from v0.2)
- **Template Gallery** — Pre-built page templates (meeting notes, project plan, etc.)
- **Advanced Diagram Tools** — Connectors, flowcharts, mind maps
- **Mobile App** — React Native or PWA for tablet/phone
- **Plugin System** — Community extensions
- **Database/Table Blocks** — Notion-style structured data on canvas

See `docs/VISION.md` for deferred post-MVP items (cloud sync, collaboration, paid tier) that depend on cloud deployment infrastructure.

---

**Last updated:** 2026-04-23
