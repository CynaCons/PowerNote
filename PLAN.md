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
| v0.10.x | **In progress** — Production Polish (208 tests) |

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
- [ ] Periodic auto-save every 30s to localStorage
- [ ] Restore from localStorage on app start (if no embedded data)
- [ ] Clear localStorage after successful file export
- [ ] SRS: REQ-FILE-009..011
- [ ] E2E tests

### v0.10.1 — In-App Export Uses Production Bundle
- [ ] Dev mode: fetch dist-template HTML, inject data, trigger download
- [ ] Prod mode (standalone): serialize into self, trigger download
- [ ] Ctrl+S always produces a truly standalone HTML file
- [ ] E2E test: export from dev mode, open as file://, verify content
- [ ] SRS: REQ-FILE-012

### v0.10.2 — Decompose InfiniteCanvas.tsx
- [x] Extract shape creation logic → useShapeCreation.ts hook
- [x] Extract text placement logic → useTextPlacement.ts hook
- [x] Extract keyboard shortcuts → useCanvasKeyboard.ts hook
- [x] Extract context menu logic → useContextMenu.ts hook
- [x] Extract drag-drop/paste logic → useCanvasDragDrop.ts hook
- [x] InfiniteCanvas.tsx under 400 lines (350 lines)
- [x] All existing tests still pass (155/155)

### v0.10.3 — Centralized Tool State Machine
- [ ] Define explicit tool transitions (select↔text↔draw↔shape↔eraser)
- [ ] Guard: what's selectable/draggable per tool mode
- [ ] Guard: what canvas clicks do per tool mode
- [ ] Remove ad-hoc mode checks scattered through components
- [ ] E2E tests for mode transitions

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
> Open files, recent files, file system integration

### v0.12.0 — Open Existing PowerNote Files
- [ ] Drag-drop `.html` file onto the app to open it
- [ ] File picker button ("Open" in TopBar or File menu)
- [ ] Uses File System Access API in supported browsers
- [ ] Falls back to `<input type="file">` in others
- [ ] Warns if current notebook has unsaved changes
- [ ] SRS: REQ-FILE-013..015

### v0.12.1 — Recent Files List
- [ ] Store recent file names + last-opened timestamp in localStorage
- [ ] "Recent" section in a welcome screen or File menu
- [ ] Click recent entry → file picker pre-filtered (user must re-select due to browser security)
- [ ] Clear recent files option
- [ ] SRS: REQ-FILE-016..017

### v0.12.2 — Save-in-Place (File System Access API)
- [ ] If browser supports `showSaveFilePicker()`: save directly to same path
- [ ] No re-download needed — true Ctrl+S save behavior
- [ ] Fallback: download as before in unsupported browsers
- [ ] SRS: REQ-FILE-018

### v0.12.3 — E2E Tests + Tag v0.12.0
- [ ] Tests for open, recent, save-in-place
- [ ] All tests green, tag v0.12.0

---

## v0.13 — Advanced Text
> Heading sizes, link navigation, find-and-replace

### v0.13.0 — Visual Heading Sizes
- [ ] `# H1` renders at 28px, `## H2` at 22px, `### H3` at 18px on canvas
- [ ] Heading size affects text block auto-width
- [ ] Bold/italic rendering matches markdown spec
- [ ] SRS: REQ-TEXT-023..025

### v0.13.1 — Clickable Links on Canvas
- [ ] External links: Ctrl+Click or single-click opens in new tab
- [ ] Internal page links: click navigates to linked page
- [ ] Link hover: tooltip showing destination
- [ ] SRS: REQ-TEXT-026..028

### v0.13.2 — Find and Replace
- [ ] Ctrl+H opens find-and-replace panel
- [ ] Search across current page text nodes
- [ ] Replace one / replace all
- [ ] Highlight matches in real-time
- [ ] SRS: REQ-SEARCH-006..008
- [ ] E2E tests, tag v0.13.0

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

## v0.15 — Advanced Image Tools
> Full image editing toolbar: import, crop, rotate, lossless resize

### v0.15.0 — Image Toolbar (Bottom Bar)
- [ ] Clicking image tool in NavRail opens ImageToolbar in bottom bar
- [ ] Import/Open file button with file icon (opens file picker, accepts multiple)
- [ ] Toolbar adapts: import-mode when no image selected, edit-mode when image selected
- [ ] SRS: REQ-IMAGE-001..003

### v0.15.1 — Image Crop (PowerPoint-style)
- [ ] Crop mode: click "Crop" button in toolbar when image is selected
- [ ] Dark overlay shows cropped-out area, drag handles adjust crop region
- [ ] Confirm crops the image (updates base64 src with cropped data)
- [ ] Cancel restores original
- [ ] Non-destructive: store original src + crop rect, re-crop anytime
- [ ] SRS: REQ-IMAGE-004..007
- [ ] E2E tests

### v0.15.2 — Image Rotate
- [ ] Rotate button in toolbar (90° CW/CCW increments)
- [ ] Free rotation via drag handle (like shapes)
- [ ] Rotation stored in node data, applied via CSS transform on Konva Image
- [ ] SRS: REQ-IMAGE-008..009

### v0.15.3 — Lossless Image Resize
- [ ] Resize handles on selected image (already works via SelectionTransformer)
- [ ] Maintain aspect ratio by default (Shift to free-resize)
- [ ] Store original naturalWidth/Height, render at display size
- [ ] No re-encoding on resize — only display scale changes
- [ ] Zoom into image shows full resolution (no pixelation until past original size)
- [ ] SRS: REQ-IMAGE-010..012

### v0.15.4 — Multi-Image Import
- [ ] File picker accepts multiple files at once
- [ ] Images placed in a grid layout on canvas (auto-arranged, no overlap)
- [ ] Drag-drop multiple files from OS file explorer
- [ ] Paste multiple images from clipboard (if supported)
- [ ] SRS: REQ-IMAGE-013..014

### v0.15.5 — E2E Tests + Tag v0.15.0
- [ ] Tests for crop, rotate, resize, multi-import
- [ ] Add SRS_IMAGE.md with all REQ-IMAGE requirements
- [ ] All tests green, tag v0.15.0

---

## Future (Backlog)
> Not yet planned — will be prioritized when earlier iterations are complete

- **Cloud Sync** — Paid tier (€2-5/month), multi-device sync, backup, version history
- **Collaboration** — Real-time co-editing, comments, presence indicators
- **Collapsible Containers** — Canvas-in-canvas grouping (deferred from v0.2)
- **Template Gallery** — Pre-built page templates (meeting notes, project plan, etc.)
- **Advanced Diagram Tools** — Connectors, flowcharts, mind maps
- **Mobile App** — React Native or PWA for tablet/phone
- **Plugin System** — Community extensions
- **Database/Table Blocks** — Notion-style structured data on canvas

---

**Last updated:** 2026-03-25
