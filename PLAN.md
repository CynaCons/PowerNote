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
| v0.22.0–v0.22.4 | **tagged** — FSA direct save, autosave, draw-over-images, revert, partial bold/italic |
| v0.23.0 | **shipped** — Extended inline formatting + read-only Gantt nodes (`d49eb48`) |
| v0.24.1 | **tagged** — Persist canvas settings in HTML + save-in-progress animation |
| v0.25.0-proto | **shipped** — Live update via FSA A/B swap |
| v0.25.1 | **tagged** — Live update swap + bound HTML file path |
| v0.25.2 | **tagged** — Absolute file:// path; clear stale FSA on local open |
| v0.26.0 | **shipped** — Default text width = one page; manual widen |
| v0.27.0 | **shipped** — Shape & drawing groups (flat + isolation) |
| v0.28.0 | **shipped** — Agent bridge: MCP writes notes into the live app |
| v0.28.1 | **tagged** — Floating zoom control bar |
| v0.29.0 | **shipped** — Agent bridge: notebook management + update control |
| v0.30.0 | **shipped** — Scroll guide style + agent-controlled canvas look |
| v0.31.0 | **shipped** — Named scrolls: identity for parallel columns |
| v0.32.0 | **shipped** — Resizable hierarchy panel |
| v0.33.0 | **shipped** — Document outline, active scroll, agent deletes |
| v0.33.1 | **shipped** — Test suite timeout hardening |
| v0.34.x | **partially shipped** — Diagrams as native canvas objects. Frames, PlantUML component/composite parsing, `create_diagram` over MCP. Reflow, the pin loop and the sequence/state layouts are NOT built; see `docs/SRS_DIAGRAM.md` for what shipped |
| v0.35.0 | **shipped** — Scrolls: ScrollText icon, user-created scrolls, pinned titles, magnetic edge snap |
| v0.35.1 | **current, tagged** — Swimlane activity diagrams (second PlantUML grammar) |

---

## v0.26.0 — Default Text Width = Page (user CR)
> **Problem:** Placing a text block with the text tool creates a ~120px-wide box. While typing the first edit, words wrap after only a few characters. Final size is only settled after commit via content auto-measure (REQ-TEXT-020, max 800). That feels wrong for page-oriented notebooks.
>
> **Wanted:** New text elements should default to **one page width** (A4 guide width, 794px at 96 DPI — same constant as `PageGuides`) for the entire first edit session, so typing uses a full-page column. Users must still be able to **resize wider** (and narrower) when needed; the page-width default is a starting size, not a hard max.
>
> **Root cause (current code):**
> - `useTextPlacement.ts` hardcodes `width: 120` on create
> - `TextEditor.tsx` uses that width with `maxWidth: 800` while editing
> - `TextNode.tsx` post-commit auto-shrinks to content (`scrollWidth`, max 800)
> - `SelectionTransformer` enables resize only for `image` / `shape` — text has no width handles today (SRS REQ-TEXT-007 still says “no manual resize handles”; that must be updated)
>
> **Acceptance:**
> - [x] New text from text tool is created with default width = page width (`A4_WIDTH` / shared page constant, not 120)
> - [x] Inline editor (first edit and subsequent edits) uses the node’s width for wrapping — page-wide by default, no early wrap
> - [x] Raise or remove the 800px editor/render max so wider-than-page text is allowed after resize
> - [x] Manual resize of text block width (L/R handles on TextNode); height remains auto from content
> - [x] After commit: do **not** shrink width back to content — preserve intentional width; height auto-grows
> - [ ] Optional: snap / show guide when width ≈ page width *(deferred)*
> - [x] Update `docs/SRS_TEXT.md` — revise REQ-TEXT-007 / REQ-TEXT-020; add REQ-TEXT-028/029
> - [x] E2E: T03/T16/T21 rewrite + T92 page-default + resize preserve
> - [x] Smoke + Playwright — `tsc` clean; T03/T16/T21/T92 **14/14** green; `npm run dev` HTTP 200

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
- [x] Zoom percentage display in TopBar or bottom-right corner
- [x] Zoom in/out buttons (+/- icons)
- [ ] Scroll to zoom indicator on first use

### v0.11.4 — Pinch-to-Zoom (Touch)
- [x] Multi-touch pinch zoom on canvas
- [ ] Two-finger pan
- [ ] Touch-friendly selection (long-press = select)
- [x] SRS: REQ-CANVAS-013..015
- [ ] E2E tests, tag v0.11.0

---

- [x] AUDIT 2026-08-11: pinch requirements reallocated — the planned REQ-CANVAS-013..015 had been spent on lasso/multi-drag. Pinch is now REQ-CANVAS-025/026 (implemented, covered by T106); two-finger pan and long-press select are recorded as REQ-CANVAS-027/028 under "Not implemented" in SRS_CANVAS
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
- [x] `# H1` renders at 28px, `## H2` at 22px, `### H3` at 18px on canvas
- [ ] Heading size affects text block auto-width
- [x] Bold/italic rendering matches markdown spec
- [x] SRS: REQ-TEXT-023..025

- [x] AUDIT 2026-08-11: heading requirements reallocated — the planned REQ-TEXT-023..025 had been spent on inline bold/italic/strike. Heading sizing is now REQ-TEXT-030/031, covered by T58. Shipped values are relative (1.6/1.3/1.1em ≈ 25.6/20.8/17.6px at a 16px block), not the fixed 28/22/18px originally written — relative scaling was kept deliberately so headings track the block's font size
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

### v0.14.0 — PDF Export (MOVED TO BACKLOG 2026-08-11) (COMPLETE)
**Goal:** MOVED TO BACKLOG 2026-08-11 — never started; tracked under "PDF Export" in the Future (Backlog) section. Closed here so it stops reading as in-flight work.
- [ ] Export current page as PDF (via browser print API or html2canvas + jsPDF)
- [ ] A4 page boundaries guide the page breaks
- [ ] Include all visible elements: text, images, shapes, drawings
- [ ] SRS: REQ-EXPORT-001..003

### v0.14.1 — Image Export (PNG/SVG) (MOVED TO BACKLOG 2026-08-11) (COMPLETE)
**Goal:** MOVED TO BACKLOG 2026-08-11 — never started; tracked under "Image Export (PNG/SVG)" in the Future (Backlog) section. Closed here so it stops reading as in-flight work.
- [ ] Export current page as PNG (Konva Stage toDataURL)
- [ ] Optional: SVG export for vector quality
- [ ] Configurable resolution/scale
- [ ] SRS: REQ-EXPORT-004..005

### v0.14.2 — Print Support (MOVED TO BACKLOG 2026-08-11) (COMPLETE)
**Goal:** MOVED TO BACKLOG 2026-08-11 — never started; tracked under "Print Support" in the Future (Backlog) section. Closed here so it stops reading as in-flight work.
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

### v0.25.2 — Absolute path on file:// + no stale FSA name (2026-07-18) (COMPLETE)
> Opening a Downloads copy via `file://` showed a stale IndexedDB handle name (e.g. `Take Action Now.html`) instead of the real absolute path. Prefer decoded `file://` absolute path; clear the current FSA handle when booting from embedded local HTML so Ctrl+S cannot overwrite the wrong file.
- [x] On embedded `file://` boot: `clearCurrentHandle` before path resolve + `setFromFileUrl`
- [x] `resolveFileUrlLabel` / format absolute Windows paths (incl. spaces)
- [x] `docs/SRS_FILE.md` — REQ-FILE-023
- [x] E2E test 91
- [x] Smoke + Playwright — T90/T91 green (9/9)

### v0.25.1 — Show bound HTML file path
> Show which HTML file the session is linked to. Browsers cannot expose a full OS path via FSA — display `handle.name` when bound, `file://` decoded path when opened as a local file, or “Not linked to a file” otherwise. Refresh on Open / Save As / library load / handle clear.
- [x] `useFileBindingStore` — label + source; refresh from FSA handle or `file://` location
- [x] Wire `setCurrentHandle` / `clearCurrentHandle`; library load clears handle
- [x] TopBar shows path under notebook title (`data-testid="topbar-file-path"`)
- [x] `docs/SRS_FILE.md` — REQ-FILE-022
- [x] E2E test 90
- [x] Smoke + Playwright — T90 + T77/T80 regression green (15/15)

### v0.25.0-proto — Live update via FSA A/B swap
> Prototype: when a File System Access handle exists, overwrite that notebook with the new app bundle + injected data, then `location.reload()` (same-document swap). Fallback: existing dual download (backup + updated file) when no handle / write fails / live-update disabled via `window.__POWERNOTE_LIVE_UPDATE__ = false`.
- [x] `docs/SRS_UPDATE.md` — REQ-UPDATE-001..004
- [x] `src/utils/updateChecker.ts` — `buildUpdatedHtml`, live-swap vs download fallback; safety backup before overwrite (default on)
- [x] `SettingsPanel.tsx` — status copy: “Updating this file…” vs “Downloading backup + update…”
- [x] E2E T87 (parse/hydrate), T88 (write+reload mocks), T89 (download fallback)
- [x] Chrome FSA manual checklist (see below)
- [x] Regression: T69/T70/T79/T80/T82 + T87–T89 — **21/21 passed**; `tsc` clean

