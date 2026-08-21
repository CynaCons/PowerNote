# Design: draw.io as a fourth diagram language

**Project:** PowerNote
**Status:** Proposed (v0.46.0–v0.49.0)
**Date:** 2026-08-17
**Scope chosen by user:** import as native nodes · agent MCP tool · round-trip export.
**Explicitly out of scope:** embedding the draw.io editor.

## Thesis

draw.io is not a new feature — it is a fourth `DiagramFormat` in the pipeline that
already serves PlantUML, Mermaid and SVG. A `.drawio` import lands as the same
`DiagramNode` frame with the same badge, the same redraw dialog, the same
group-band paint order, and the same philosophy the SVG transpiler established in
v0.37: a documented subset transpiled to ordinary ShapeNode/TextNode members, and
everything outside it **refused by name** rather than approximated — a polyline
standing in for a curve is a lie no later edit can undo.

## How it slots into what exists

| Concern | Existing mechanism | draw.io change |
|---|---|---|
| Entry point | `buildDiagram(source, opts)` in `src/diagram/index.ts` | new `format: 'drawio'` branch calling `transpileDrawio` (like the `'svg'` branch, skipping measure/layout — mxGraph geometry IS geometry) |
| Format sniffing | `sniffFormat` — `<?xml`/`<svg` → svg, mermaid header, else plantuml | test `<mxfile`/`<mxGraphModel` **before** the SVG check — mxGraph XML also starts with `<?xml`, so order is load-bearing |
| Canvas life | `type:'diagram'` frame; members = `groupId === frame.id`; source stored on `DiagramNodeData.source` | identical; store the **uncompressed** XML as source so the redraw dialog shows something a human can edit |
| Format badge | `formatLabels.ts` + live sniff of `data.source` | add `drawio: 'draw.io'` |
| Agent access | `TOOL_ROUTES` in `powernote-mcp/server.js` → one `create_diagram` command with `format` | new `create_diagram_drawio` tool; description documents the subset and each refusal verbatim, in the house style of `create_diagram_svg` |
| Transpiler contract | `transpileSvg(source, {groupId, origin, measureText})` → `{nodes, diagnostics}`; never throws; `NODE_BUDGET`/`DIAGNOSTIC_BUDGET` | same signature and guarantees for `transpileDrawio` in `src/diagram/drawio.ts` |

Also fixed en route (found while mapping): `DiagramNodeData.source`'s doc comment
still says "PlantUML source" — stale since v0.37; correct it.

## The mxGraph model, and what we accept

A `.drawio` file is `<mxfile>` containing one or more `<diagram>` pages; each page
is an `<mxGraphModel>` whose `<root>` holds `<mxCell>` elements. Vertices carry
`vertex="1"`, an `mxGeometry` (x, y, w, h — **relative to their parent cell**),
a `style` string of `key=value;` pairs, and a `value` label. Edges carry
`edge="1"`, `source`/`target` cell ids, optional `mxPoint` waypoints.

**Compression:** draw.io frequently stores the page XML base64 + raw-deflate +
URI-encoded. Decompress with the browser-native `DecompressionStream('deflate-raw')`
— no new dependency. Normalization is async and happens once at ingestion; the
stored `source` is always the readable, uncompressed XML.

**Multi-page files:** import the **first page** and emit an `ignored` diagnostic
naming the pages skipped ("page 2 'Backend' skipped — one frame holds one page").
One frame per page (import all pages side by side) is a later option, not v0.46.

### Vertex mapping

| draw.io construct | PowerNote primitive |
|---|---|
| default / `rounded=0` rectangle | `rect` |
| `rounded=1` rectangle | `rect` + `cornerRadius` |
| `ellipse` | `circle` (Ellipse sized to box — same as SVG import) |
| `rhombus` | `rect` + `rotation: 45` fitted to the cell box (the v0.35.1 decision-diamond trick) |
| `triangle` | `triangle` |
| label (`value` on any vertex) | `TextNode` centred in the cell, measured with the pipeline's `measureText` |
| standalone `text` style cell | `TextNode` |
| group / container / `swimlane` | flattened: an ordinary `rect` (+ title `TextNode` for swimlanes) and children as siblings sharing the one `groupId`; parent-relative geometry resolved to absolute during the walk. No `parentId` exists in the data model, by design |
| `fillColor`, `strokeColor`, `strokeWidth`, `dashed=1`, `dashPattern` | `fill`, `stroke`, `strokeWidth`, `strokeDash[]` |
| `rotation` on a **rectangle** | `rect.rotation` (the only shape besides `arc` whose Konva component renders rotation) |