#### Manual Chrome checklist (prototype)
| Step | Result |
|------|--------|
| 1. Save As once so FSA handle exists | Covered by T80 handle store + T88 getHandle mock |
| 2. Distinctive text → Update | T88 asserts payload written into handle HTML |
| 3. Live path reloads (updated notebook not downloaded) | T88: `reloadCount === 1`, only backup download |
| 4. After reload content + version intact | T87: hydrate from built HTML preserves text + settings |
| 5. Ctrl+S still targets same handle | Unchanged FSA save path (T79/T80); no live-swap regression |
| 6. No-handle / disabled live → download pair | T89 + T88 flag-off case |

**Prototype verdict: PASS** (automated contract). End-to-end human click through Settings → Update against a real GitHub asset + real disk file remains a release-hardening smoke before promoting out of `-proto`.

### v0.24.1 — Save-in-Progress Animation
> Manual save (Ctrl+S / Save / Save As) can take a noticeable moment with no feedback. Show a clear in-progress state until the write finishes. Autosave stays silent (no spinner).
- [x] Workspace `isSaving` flag set around manual `saveNotebook` only
- [x] TopBar Save button: spinner + disabled + `aria-busy` while in flight; guard against double-trigger
- [x] `docs/SRS_FILE.md` — REQ-FILE-021 (save-in-progress indicator)
- [x] E2E test 86 — Save shows busy state then clears on success; no-op while already saving
- [x] Smoke + Playwright run — T85/T86 green; fixed T39 flake (disable FSA on standalone `file://` page so re-export uses download)

### v0.24.0 — Persist Canvas Settings in HTML Data
> Background mode (pages / grid / none) and background color lived in React `useState` in `AppShell` — they reset on reopen. Now persisted in `#powernote-data` so each notebook remembers its look.
- [x] Extend `WorkspaceData` with `settings: { backgroundMode, bgColor }` (defaults for older files)
- [x] Move settings out of `AppShell` local state into workspace store; mark dirty on change
- [x] Serialize/hydrate on save/load + FSA revert / library / open paths via `migrateWorkspace` → `ensureWorkspaceSettings`
- [x] `docs/SRS_SETTINGS.md` — REQ-SETTINGS-004 (file round-trip); clarify REQ-SETTINGS-003 (in-session)
- [x] E2E test 85 — change settings → save → reload → settings restored
- [x] Smoke + Playwright run — covered with v0.24.1 suite run

### v0.23.0 — Extended Inline Formatting + Gantt Nodes (commit `d49eb48`)
> Extends v0.22.4 with Strike/Code/Underline (toolbar + shortcuts), Gantt chart canvas nodes (vendored PowerPlanner renderer), docs polish (PRD/VISION/SRS_MATH), and ESLint tooling.
- [x] `src/utils/markdownToggle.ts` — wrap/unwrap helper for asymmetric marker pairs (underline, strike, code)
- [x] `src/stores/useEditorStore.ts` — reactive enablement for edit-only format buttons
- [x] `TextEditor.tsx` / `TextToolbar.tsx` — Strike/Code/Underline buttons + Ctrl+U/E/Shift+X; keep v0.22.4 bold/italic path
- [x] Gantt node type + NavRail tool + `src/vendor/powerplanner` read-only embed
- [x] `docs/SRS_TEXT.md` — REQ-TEXT-025/026/027; `docs/VISION.md`, `docs/SRS_MATH.md`, PRD refresh
- [x] ESLint config + `lint` / `typecheck` scripts
- [x] E2E test 84 (`tests/text/84-inline-formatting.spec.ts`)

### v0.22.4 — Partial Bold/Italic in Text Blocks (Bug Fix)
> Bug: applying bold to a selection inside a text block bolded the ENTIRE block (block-level `fontStyle`). Fix: while editing, bold/italic wrap only the selected text in inline markdown (`**`/`*`). Block-level toggle is preserved for a selected (non-editing) node.
- [x] `TextEditor.tsx`: `applyInlineFormat()` helper (wrap/unwrap selection) + active-editor registry + Ctrl/Cmd+B / Ctrl/Cmd+I shortcuts
- [x] `TextToolbar.tsx`: bold/italic route to selection while editing; `onMouseDown` preventDefault keeps the editor focused
- [x] `docs/SRS_TEXT.md`: REQ-TEXT-022 (selection-only formatting), REQ-TEXT-023 (keyboard shortcuts), REQ-TEXT-024 (Word-style bold-then-type with no selection)
- [x] `docs/SRS_TOOLBAR.md`: clarify REQ-TOOL-005, add REQ-TOOL-007 (edit-mode inline formatting)
- [x] E2E test 83 (`tests/text/83-text-partial-bold.spec.ts`)
- [x] Smoke + Playwright run — full suite green (sole failure T39 is a pre-existing download-event flake, unrelated)

### v0.22.3 — Revert to Last Saved (commit `9f7686c`)
> Standard revert flow: discard unsaved in-memory changes and reload the current file from disk via the FSA handle. Matches Word/VS Code/Google Docs behavior.
- [x] `src/utils/revertNotebook.ts` — confirm-and-reload helper that re-reads the FSA handle, hydrates stores, marks clean
- [x] `TopBar.tsx` — revert button (RotateCcw icon), disabled unless `isDirty && FSA handle available`
- [x] `docs/SRS_FILE.md` — REQ-FILE-019 (revert semantics), REQ-FILE-020 (enablement gating)
- [x] E2E test 82 (`tests/file/82-revert.spec.ts`)
- [x] Smoke + Playwright run

### v0.22.2 — Draw Over Images (Strokes on Top) (commit `9f7686c`)
> Swap Konva layer order so freehand strokes always render above images/text/shapes. Unblocks annotating screenshots.
- [x] `InfiniteCanvas.tsx`: reorder layers → guides, nodes, drawings, selection-transformer
- [x] `docs/SRS_DRAW.md`: add REQ-DRAW-009 (stroke z-order above nodes) → T81
- [x] E2E test 81 (`tests/draw/81-stroke-above-image.spec.ts`) — stroke renders above an image at the same coordinates
- [x] Smoke + Playwright run

### v0.22.1 — Faster Autosave + Drop localStorage Snapshot (commit `9f7686c`)
> Replace 30s interval with 1.5s debounce + 5s max-wait. Remove `powernote-autosave` localStorage key now that FSA handle writes the live file. Keep notebook library and IDB handle store untouched.
- [x] Rewrite `startAutoSave` in `src/utils/serialization.ts` — debounce 1.5s, max-wait 5s, driven by workspace store subscription
- [x] Remove `autoSaveToLocalStorage` / `loadFromLocalStorage` / `clearAutoSave` APIs
- [x] `main.tsx`: drop localStorage-fallback hydration; add one-shot migration that removes any legacy `powernote-autosave` key
- [x] `saveNotebook.ts`: drop `clearAutoSave` calls
- [x] `docs/SRS_FILE.md`: update REQ-FILE-015 (new cadence, no localStorage snapshot) and REQ-FILE-016 (remove — hot-restore comes from FSA handle)
- [x] Rewrite `tests/file/61-auto-save.spec.ts` to verify debounced behavior + absence of legacy key
- [x] Smoke test + full Playwright run

---

## Planned (Not Yet Shipped)
> Features specified in SRS or earlier iterations that have not yet shipped. Moving here so PLAN.md reflects reality.

### Active next (user CR)
- [x] **v0.26.0** — Default text block width = one page; allow wider resize (see section above) — impl + tests; optional page-width snap deferred

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

## v0.27 — Shape & Drawing Groups
> Durable flat groups for shapes + freehand strokes; move as a unit; isolation mode to edit members.

### v0.27.0 — Shape & drawing groups (2026-07-21) (COMPLETE)
> Group/ungroup (Ctrl+G / Ctrl+Shift+G); shapes + strokes only; flat groups; isolation via double-click/Esc. Fix multi-select drag (REQ-CANVAS-015).
>
> **Goal:** Multi-select shapes + freehand into a durable flat group; move as a unit; isolation mode to edit one member.
- [x] Multi-select drag: move all selected nodes + strokes together (REQ-CANVAS-015 fix) [agent: grok]
- [x] Data model: groupId on nodes/strokes + Page.groups + migrate/hydrate [agent: grok]
- [x] Group / Ungroup commands (Ctrl+G / Ctrl+Shift+G) for shapes+strokes only [agent: grok]
- [x] Selection expands to full group on member click [agent: grok]
- [x] Isolation mode: enter (dblclick/Enter), dim, single-member edit, Esc exit [agent: grok]
- [x] Context menu + light chrome (union bounds / breadcrumb) [agent: grok]
- [x] docs/SRS_GROUP.md REQ-GROUP-001..010 + cross-links to canvas/shapes/draw [agent: grok]
- [x] E2E T93+ group/ungroup/move/isolate/persist [agent: grok]
- [x] Smoke + Playwright [agent: grok]

---

**Last updated:** 2026-07-21 (v0.27.0 shape & drawing groups shipped)

### v0.28.0 — Agent bridge — MCP writes notes into the live app (COMPLETE)
**Goal:** Let an external agent create pages and fill them with markdown blocks (bullets, checklists, headings) in the running PowerNote app, via an MCP server that hosts a WebSocket the app dials out to.
- [x] Bridge protocol + WS client in app (src/bridge/): connect, handshake, dispatch, ack/error
- [x] Command handlers over stores: list_pages, read_page, create_section, create_page, append_block, update_block
- [x] Markdown block layout: x=PAGE_MARGIN, width=A4_WIDTH, y stacked below last block; height measured synchronously offscreen via shared renderMarkdown util (TextNode's own measure lands 60ms late — too slow for back-to-back agent appends)
- [x] Settings toggle "Agent bridge" (OFF by default, flag in localStorage not in the notebook) + connection status indicator
- [x] MCP server (powernote-mcp/, Node ESM): hosts WS on 127.0.0.1:41777, exposes the 6 note tools, registered in .mcp.json
- [x] docs/SRS_AGENT.md — REQ-AGENT-001..025 with test refs
- [x] E2E tests T94+ (bridge connect, append block, checklist round-trip, persistence) + smoke + full Playwright green

**Fixes from the live demo** (found before the feature ever shipped, so folded into this release):
- [x] Fix connection flip-flop: server sends `displaced` frame before closing the older client; displaced client stands down permanently instead of reconnecting
- [x] Displacement clears the persisted enable flag + Settings explains why and how to reclaim; in-flight requests to a displaced notebook fail fast
- [x] Column targeting: `column` param on append_block/create_page, per-column independent stacking, read_page reports column and orders column-major
- [x] Fix systematic height under-measurement: probe now applies the renderer's inline styles (font-size/line-height/padding), not just the CSS class — drift 46 vs 34 on an H1, now 0
- [x] Extract markdownBoxStyle into renderMarkdown util so TextNode and the measurement probe share one style definition
- [x] Tests: T98 (11 cases) + powernote-mcp `npm test` displacement suite; stubBridgeUrl helper makes bridge tests hermetic; 323 pass / 1 pre-existing failure (85-settings-persist, predates this work)
- [x] docs/SRS_AGENT.md REQ-AGENT-016..025 + README columns/displacement sections
- [x] Version bump 0.28.0, tag v0.28.0
### v0.28.1 — Floating zoom control bar (2026-08-11) (COMPLETE)
**Goal:** Give the canvas a visible zoom readout and mouse-only zoom controls. Ctrl+wheel and pinch already work, but there is no % indicator, no click-to-zoom, and no reset-to-100%.
- [x] Visual prototypes: 4 variants (A compact pill, B slider bar, C dropdown pill, D auto-hide rail) mounted live in the app behind ?zoomproto=1 (src/components/canvas/ZoomBarPrototypes.tsx — throwaway)
- [x] User picks a variant (BLOCKED — awaiting decision before implementation)
- [x] Implement chosen ZoomBar in src/components/canvas/, delete the prototype harness + its AppShell hook
- [x] docs/SRS_CANVAS.md — new REQ-CANVAS-NNN for zoom readout / step zoom / reset-to-100% / fit, with test refs
- [x] E2E test (next free number) — zoom bar % tracks viewport.scale, buttons step and clamp at 10%/500%
- [x] Fix latent stage-ref race: InfiniteCanvas registered the Konva stage on a 100ms setTimeout keyed on dimensions, so for ~100ms after mount/resize zoomToFit silently no-oped and centre-anchored zoom fell back to the origin — now registered synchronously in the post-commit effect
- [x] setZoom action on useCanvasStore (centre-anchored, clamped) + MIN_SCALE/MAX_SCALE exported from the store and reused by InfiniteCanvas wheel/pinch instead of local duplicates
- [x] Version bump 0.28.1 (package.json + src/version.ts), dist-template rebuilt so the in-app updater serves 0.28.1, tag v0.28.1
### v0.29.0 — Agent bridge — notebook management + update control (2026-08-11) (COMPLETE)
**Goal:** The agent can create and fill pages but cannot manage the notebook around them: no rename, no reorganising, no way to persist to disk, no visibility of app updates. Add rename_page, move_page, rename_notebook, save_notebook, check_update and run_update.
- [x] protocol.ts — 6 new BridgeCommandNames + result payload types
- [x] rename_page — retitle in the sidebar; also rewrite the canvas H1 when it still matches the old title (opt out via updateHeading:false)
- [x] move_page — move a page between sections, with active-page tracking so savePageNodes keeps writing to the right place
- [x] Fix latent movePageToSection bug: the "don't leave a section empty" guard skipped removal but still inserted into the target, duplicating the page id across two sections. Dead code until now — move_page is its first caller
- [x] rename_notebook — renames inside the app only; the bound file on disk keeps its name until a Save As (documented in the tool description)
- [x] save_notebook — existing-file fast path only; errors when no FSA handle is bound, since the Save As picker needs a user gesture the bridge cannot provide
- [x] check_update — report current vs latest GitHub release; distinguish "up to date" from "check failed" (rate limit / offline)
- [x] run_update — requires confirm:true; acks before the live-swap reload so the agent gets a response instead of a dropped socket
- [x] powernote-mcp: 6 TOOLS entries + server version bump + README section
- [x] docs/SRS_AGENT.md REQ-AGENT-026+ and E2E T100, full suite green
- [x] Fix downgrade hazard in checkForUpdate: it compared versions by inequality, so a build ahead of the published tag reported the OLDER release as an available update — and run_update would have installed it. Now a strict semver comparison (compareVersions); also fixes the same false prompt in the Settings panel and startup banner
- [x] saveNotebook gains an existingFileOnly option + SaveOutcome return, so the bridge reuses the real save path instead of duplicating revision stamping
- [x] Longer request budget for the network-bound tools (POWERNOTE_BRIDGE_SLOW_TIMEOUT_MS, default 120s) — a 2.4MB update download does not fit the 10s default
- [x] Version bump 0.29.0 (package.json, src/version.ts, powernote-mcp package + server + lockfile, SRS_AGENT header), dist-template rebuilt, tag v0.29.0
### v0.30.0 — Scroll guide style + agent-controlled canvas look (2026-08-11) (COMPLETE)
**Goal:** Agents can read and change the notebook's canvas look (guide style + background colour) over the bridge, and a new "Scroll" guide style renders the page column as one continuous vertical sheet with light page separators instead of detached A4 cards. Notebook-level settings persistence (v0.26) and agent-triggered save_notebook (v0.29) already exist — this iteration verifies them against the new surface rather than rebuilding them.
- [x] Add `scroll` to the `BackgroundMode` union and to `VALID_BG_MODES` in migrations so older/newer files validate it
- [x] Add scroll geometry to `pageLayout.ts` (separator inset, trailing headroom) so PageGuides and the bridge share one source of truth
- [x] `renderScroll()` in PageGuides.tsx — one continuous sheet per occupied column, page separators every A4_HEIGHT, no vertical PAGE_GAP
- [x] Settings panel: fourth "Scroll" radio under Guide style (`data-testid="settings-bg-scroll"`)
- [x] T101 — E2E: scroll style renders continuous sheet, survives page navigation, round-trips through save → open (Covers REQ-SETTINGS-005)
- [x] Bridge protocol: add `get_background` / `set_background` command names + `BackgroundResult` payload to `bridge/protocol.ts`
- [x] Bridge handlers: `getBackground` / `setBackground` in `bridge/commands.ts` — validate guideStyle + color against the allowed sets, write via `updateSettings` (marks dirty, feeds auto-save), reject unknown values with BAD_PARAMS listing the valid options
- [x] MCP server: register `get_background` + `set_background` tools with enum-constrained schemas; bump `powernote-mcp` version and document them in its README tool table
- [x] T102 — E2E: agent sets guide style + background colour over the bridge, canvas re-renders, notebook goes dirty; unknown values rejected (Covers REQ-SETTINGS-006, REQ-AGENT-023)
- [x] T103 — E2E: agent `set_background` → `save_notebook` → reopen the written file keeps the scroll style (proves the existing persistence + save path covers agent-set look)
- [x] SRS_SETTINGS: REQ-SETTINGS-005 (scroll guide style) and REQ-SETTINGS-006 (canvas look readable/writable by an agent) with test refs
- [x] SRS_AGENT: requirement for `get_background` / `set_background` + note that agent-set look persists through the normal auto-save/save path
- [x] Bump APP_VERSION to 0.30.0, full `npx playwright test` green, dev smoke test with no console errors
- [x] Fix flaky T85 "settings round-trip through save → open": the fixed `waitForTimeout(500)` after `setInputFiles` is too tight on slower machines (FileReader + hydrate). Wait on the "Notebook opened" toast / poll the store instead
### v0.31.0 — Named scrolls — identity for parallel columns (PROPOSED) (2026-08-11) (COMPLETE)
**Goal:** Agents can already write into parallel columns via append_block(column:N), but a column has no identity: no id, no title, no defined start, and no way to discover what scrolls a page holds. Give each scroll a stable id, a title rendered at its top, and a bridge API to list/create/rename/target them — so two agents (or an agent and the user) can work side by side on one page without colliding. Design pending sign-off.
- [x] `ScrollRecord { id, title, column }` in types/data.ts + `Page.scrolls?: ScrollRecord[]` — records own identity, membership stays derived from geometry
- [x] Backfill on load: synthesize a record for every occupied column of every page so existing notebooks gain stable scroll ids exactly once (extend the `ensureWorkspaceSettings` hydration step)
- [x] `scrollOf(node, scrolls)` / `scrollBand(record)` in bridge/blocks.ts, layered over the existing `columnOf` band test — one source of truth for "which scroll is this block in"
- [x] Scroll header in PageGuides: title + hairline rule drawn in the guide layer (chrome, not a text node), `SCROLL_HEADER_HEIGHT` reserved so `BLOCK_TOP_INSET` starts below it
- [x] Workspace store ops: `createScroll` / `renameScroll` / `deleteScroll` / `reorderScroll`, each moving the affected blocks' x atomically with the band change so derived membership never breaks
- [x] Double-click a scroll header to rename it inline (mirrors the hierarchy panel's rename affordance)
- [x] Bridge: `list_scrolls`, `create_scroll`, `rename_scroll` commands + protocol payloads
- [x] Bridge: `append_block` gains `scrollId` (with `column` kept as a working deprecated alias); `read_page` returns `scrollId` per block plus the page's scroll list
- [x] MCP server: register the scroll tools; description must steer agents to list_scrolls → target by scrollId rather than guessing a column index
- [x] T104 — scroll identity: ids survive save → open, reorder and insert keep membership intact, header renders the title
- [x] T105 — two agent sessions append to different scrollIds on one page concurrently; neither's blocks land in the other's band
- [x] New `docs/SRS_SCROLL.md` (REQ-SCROLL-001..) covering identity, titles, derived membership and the agent surface; cross-reference from SRS_AGENT
- [x] Surface scroll names to the user beyond the canvas header: list a page's scrolls under it in the hierarchy panel, and show the active scroll name in the TopBar breadcrumb
### v0.32.0 — Resizable hierarchy panel (2026-08-11) (COMPLETE)
**Goal:** The sidebar is locked at 240px, so pages and sections with longer names are ellipsised with no way to read them. Add a drag handle on its right edge so the panel can be widened, with the width held for the session (not persisted, by explicit choice).
- [x] Drag handle on the hierarchy panel's right edge (`data-testid="hierarchy-resize-handle"`), using pointer capture so the drag survives the cursor leaving the strip
- [x] Width clamped to 180–560px; double-click the handle resets to the 240px default
- [x] Keyboard-accessible: handle is focusable with `role="separator"`, Arrow keys resize in 16px steps, Home resets
- [x] Width is session-only by explicit decision — not written to the notebook and not to localStorage; reopening resets to 240px
- [x] SRS_HIERARCHY: REQ-HIER-012..014 (resizable panel, clamping, session-only width)
- [x] T107 — E2E: drag widens the panel, clamps at both bounds, double-click resets, keyboard steps, and a long page title shows more text once widened
- [x] Bump APP_VERSION to 0.32.0, full suite green, rebuild dist-template, commit, tag and publish the GitHub release
### v0.33.0 — Document outline, active scroll, and agent deletes (2026-08-11) (COMPLETE)
**Goal:** Promote the outline prototype into the sidebar as a real feature, scoped to one active scroll rather than the whole page. Introduce an explicit active-scroll concept set by clicking — in the sidebar or on the canvas header — which also drives navigation: clicking a scroll opens its page and moves the viewport to its start. Separately, give agents the delete verbs the bridge has never had: an agent can create pages, sections, scrolls and blocks but cannot remove any of them.
- [x] `activeScrollId` runtime state on the workspace store (alongside activeSectionId/activePageId — not serialized), defaulting to the leftmost scroll and re-resolving on page change
- [x] `utils/viewportFocus.ts` — shared viewport math for "show this scroll's start" and "jump to this heading", so the sidebar and the outline cannot drift apart
- [x] Clicking a scroll in the sidebar shall open its page, set it active, and move the viewport to the top of that scroll
- [x] Clicking a scroll's canvas header shall also make it active, and the active scroll shall be visually marked in both the sidebar and on the header
- [x] Sidebar "Outline" tab showing only the ACTIVE scroll's headings, derived live from markdown; entries jump to the heading without changing zoom. Drop the floating-overlay variant
- [x] Bridge + MCP: `delete_page`, `delete_section`, `delete_scroll` (with `withBlocks`), `delete_block` — every one requiring `confirm: true`, and surfacing the store's existing last-page/last-section/last-scroll guards as PRECONDITION rather than a silent no-op
- [x] T108 — outline + active scroll: outline tracks the active scroll only, sidebar click navigates and moves the viewport, heading jump preserves zoom
- [x] T109 — agent deletes: each verb removes the right thing, refuses without confirm, and reports the guard when the last page/section/scroll would go
- [x] SRS: new REQ-OUTLINE ids in a docs/SRS_OUTLINE.md, active-scroll requirements in SRS_SCROLL, delete verbs in SRS_AGENT
- [x] Bump APP_VERSION to 0.33.0, full suite green, rebuild dist-template, commit, tag and publish the GitHub release
### v0.33.1 — Test suite timeout hardening (2026-08-11) (COMPLETE)
**Goal:** A cluster of text tests (26, 58, 59, 73, 83, 92) failed intermittently across three full-suite runs and passed serially every time. Cause: 41 hand-written `{ timeout: 2000 }` assertion waits, all BELOW Playwright's 5000ms default, which fail correct-but-slow runs when the machine is busy. Raise the ceilings so load costs time rather than green.
- [x] Remove all 41 sub-default `{ timeout: 2000 }` assertion overrides across 20 files so they inherit one config-level `expect.timeout`
- [x] playwright.config.ts: test `timeout` 15s→30s, `actionTimeout` 5s→10s, explicit `expect.timeout` 10s, with the reasoning recorded in-file
- [x] Retries deliberately left at 0 — a retry converts an intermittent bug into a green run, which defeats the suite's purpose
- [x] Drop the one `.click().catch(() => {})` in T104 — a swallowed action timeout is the only pattern a raised ceiling can slow, and it was hiding whether the assertions ran at all
- [x] Verified under the failing condition: 414 passed with a dev server, preview browser and a build running alongside (6.4m — heavier than any run that previously failed)
### v0.34.0 — Diagram frames and the layout pipeline
**Goal:** Agents can write markdown but cannot draw. Give them a diagram frame: a bounded, titled region that sits in a scroll like any other block, inside which a spec of entities and relationships becomes ordinary ShapeNodes and TextNodes — the same objects the user creates by hand, draggable the moment they land. The agent never supplies coordinates. It names entities and edges; the app measures the label text, runs dagre, materialises the result and returns geometric warnings in the same response, so a clean diagram costs one round trip. Frames grow when re-laid out, which means blocks below them must move — PowerNote has never had reflow, and `nextBlockY` only positions at append time. That is the gate for this iteration. Rendering follows the weighted-ink tokens chosen 2026-08-13: #EEF1F0 fill, 1.6px ink stroke, white hairline containers, one accent (#B4552D) reserved for faults.
- [x] `ShapeNodeData`: add `cornerRadius` and `rotation` (UML states are rounded rects; gain triangles point along the signal path and Konva triangles point up). Renderers honour both, save/load round-trips both, existing shapes default to 0
- [ ] `DiagramFrameData` node type holding the spec (entities, relationships, layout intent) plus a title band, sized to an intrinsic height like a text block
- [ ] Reflow (the gate): a block or frame whose height changes shall push the blocks below it in the same scroll down, and close the gap when it shrinks. `nextBlockY` stays the append path; this is the new growth path. Column-scoped, matching how `nextBlockY` already scopes
- [x] Measure stage: each entity's intrinsic box size comes from real rendered text metrics for its label, never from the agent — this is where label overflow is designed out rather than audited
- [ ] Layout stage: `@dagrejs/dagre` for the `flow` intent (down and right), grid snap, orthogonal edge routing. Chosen over elkjs (~500KB) because PowerNote ships as one static HTML file and recursive dagre covers the nesting case in v0.34.2
- [x] Materialize stage: emit native ShapeNodes and TextNodes carrying the frame's `groupId`, indistinguishable from hand-drawn ones and selectable with the existing Transformer
- [ ] Audit stage: structured warnings (`label_overflow`, `node_overlap`, `edge_crossing`, `out_of_frame`, `orphan_entity`, `density`) computed geometrically and returned in the SAME response as the write — geometry is ground truth here, so no LLM auditor pass is needed for it
- [ ] Pin loop: a child the user drags is flagged `pinned` and becomes a fixed constraint on every later re-layout, so re-running the agent never destroys manual work
- [ ] Positional membership, matching how scrolls already work: a child dragged outside the frame drops its entity from the spec, and a child the user deletes drops its entity too. Canvas stays the source of truth for geometry, spec for semantics
- [ ] Bridge + MCP verbs: `create_diagram_frame`, `set_diagram_spec`, `read_diagram`, `update_diagram` — placement by `scrollId` like `append_block`, and style by token name not hex, matching the `set_background` precedent
- [x] Weighted-ink render tokens as the defaults: tint #EEF1F0 + 1.6px ink for real things, white + 1px #C3CBC9 for containers, #B4552D for faults only, sans 12.5px medium inside shapes, sans 11px #5C6467 for labels
- [ ] `read_page` and `orderedTextNodes` currently filter to `type === 'text'`, so a frame would be invisible to agents — include frames in reading order, reported by title rather than by dumping their children
- [ ] Audit existing assumptions that a block's `y` is write-once — save/load, undo/redo and the `tests/agent/` suite all predate reflow
- [ ] T110 — reflow: a frame that grows pushes following blocks down, shrinking closes the gap, other columns are untouched, and positions survive a save/load round-trip
- [ ] T111 — pipeline: a spec of entities and edges produces native shape and text nodes inside the frame, labels fit their boxes, and the write response carries the warning list
- [ ] T112 — pin and membership: a dragged child survives re-layout in place, a child dragged out of the frame leaves the spec, and a deleted child drops its entity
- [ ] SRS: `docs/SRS_DIAGRAM.md` with REQ-DIAG ids and test refs; add the two new shape fields to SRS_SHAPES as REQ-SHAPE-021..022
- [ ] Bump APP_VERSION to 0.34.0, full suite green, rebuild dist-template, commit, tag and publish the GitHub release
### v0.34.1 — Sequence and state machine layouts
**Goal:** Two more layout strategies over the SAME entity-and-relationship spec, so the agent learns no new vocabulary. A sequence diagram is not a graph layout at all: participants become lifeline columns and messages become rows in edge-array order, which is deterministic and needs no dagre. State machines are dagre plus two routing special cases — self-loops where `from === to`, and back-edges routed below the row rather than through it. Both render in the weighted-ink tokens from v0.34.0.
- [ ] `sequence` layout strategy: entities become lifeline columns, relationships become message rows in edge-array order. No dagre — the ordering is already in the spec
- [ ] Activation bars derived from the span between a call and its reply, so the agent never positions them; dashed lifelines drawn behind, bars over
- [ ] UML message notation: solid line with filled arrowhead for a synchronous call, dashed line with open arrowhead for a reply (`kind: 'reply'` on the edge)
- [ ] `state` layout strategy: dagre, plus self-loop stubs where `from === to` and back-edges routed below the row instead of through it
- [ ] Pseudostates as spec shapes: `initial` (filled circle) and `final` (ring around a filled circle), laid out like any other entity but never labelled
- [ ] Guards rendered in brackets as edge labels, and the fault accent (#B4552D) applied to edges the spec marks as error transitions — the one place colour carries meaning
- [ ] T113 — sequence: message order follows the edge array, activation bars span call to reply, replies render dashed with an open head
- [ ] T114 — state machine: self-loop renders as a stub without overlapping its state, a back-edge routes below the row, and initial/final pseudostates render correctly
- [ ] SRS: REQ-DIAG ids for both strategies; bump APP_VERSION to 0.34.1, full suite green, rebuild dist-template, commit, tag and release
### v0.34.2 — Deployment and block diagram layouts
**Goal:** The last two families, and the two that stretch the model. Deployment needs nesting, which falls out of the Measure stage rather than needing a bigger engine: a container's intrinsic size IS the bounding box of its laid-out children, so layout recurses and dagre still suffices. It also needs one new render token, because once shapes nest the container and its children cannot both carry the tint — containers drop to white with a hairline so the deployed artifacts stay the figure. Block diagrams are the opposite problem: no layout at all. The agent positions them, they are born pinned, and floating text anchors to nothing.
- [ ] `parent` field on spec entities, giving nesting without a second spec shape
- [ ] Recursive Measure: lay out the innermost subgraph first, take its bounding box as the container's intrinsic size, hand that up to the parent layout as a single node. Nesting reuses the pipeline instead of pulling in elkjs
- [ ] Container render token: white fill, 1px #C3CBC9 stroke, tint reserved for the innermost things. Inverting this reads as one grey mass
- [ ] UML deployment notation: stereotypes in guillemets (mono 9.5px, muted), multiplicity on a node (×12), and undirected communication paths between nodes — correct, since a path says two nodes talk, not which one starts. No 3D box
- [ ] `free` layout strategy: entities carrying `at: {x, y}` are born pinned and layout leaves them alone — the escape hatch for block diagrams with many variants
- [ ] `shape: "none"` for floating text that anchors to nothing, plus circle (summing junction) and rotated triangle (gain) so an engineering signal chain reads by convention
- [ ] T115 — deployment: children nest inside their container, the container sizes to its contents, containers render white against tinted children, and communication paths carry no arrowheads
- [ ] T116 — block diagram: `at:` entities land where the agent put them and survive re-layout, floating text renders unanchored, and a rotated triangle points along the signal path
- [ ] SRS: REQ-DIAG ids for nesting and free placement; bump APP_VERSION to 0.34.2, full suite green, rebuild dist-template, commit, tag and release
### v0.34.3 — Component and composite structure diagrams
**Goal:** UML 2 treats these as two families, not one, and the composite view is the one worth getting right — it is where a design is actually specified rather than sketched. A component diagram says what depends on what: components, ports, provided and required interfaces, dependencies. A composite structure diagram opens a classifier up: parts labelled `role : Type` with a multiplicity, ports straddling the boundary, assembly connectors wiring one part's required interface to another's provided one, and delegation connectors carrying an outer port inward to the part that implements it. The design consequence worth naming: UML derives connector kind from a rule — a connector with an end on a port that is neither on a part nor a behavior port is a delegation, otherwise an assembly — so the agent names endpoints and the app decides what it drew, exactly like the rest of the pipeline. Needs one new primitive: sockets are half-circles and no arc shape exists.
- [x] `arc` shape type backed by `Konva.Arc`, oriented by the `rotation` field from v0.34.0. Required-interface sockets are half-circles and none of rect/circle/triangle/arrow/line can fake one
- [ ] Component entity: rounded box carrying the UML component icon (three rects) in the upper-right corner, with an optional stereotype in guillemets above the name
- [x] Port entity attached to an owner's boundary, with optional name and multiplicity. Public ports straddle the boundary, protected ports render inside it — the visibility distinction is carried by position, as UML intends
- [x] Provided interface (line + ball) and required interface (line + socket arc), attachable to a port or directly to a component; ball nests in socket where the two meet as an assembly
- [x] Derive connector kind from the UML rule rather than reading it off the spec: an end on a port that is neither on a part nor a behavior port makes it a delegation, otherwise an assembly. A spec that declares a contradictory kind gets a warning and the derived kind wins
- [ ] Enforce UML's ball-and-socket constraint: the notation is illegal for a complex port and for a part without ports, so refuse it there and say which rule was broken
- [ ] Delegation connector: from the delegating port to the receiving port or part, open arrowhead at the receiving end, and a single port may delegate to more than one subordinate
- [x] Part entity: rendered inside its structured classifier as `role : Type`, with multiplicity in the upper-right corner of the part box. Multiplicity shall be explicit in the spec — UML's defaulting rule reads differently across editions, so PowerNote will not guess it
- [x] Port-anchored edge routing in Materialize: an edge that terminates at a port anchors to the port's position on the boundary, not the owner's centre. Every other family routes to centres, so this is new plumbing
- [ ] Interface realization view: «interface» classifier box, dashed line with a hollow triangle for realization, dashed line with an open arrowhead for a «use» dependency
- [ ] Layout reuses what exists: `flow` for assembly views, the recursive nesting from v0.34.2 for composites. No new layout strategy — the novelty here is notation and anchoring, not placement
- [ ] T117 — component assembly: ports render on boundaries, a ball nests in its socket, and an edge terminating at a port anchors to the port rather than the box centre
- [ ] T118 — composite structure: parts render `role : Type` with corner multiplicity, public ports straddle and protected ports sit inside, connector kind is derived correctly for both delegation and assembly, and an illegal ball-and-socket is refused
- [ ] T119 — interface realization: realization renders with a hollow triangle at the interface end, «use» with an open arrowhead, and several components may point at one interface box
- [ ] SRS: REQ-DIAG-050..067 in SRS_DIAGRAM.md, plus `arc` added to the SRS_SHAPES additions; bump APP_VERSION to 0.34.3, full suite green, rebuild dist-template, commit, tag and release
- [x] Shipped 2026-08-13: reusable pipeline in `src/diagram/` (types, tokens, plantuml, layout, materialize, index) — pure and DOM-free apart from the injected text measurer, so layout is testable without a canvas
- [x] Shipped 2026-08-13: `DiagramRecord` on the page (identity + PlantUML source only, membership derived from `groupId` like ScrollRecord), `DiagramLayer` overlay badge anchored to the members' derived bounding box, and a source dialog that re-draws and lists diagnostics
- [x] T120 — 7 E2E tests: native shape/text output sharing one groupId, part role/type/multiplicity split, container-recedes tonality, individual select+move under group isolation, badge reopens its source, malformed input degrades to diagnostics, total garbage leaves the canvas intact
- [ ] Still open after the first cut: the UML component icon is not drawn (stereotype only), re-drawing replaces every member so manual moves are lost (the pin loop is v0.34.0), and there is no MCP verb yet — diagrams are user-authored through the dialog
- [x] Shipped 2026-08-13: diagram is a native node type — `NodeType` gained `'diagram'` with `DiagramNodeData { source, title }`, a `'diagram'` tool on the rail with click-to-place, and the source dialog rendered outside the Stage (a react-konva subtree is reconciled by Konva, so `createPortal` DOM children there throw on `getParent`)
- [x] Shipped 2026-08-13: `create_diagram` bridge command + MCP tool — agents pass PlantUML and get back the diagram id, element count, frame size and the diagnostics in one response. Placed below existing content in its column like `append_block`. A source that draws nothing is a PRECONDITION error rather than an empty frame. T121 covers it
- [x] Fixed 2026-08-13: pressing and dragging a grouped node in one motion tore the group apart — Konva starts dragging on mousedown, before any click selects, so `multiDragStart` fell back to the dragged node alone and a diagram frame moved without its contents. Group membership now decides what travels together when nothing is selected. General fix, not diagram-specific. T120 covers it
- [x] Descoped by the user 2026-08-13: frame resize reflowing its contents, and the pin loop — redrawing replacing all contents is acceptable, so pinned positions are not needed
### v0.35.0 — Scrolls you can see, make and keep
**Goal:** Scrolls have had identity since v0.31 but almost no affordances: only an agent can create one, the sidebar marks them with `Columns2` (which says "two panes", not "a named column of this page"), the title scrolls out of view the moment you read past it, and nothing helps content line up with the band it belongs to. Four fixes, validated as a prototype on 2026-08-13: the `ScrollText` icon; a "New scroll" row with inline naming; titles that pin to the top of the viewport while their band scrolls underneath; and a magnetic snap to scroll edges. The snap is deliberately NOT gated behind Shift the way node-to-node snapping is — lining up with the column you are writing in is the common case, and it stays a magnet rather than a constraint so a deliberate off-band placement still works by pulling past it.
- [x] Sidebar scroll entries use the `ScrollText` icon instead of `Columns2`
- [x] "New scroll" row under a page's scroll list: click reveals an inline input, Enter commits, Escape or an empty name cancels — an unnamed scroll draws no header, so creating one would be creating something invisible
- [x] Pinned scroll titles: the header holds at the top of the viewport while its band scrolls underneath, for every named scroll at once, and is visually marked while holding rather than resting
- [x] Magnetic snap to scroll edges when dragging a node: pulls to the band's left or right edge within a threshold, draws a guide while held, releases when pulled past — ungated, unlike the Shift-gated node-to-node snap in `calculateSnap`
- [ ] T122 sidebar icon + create, T123 pinned titles, T124 scroll snap; SRS_SCROLL REQ ids with test refs; bump APP_VERSION to 0.35.0, full suite green, rebuild dist-template, commit, tag and release
- [x] Fixed during the iteration: the "New scroll" row was rendered under EVERY page, which dropped the old `named.length === 0` early return and shifted the sidebar DOM — 3 page-navigation tests failed on it. The row is now offered on the open page only, which is also the right call: under every page it is noise and it is ambiguous which page a click adds to. Second fix: it reused the `.hierarchy-scroll` class, so scroll-count assertions saw an extra entry
### v0.35.1 — Swimlane activity diagrams
**Goal:** A second PlantUML grammar. Activity syntax (`start`, `:action;`, `if/then/else`, `|Lane|`) is a different language from the component one, so it gets its own parser rather than being bolted onto the existing regexes; `buildDiagram` sniffs which one a source is and routes. A swimlane chart is a flowchart plus a partition: the flow runs top to bottom in source order and the lane fixes the column, which means no graph engine is needed because the source already states the order. Decisions render as diamonds — a square turned 45 degrees, so the `rotation` field added for arcs pays for a third thing.
- [x] `src/diagram/activity.ts` — parser, lane layout and materializer for the activity grammar, with `looksLikeActivity` routing from `buildDiagram`
- [x] Lanes with headers and alternating bands, `start`/`stop` pseudostates, actions, and decisions rendered as diamonds via `rotation` on rect (now honoured by ShapeNode)
- [x] MCP `create_diagram` description rewritten to document BOTH grammars, the lane syntax, that coordinates cannot be supplied, and what is refused — so an agent can use it without guessing
- [x] T125 — 6 tests: grammar routing (and that component sources are not misrouted), lane partition, decision guards, refusal of fork/while/repeat, an agent drawing a swimlane over the bridge, and styling directives skipped in activity sources
- [ ] Known limitation, documented in the MCP description and the SRS rather than hidden: `if/else` branches render in source order, not as parallel paths that rejoin. True branching needs a merge point and sub-columns within a lane — that is where a graph layout would finally earn its place
### v0.36.0 — Multiple agents, one notebook
**Goal:** Several agents may connect at once but must not operate at once, and a blocked agent must be told who is holding the notebook. One MCP server process is spawned per agent session, so they race for the port: the winner becomes the HUB and owns the single app connection, the losers become PEERS and forward their tool calls to it. That keeps exactly one socket to the notebook — so the app needs no changes at all — and gives one obvious place for the lock. The hub hands out a lease held for the duration of a command and a short idle grace after it, released on idle, on agent disconnect, or when the notebook goes away.
### v0.36.1 — Fix in-app update, and gate releases on an upgrade test
**Goal:** In-app update has been silently broken. GitHub sends no CORS header on release-asset downloads: `browser_download_url` 302s to objects.githubusercontent.com and so does the API's octet-stream asset endpoint, so both fail from a page with a bare "TypeError: Failed to fetch" — and PowerNote is only ever a page. A third strategy using raw.githubusercontent.com did work, but it ran last, after two guaranteed failures, and fetched `main` rather than the release tag, so a successful update could install an unreleased build. Reordered so the CORS-clean path is first and pinned to the tag. Separately, nothing ran the tests on push at all: no CI workflow existed, only the release one. Added CI, gated the release on it, and added an upgrade regression test that loads a legacy-schema notebook into the real built artifact — the failure it guards against is silent and expensive.
- [x] `fetchAssetHtml` reordered: raw.githubusercontent.com at the RELEASE TAG first (the only CORS-clean route), release asset second as a fallback if GitHub ever adds the header, `main` last with a warning that it may be ahead of the release. `UpdateInfo` carries `tag`; `performUpdate` defaults it to `v{version}`
- [x] T131 — upgrade regression: a legacy-schema notebook (no scrolls, no settings, pre-v0.31) injected into the real `dist-template/index.html` must open with its content intact, hydrate the fields added since, and still edit and re-save. Served via route interception so no file is written to the repo
- [x] New `.github/workflows/ci.yml` — typecheck, lint, build the template, Playwright, and `test:bridge` on every push and PR. `release.yml` now runs the same suite before tagging, because a release that cannot be upgraded to is worse than no release. Note: the template is built BEFORE the tests, since T131 loads that exact artifact
### v0.37.0 — SVG imported as native canvas nodes
**Goal:** Turn a documented subset of SVG into ordinary ShapeNode/TextNode members of one group, so an imported drawing can be taken apart with the tools that already exist rather than sitting on the page as an opaque picture. Fidelity is the thing traded away for that, which is why the subset is small and everything outside it is refused BY NAME instead of being approximated: a polyline standing in for a bezier is a lie no later edit can undo.
- [x] `src/diagram/svg.ts` — pure `transpileSvg(source, {groupId, origin, measureText})`. Understands `<svg>` (viewBox/width/height, preserveAspectRatio "meet"), `<g transform>` with translate and uniform scale, `<rect>` (rx to cornerRadius), `<circle>`, `<ellipse>`, `<line>` (marker-end becomes an arrow node), `<polyline>`, `<polygon>`, and `<text>` with `<tspan>`; fill/stroke/stroke-width/stroke-dasharray from presentation OR `style` attributes, inherited down the tree [agent: svg-transpiler]
- [x] Refused by name, never silently dropped or approximated: `<path>`, `<image>`, `<use>`, gradients, patterns, filters, masks, `<clipPath>`, `<style>`, animation, nested `<svg>`; plus `fill="url(#…)"` paint, `filter`/`mask`/`clip-path` attributes, and any transform that is not translate or uniform scale (a Konva rotation turns about the node's own corner, not the user-space origin, so honouring `rotate()` would move the drawing) [agent: svg-transpiler]
- [x] Never throws: a missing DOMParser, an empty source, or malformed XML (re-read with the lenient HTML parser) all come back as diagnostics plus whatever could be understood. Diagnostics carry a real source line, recovered by scanning the raw text for open tags in document order since DOMParser reports no positions. Node and diagnostic budgets keep a pathological file from becoming the payload [agent: svg-transpiler]
- [x] T130 — 17 tests over the module directly (pure function, no canvas needed): geometry and paint of every supported element, viewBox scaling, nested translate/scale composition, style-over-attribute precedence, baseline and text-anchor placement, positioned vs restyling-only tspans, each refusal by name, malformed input, diagnostic line numbers, the DOMParser guard, and the node budget [agent: svg-transpiler]
- [x] Known losses, stated in diagnostics rather than hidden: a polygon is drawn edge by edge so its fill is dropped; opacity has no canvas equivalent; per-run styling inside `<text>` is folded into the line; elliptical `rx`/`ry` corners collapse to one radius; `font-family` is replaced by the app's own so imports do not arrive in a foreign font [agent: svg-transpiler]
- [ ] Not wired to anything yet — `transpileSvg` is exported from its own module and is not reachable from `buildDiagram`, the dialog or the MCP. Routing it (and deciding whether an SVG import is a diagram frame or a plain group) is owned elsewhere [agent: svg-transpiler]
### v0.38.0 — Mermaid as a second diagram language
> **Goal:** Name the diagram tool after the format it takes, and add Mermaid as a second language. `create_diagram` became `create_diagram_plantuml` — the two PlantUML dialects stay sniffed apart INSIDE it, because component and activity are one language with two grammars, while Mermaid is a different language and a model choosing between two named tools is choosing the thing it actually knows. Only the PARSER differs: `src/diagram/mermaid.ts` produces the same spec types, so measure, layout and materialize are shared and a Mermaid flowchart looks like it belongs in the same notebook as a PlantUML component diagram. The subset is documented and everything outside it is refused by name, on the same principle as the SVG transpiler: a shape approximated is a lie no later edit can undo.
- [x] MCP `create_diagram` renamed to `create_diagram_plantuml`, description narrowed to PlantUML's two dialects. New `TOOL_ROUTES` in `server.js` maps both diagram tools onto the one `create_diagram` app command carrying a `format` — the tool is named for the language, the command is one because after parsing the language is just which parser ran [agent: mermaid]
- [x] `src/diagram/mermaid.ts` — tolerant parser for `flowchart`/`graph` (nodes `A[..]`, `A(..)`, `A{..}`, edges `-->`, `-->|label|`, `---`, chains) and `sequenceDiagram` (`participant`, `->>`, `-->>`), producing the EXISTING spec types so measure/layout/materialize are reused. Never throws; bracketed label spans are masked before the link scan so `A[a --> b]` is not torn in half [agent: mermaid]
- [x] Two additive fields on `DiagramRelationship` rather than a forked renderer: `flow` (a guard on a flowchart arrow must not derive a ball-and-socket assembly the way a labelled component link does) and `arrowhead` (Mermaid `---` is undirected). One line each in `layout.ts` and `materialize.ts`; both absent for every existing PlantUML source, so behaviour there is unchanged [agent: mermaid]
- [x] `buildDiagram` takes an optional `format`; absent it sniffs, and Mermaid's header-line sniff runs first because it is a read rather than a guess. A DECLARED format contradicted by the source is refused — PlantUML would otherwise render an entity literally named `A[Read sensor]`. Bridge `create_diagram` gained the `format` param and returns which grammar drew it; the redraw dialog leaves it off so the grammar follows what the user typed [agent: mermaid]
- [x] T126 — 10 tests: header detection (and that neither PlantUML grammar is misrouted), the spec types a flowchart parses into, chains and bare ids, the direction notice, every refusal by name, a labelled flow edge staying an arrow, an agent drawing a flowchart and a sequence over the bridge, and the declared format being enforced rather than a hint. `test:bridge` gained 5 checks that the tools are named for their language and route with the format. SRS REQ-DIAG-090..099 [agent: mermaid]
- [ ] Known limitations, stated in the tool description, the README and the SRS rather than hidden: direction is not honoured (the shared layout is one left-to-right row, so `flowchart TD` reports its direction as skipped); a sequence renders as participants side by side with NUMBERED messages, not lifelines, so two messages between the same pair share a line; `{decision}` renders as a box stereotyped «decision» because the shared layout has one box shape. Subgraphs are refused — mapping them onto containers is the obvious next win [agent: mermaid]
### v0.39.0 — Group edit you can find, and a toolbar for diagrams
**Goal:** Isolation mode already exists but is reachable only by double-click, Ctrl+Enter or the context menu, so nothing on screen says it is there. Meanwhile the bottom toolbar has no 'diagram' context at all and renders nothing when a diagram is selected, and the one control the frame does carry is a button hardcoded to read "plantuml" — wrong for every SVG and Mermaid diagram. Give the selection toolbar a group segment: a way IN when the selection belongs to a group, a way OUT whenever isolation is active regardless of what is selected inside it, and for a diagram the source-format label derived from the source rather than assumed.
- [x] `BottomToolbar` gains a group segment rendered independently of the node-type contexts, so it also shows for a diagram (which matched no context and therefore rendered nothing at all). Enter is offered when the single selection carries a `groupId` or is a diagram frame; Done is offered whenever `editingGroupId` is set, whatever member is selected inside
- [x] Diagram context in the toolbar: source-format label DERIVED from the source by the existing sniffer, not stored on the node and not assumed. `DiagramNode`'s on-frame button stops being hardcoded to "plantuml" — an SVG diagram said plantuml on its face
- [x] `GroupIsolationBar` FOLDED INTO the toolbar rather than kept beside it. The plan was to keep both, until the CSS said otherwise: the breadcrumb floated at `bottom: 56px` and the toolbar at `bottom: 16px` with ~44px of height, so shipping both would have put two floating bars in the same strip of screen, each with its own Done. Its content — the mode label and the exit — is now the toolbar's editing state, dark-filled so the mode still reads at a glance. `group-isolation-bar` and `group-isolation-done` are carried over as testids, so the contract T93 asserts is unchanged and the move is provably behaviour-preserving
- [x] E2E: entering and leaving isolation from the toolbar, the button appearing for a diagram where the bar was previously empty, Done showing while a MEMBER (not the frame) is selected, and the format label reading mermaid/svg/plantuml for each. SRS_SHAPES REQ-GROUP ids + SRS_DIAGRAM
- [x] A diagram had NO context menu, so no layer control: `useContextMenu` walks up from the click looking for a `Rect` carrying the node id, and `DiagramNode`'s frame Rect never set one. Added `id={node.id}`, which is what ShapeNode, ImageNode and GanttNode all already do
- [x] Layer changes on a diagram move the WHOLE drawing, via a group-aware paint order (`src/utils/zOrder.ts`) rather than by rewriting member layers. A diagram's marks already use all five layers among themselves — containers at 2 behind entities at 3, links at 4 under text at 5 — so there is nowhere to shift them to, and flattening them would let a later entity's box paint over an earlier entity's label. The frame's layer is therefore a BAND its members sort inside, with the frame itself pinned to the back of it
### v0.40.0 — Background per page, with a notebook default
**Goal:** Guide style and canvas colour are notebook-wide (WorkspaceSettings on WorkspaceData), so a notebook cannot hold a grid page next to a scroll page. Make them an optional per-page override resolved at read time: absent means inherit the notebook default, which is what every existing page already is, so no migration and no behaviour change on load. The settings panel gains a scope switch and a way to drop a page back to the default. The MCP surface keeps defaulting to notebook scope — agents already call set_background expecting notebook-wide, and quietly re-pointing a shipped tool at the current page is the same break we made renaming create_diagram.
- [x] `Page.settings?: Partial<WorkspaceSettings>` — an override, not a copy. A `resolvePageSettings(page, workspace)` helper is the ONLY read path, so inheritance cannot be forgotten at one call site
- [x] Workspace store: `updatePageSettings` / `clearPageSettings`, both marking dirty like `updateSettings`. Setting the notebook default does NOT retro-apply to pages that already carry an override — an override is an explicit choice, and silently overwriting it would lose work
- [x] Settings panel: scope switch (This page / All pages) plus "Use notebook default" to drop an override, shown only when one exists. `AppShell` reads through the resolver so switching pages repaints the canvas
- [x] MCP `get_background` / `set_background` gain `scope: 'notebook' | 'page'`, DEFAULTING TO NOTEBOOK so existing agent calls keep their current meaning. `get_background` reports the effective values and where each came from
- [x] E2E: a page override surviving save/load, a page WITHOUT one following a changed notebook default, switching pages repainting, clearing an override, and the MCP default staying notebook-scoped. SRS_SETTINGS new REQ ids
### v0.41.0 — An undo button, and one definition of which history to unwind
**Goal:** Undo existed only on Ctrl+Z, which is invisible. Add a button in the top bar left of zoom-to-fit. Two things made this more than a button: the routing rule (Ctrl+Z unwinds STROKES while a drawing tool is active and NODES otherwise) existed once inside the keyboard handler and would have been copied a second time into the button, and the undo stacks are module-level rather than store state — correctly so, since they hold node snapshots that must never be serialized into the notebook — which means React cannot see them change and a naive button would be permanently stuck in whatever state it first rendered.
- [x] `src/utils/undoOps.ts` — `undoActive`/`redoActive`/`canUndoActive`/`canRedoActive`, the tool-routing rule stated once. `useCanvasKeyboard` now calls it instead of carrying its own copy, so the button and Ctrl+Z cannot drift apart about which of the two stacks to unwind
- [x] Enabled state derived on render, subscribed indirectly through `nodes`, `strokes` and the active tool. The stacks stay module-level — putting them in the store to make them reactive would risk snapshots reaching the saved file, which is a far worse bug than a stale button
- [x] T134 — 5 tests. The load-bearing ones are that it starts disabled, ENABLES ITSELF after an action (the assertion that fails if the state is read only once), disables again when history runs out, and that button and Ctrl+Z unwind one shared history. SRS REQ-CANVAS-010, REQ-CANVAS-011
### v0.42.0 — Mobile & Pen Input (S Pen / Surface Pro) (current) (ACTIVE)
**Goal:** Drawing works like Samsung Notes / Surface: pen draws with pressure and palm rejection, the pen's eraser end erases, fingers draw or pan/pinch depending on a touch-draw mode, and the shell behaves on a touch device — no browser zoom/scroll fighting the canvas, and toolbar targets reachable with a finger.
- [x] Pointer-event drawing pipeline: Stage draw handlers move from mouse events to pointer events so pen, finger and mouse all reach the draw/erase/shape/lasso tools; `pointerType` and per-point `pressure` are captured at the source
- [x] Pressure-sensitive ink: `Stroke` gains optional `pressures[]`; pen strokes render as a variable-width ribbon (outline polygon), mouse/finger strokes and every existing saved stroke render exactly as before
- [x] Palm rejection and finger modes: touch-draw setting `auto | always | never` (auto = finger draws until a pen is first seen, then fingers pan); touch input ignored while the pen is down; a second finger cancels the in-progress stroke and hands over to pinch-zoom; single finger pans in draw mode when fingers don't draw
- [x] Pen eraser end: holding the stylus eraser (buttons bit 32, S Pen / Surface eraser tip) erases while held using the current eraser settings, and returns to inking on lift — no toolbar round-trip
- [x] Mobile shell: `touch-action: none` + `overscroll-behavior: none` on the canvas so the browser never scrolls/zooms the page out from under a stroke; viewport meta pinned (`maximum-scale=1, user-scalable=no, viewport-fit=cover`); coarse-pointer media query grows toolbar targets to ≥44px and lets the bottom toolbar scroll horizontally on narrow screens
- [x] E2E T135–T137 (pen pointer drawing with pressure, touch modes & palm rejection, mobile shell) + SRS_DRAW REQ-DRAW-010..014; full Playwright suite green; showcase artifact published
### v0.43.0 — Touch UX round 2 — selection, editing and toolbar on touch
**Goal:** v0.42 made ink and gestures work; this round makes EDITING work without a mouse: long-press replaces right-click (REQ-CANVAS-028, open since v0.11.4), double-tap replaces double-click for text editing, transform handles grow to finger size, and the bottom toolbar's popovers learn to escape their box so the narrow-screen fix deferred from v0.42 (T11 clipping) can land properly.
- [x] Long-press on a node (select tool, touch) selects it and opens the context menu — the touch replacement for right-click (REQ-CANVAS-028, T138); verify first whether Chromium's native long-press contextmenu already reaches the existing handler under touch-action:none
- [x] Double-tap on a text node opens the editor on touch, mirroring double-click (T139) — audit every onDblClick in canvas nodes for a missing onDblTap twin
- [x] Transformer resize/rotate anchors grow to finger size on coarse pointers (T140) — 36px-precise anchors are unhittable with a thumb
- [x] Bottom toolbar popovers escape the toolbar box (fixed-position or portal), then the toolbar itself may scroll on narrow screens — properly landing what T11 forced v0.42 to revert (T141)
- [x] Full Playwright suite green (513 existing + new T138–T141); SRS updated (REQ-CANVAS-028 implemented, toolbar/canvas additions); showcase artifact updated with the new records
### v0.44.0 — Phone-width chrome — the bars stop fighting for the bottom edge
**Goal:** T141's screenshots caught the ZoomBar sitting ON the bottom toolbar at 390px (both bottom:16px, z-index:30 — the ZoomBar steals the toolbar's taps). Fix that collision properly, then audit the rest of the chrome (TopBar, HierarchyPanel) at phone widths and fix what is actually unusable — reachable buttons, no overflow, panels that overlay instead of squeezing the canvas.
- [x] ZoomBar and bottom toolbar share the bottom edge without overlap at any viewport width; every toolbar button receives real coordinate taps (T142) — the T141 workaround of DOM-level clicks becomes unnecessary and is removed
- [x] Phone-width chrome audit at 390x844: TopBar and HierarchyPanel usable — no overflow, no unreachable controls; minimal fixes only, with findings reported for anything bigger (T143)
- [x] Full suite green; SRS_TOOLBAR/SRS_CANVAS updated as touched; showcase artifact appended with the collision fix shown at 390px
### v0.45.0 — A notebook in your pocket — hierarchy drawer and home-screen install
**Goal:** The last structural phone-width gap from the v0.44 audit: the hierarchy sidebar's fixed 240px leaves ~100px of canvas on a phone, so below the 768px breakpoint it becomes an overlay drawer instead of a grid neighbour. And since the app now behaves on tablets, let it install like an app: a web manifest and icons so Android/Windows offer add-to-home-screen (service worker offline support deliberately deferred).
- [x] Below 768px the HierarchyPanel opens as an overlay drawer (slides over the canvas with a backdrop; closes on outside tap, Escape, or picking a page) instead of sharing the grid; at ≥768px nothing changes (T144)
- [x] Web app manifest + icons: installable to the home screen on Android/Windows tablets; service worker / offline explicitly deferred and documented (T145)
- [x] Full suite green; SRS_HIERARCHY (drawer) + SRS_SETTINGS or new SRS row for install; showcase artifact appended
## Future (Backlog)
> Not yet planned — will be prioritized when earlier iterations are complete. Paid tier moved to `docs/VISION.md`.

- **Editable Gantt (PowerPlanner)** — Today the embed is intentionally read-only (`pointerEvents: none` + read-only `GanttRenderer`). Future: double-click / edit mode to change tasks & dates, persist `node.data.doc` on save, optional deep-link into PowerPlanner for full editing
- **Collapsible Containers** — Canvas-in-canvas named frames (deferred from v0.2); flat shape/stroke groups land in v0.27.0 first
- **Template Gallery** — Pre-built page templates (meeting notes, project plan, etc.)
- **Advanced Diagram Tools** — Connectors, flowcharts, mind maps
- **Mobile App** — React Native or PWA for tablet/phone
- **Plugin System** — Community extensions
- **Database/Table Blocks** — Notion-style structured data on canvas

See `docs/VISION.md` for deferred post-MVP items (cloud sync, collaboration, paid tier) that depend on cloud deployment infrastructure.
- **PDF Export** — Export the current page as PDF (browser print API, or html2canvas + jsPDF), with A4 page guides driving the page breaks and all visible elements included (text, images, shapes, drawings). Moved from PLAN v0.14.0 on 2026-08-11, unstarted. Needs REQ-EXPORT ids and an SRS_EXPORT.md
- **Image Export (PNG/SVG)** — Export the current page as PNG via Konva `Stage.toDataURL`, with configurable resolution/scale; optional SVG export for vector quality. Moved from PLAN v0.14.1 on 2026-08-11, unstarted — no `toDataURL`/`toBlob` call exists anywhere in `src/`
- **Print Support** — Ctrl+P triggering browser print with print CSS that hides the nav rail, toolbar and hierarchy panel, and lays content out for A4. Moved from PLAN v0.14.2 on 2026-08-11, unstarted — no `@media print` block and no `window.print` call exist