### Edge mapping

| draw.io construct | PowerNote primitive |
|---|---|
| straight edge, `endArrow != none` | `arrow` (signed direction vector, like `materialize.ts`'s `pushSegment`) |
| straight edge, `endArrow=none` | `line` |
| orthogonal edge **with explicit waypoints** | decomposed into 2-point `line`/`arrow` segments per bend — faithful, since every segment is straight (the `emitPolyline` precedent) |
| edge label | `TextNode` at the midpoint of the longest segment |
| `dashed=1` | `strokeDash` |

### Refused by name (the `REFUSED` map, messages say *why*)

- **Curved edges** (`curved=1`, rounded routing) — the canvas has no bezier
  primitive; a straightened curve misstates the drawing (same rationale as SVG's
  `<path>` refusal).
- **Edges without explicit waypoints whose router would bend them**
  (`edgeStyle=orthogonalEdgeStyle` with no `mxPoint`s) — the bends live in
  draw.io's router, not in the file; reproducing them means reimplementing the
  router, and a straight line is not what the user drew. Diagnostic suggests
  right-click → "Edit connection" in draw.io to make waypoints explicit… or
  accept the straight-line rendering via a declared option later.
- **Rotation on anything but a rectangle** — `circle`/`triangle`/`line` Konva
  components ignore `rotation`; silently dropping it would misplace the drawing.
- **Custom stencils** (`shape=…` beyond the accepted list: mscae/aws/cisco/UML
  stencil libraries) — each is a little rendering program; name the stencil in
  the diagnostic.
- **Images in cells** (`image=…` style), **gradients** (`gradientColor`),
  **HTML-formatted labels** beyond plain text (labels are stripped of simple
  `<br>`/entities; anything with real markup → refusal naming the cell),
  **sketch/rough style**, **nested `mxGraphModel`**.

## Ingestion (v0.48)

`useCanvasDragDrop.ts` currently accepts only `image/*` — and that gate **eats
real `.svg` files** today (browser reports `image/svg+xml`, so a dropped SVG
becomes an opaque raster-path image instead of native nodes). The fix and the
feature are the same change: an extension/MIME gate **ahead of** the image
check —

- `.drawio` / `.xml` sniffing as mxGraph → new diagram frame via `buildDiagram`
  at the drop point;
- `.svg` → routed to the existing SVG transpiler (behaviour change from
  "becomes a picture" to "becomes native nodes" — flagged for veto below);
- everything else falls through to the image path unchanged.

Paste: mxGraph XML pasted into the existing DiagramSourceDialog already works
once `sniffFormat` knows the format; no new paste UI in scope.

## Round-trip export (v0.49)

`src/diagram/drawioExport.ts`, reachable from the diagram frame's context menu /
selection toolbar ("Export as .drawio"), downloading `<title>.drawio`.

- **Tier 1 — verbatim:** a frame whose `source` sniffs as drawio and whose
  members haven't been rebuilt since import exports its stored XML unchanged.
  Trivially lossless.
- **Tier 2 — mapped:** any diagram frame or flat group exports by reverse
  mapping: `rect(+cornerRadius→rounded=1, rotation)`, `circle→ellipse`,
  `triangle`, `line`/`arrow`→edges (or floating edges when unconnected),
  `TextNode`→`text` cells, colours/dash back to style strings. `arc` (the UML
  socket) exports as a half-circle stencil approximation **or** is named in an
  export report — decided during v0.49 with a real file in draw.io.
- Contract test: exported XML parses back through our own `transpileDrawio` to
  the same node set (round-trip closure), plus a manual open-in-app.diagrams.net
  verification for each release.

## Iterations

| Iteration | Content | Tests | SRS |
|---|---|---|---|
| **v0.46.0** | `transpileDrawio` core: mxfile/page/cell parse, deflate normalization, vertex subset + styles, container flattening, REFUSED map, sniff ordering | T146 | REQ-DIAG-110..119 |
| **v0.47.0** | edges (straight + waypoint decomposition, arrowheads, labels), `create_diagram_drawio` MCP tool + routing, format badge, stale source-comment fix | T147 | REQ-DIAG-120..126 |
| **v0.48.0** | drag-drop/paste ingestion gate; `.svg` drop rerouted to transpiler; multi-page diagnostic | T148 | REQ-DIAG-127..129 (+ SRS_CANVAS ingestion row) |
| **v0.49.0** | export tiers 1+2, context-menu entry, round-trip closure test | T149 | REQ-DIAG-130..135 |

Every iteration ends the standard way: full Playwright suite green, SRS updated,
showcase artifact appended with real screenshots.

## Decisions awaiting veto

1. **Rhombus → rotated rect** (usable diamond) vs refusing rhombus outright.
   Proposed: map it — the rotation trick is already load-bearing for decisions.
2. **Router-bent edges without waypoints**: refuse (proposed) vs render straight
   with an `ignored` diagnostic.
3. **Dropped `.svg` becomes native nodes** instead of an image — a behaviour
   change for anyone who liked SVGs as pictures. Proposed: native nodes, since
   an image drop can still be achieved by converting to PNG.
4. **Multi-page: first page + named skip diagnostic** vs one frame per page.
5. **HTML labels**: strip simple formatting to plain text (proposed) vs refuse
   any HTML-valued label.

---

# Addendum (v0.64): viewer snapshot rendering — spike findings

**Date:** 2026-08-21. The transpile-first approach above remains as fallback and
explicit escape (`render:'nodes'`), but the default draw.io display becomes an
exact SVG snapshot rendered by the official viewer (`viewer-static.min.js`,
4,151,471 bytes raw → 1,161,704 bytes deflate-raw+base64), shipped as an
extension asset, never part of the base bundle. Full plan: v0.64/v0.65 in
PLAN.md.

## Spike results (verified on http AND file://, headless Chromium)

| Question | Answer |
|---|---|
| Offline execution | **Zero follow-up network requests** once three knobs are set (below). Verified via request listener on both origins. |
| Render API | `GraphViewer.createViewerForElement(el)` with `data-mxgraph` attr = JSON `{xml, nav:false, resize:false, toolbar:null, 'auto-fit':false}`. Container: imperative `document.body` child, `position:fixed; left:-10000px`, explicit size. First `<svg>` inside is the artwork; set width/height (getBBox fallback), serialize, base64 data URI. |
| foreignObject | draw.io HTML labels land as `<foreignObject>`; the SVG data URI **loads in `new Image()`, draws to canvas untainted, and re-rasterizes crisply at 3×** in Chromium. No `mxClient.NO_FO`, no PNG fallback needed. |
| Perf | inflate ≈30 ms + eval ≈150 ms, once per session. Render ≈12 ms warm and cold. Torture SVG ≈10 KB. |
| Compression | `atob` → `DecompressionStream('deflate-raw')` round-trips the viewer byte-exact (the spike itself ran through it). |

## The three network knobs (all load-bearing)

1. **Before eval:** `window.DRAW_MATH_URL = 'data:text/javascript,//'` — the
   build tail calls `Editor.initMath()` unconditionally and resolves
   `DRAW_MATH_URL + '/startup.js'` at call time; the data: comment makes that a
   no-op. (Math typesetting in labels is therefore off — accepted limitation.)
2. **Before eval:** define `window.onDrawioViewerLoad = () => {}` — official
   hook; the bootstrap then skips `GraphViewer.processElements()`, so the
   viewer never scans the document on its own.
3. **After eval:** `mxStencilRegistry.dynamicLoading = false` — stencil XMLs
   (aws4 etc.) are otherwise fetched by **synchronous XHR at render time**
   (~800 ms stall online, failure offline). Disabled, a library shape renders
   as its styled box + label: deterministic on- and offline. A vendored
   stencil-pack extension is a backlog item.

Also observed: `mxStencilRegistry.allowEval = false` is already set by the
build tail, and HTML labels pass through the bundled DOMPurify
(`window.DOM_PURIFY_CONFIG`).

## Decision

Store the **SVG data URI as-is** in `DiagramNodeData.render.src`
(`DiagramRenderSnapshot`). `mxLoadResources/mxLoadStylesheets/mxForceIncludes`
are additionally set false before eval (standard mxGraph flags). The loader
executes the inflated source via an injected classic `<script>` element —
removed synchronously after execution so 4 MB of JS never lands in
`outerHTML`-based saves — because top-level `var`s must become window globals
(`new Function` would scope them away).
