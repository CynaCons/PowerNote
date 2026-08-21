# SRS: Diagrams

**Project:** PowerNote
**Version:** 0.61.1
**Date:** 2026-08-17

## Purpose

Let an agent draw diagrams on the canvas using the same elements a user draws by hand. A diagram is authored as a **spec** — entities and the relationships between them — and rendered by the app into native `ShapeNode` and `TextNode` objects inside a bounded **diagram frame** that sits in a scroll like any other block.

The division of labour is the point. The agent supplies semantics: what exists and what connects to what. The app supplies geometry: how wide a box must be to hold its label, where the boxes go, how the edges route. An agent that guesses coordinates produces overlapping boxes and overflowing labels; an agent that names entities does not.

Because the output is ordinary canvas objects, the user can drag, restyle and delete any part of a generated diagram the moment it appears.

## Implementation status

This document specifies more than has shipped. Requirements are written ahead of
implementation on purpose, but the difference matters when reading it:

| Area | State as of v0.54.0 |
|------|---------------------|
| Diagram node, PlantUML parsing, layout, materialize | Shipped — REQ-DIAG-001, 006, 010..014, 017, 040..046, 050..067, 070..076 |
| Activity and swimlane grammar | Shipped — REQ-DIAG-070..076 |
| Mermaid flowchart and sequence subset | Shipped — REQ-DIAG-090..099 |
| Agent authoring over the bridge | Shipped — `create_diagram_plantuml`, `create_diagram_mermaid`, `create_diagram_svg`, `create_diagram_drawio` |
| draw.io vertices, sniff, compression | Shipped — REQ-DIAG-110..119 |
| draw.io edges and `create_diagram_drawio` | Shipped — REQ-DIAG-120..126 |
| File ingestion (drop/paste of drawio + svg) | Shipped — REQ-DIAG-127..129 |
| draw.io round-trip export | Shipped — REQ-DIAG-130..135 |
| Fit diagram to the scroll it lands in | Shipped — REQ-DIAG-136..139 |
| Frame-deletion cascade + `delete_diagram` | Shipped — REQ-DIAG-140..141 |
| Agent `read_page` diagrams index + label-leak closed | Shipped — REQ-DIAG-006 (v0.34.0 debt closed in v0.54.0; T159) |
| On-demand fit to scroll (both directions) | Shipped — REQ-DIAG-142 |
| draw.io ports, orthogonal routing, UML module/component | Shipped v0.59 — REQ-DIAG-143..148 |
| Frame reflow and document flow (REQ-DIAG-002..005) | **Shipped v0.61 on every scroll.** Guide style is visual. insert/move/height-change pack the band, including default pages notebooks. Human drag never reflows. |
| Pin loop (REQ-DIAG-020..023) | **Not built, and descoped 2026-08-13.** Redrawing replaces every content node, so a manual nudge is lost on the next redraw |
| Geometric warnings (REQ-DIAG-016) | **Partial.** Parse diagnostics ship; overlap, crossing and density checks do not |
| Sequence and state layouts (REQ-DIAG-031..035) | Not built |
| Positional membership (REQ-DIAG-007..008) | Not built. Membership is by `groupId`, but dragging a mark out does not rewrite the source |

## Definitions

| Term | Meaning |
|------|---------|
| Frame | A titled, bounded region holding one diagram's spec and its rendered elements |
| Spec | The agent-authored description: entities, relationships, layout intent |
| Entity | One thing in the spec, identified by an agent-authored string id |
| Relationship | A directed link between two entity ids |
| Materialize | Turning laid-out geometry into native canvas nodes |
| Pinned | A rendered element the user has moved, treated as a fixed constraint |
| Part | A role inside a structured classifier, labelled `role : Type` with a multiplicity |
| Port | An interaction point on a classifier's boundary, optionally named and typed |
| Assembly | A connector joining one part's required interface to another's provided one |
| Delegation | A connector carrying an outer port inward to the part that implements it |

## Requirements

### Frame and document integration

| ID | Description | Priority | Test Ref |
|----|-------------|----------|----------|
| REQ-DIAG-001 | The app shall provide a diagram frame: a titled, bounded canvas region holding a diagram spec and its rendered elements | Must | T111 |
| REQ-DIAG-002 | A diagram frame shall occupy its scroll like a text block, with an intrinsic height derived from its contents. Members and group ink travel with the frame by the same dy. Guide style does not gate this. | Must | T110 |
| REQ-DIAG-003 | When a block or frame's height changes, occupants below it in the same band shall move down; when it shrinks, they shall close the gap | Must | T110 |
| REQ-DIAG-004 | Reflow shall be scoped to the affected column, leaving other columns unchanged | Must | T110 |
| REQ-DIAG-005 | A frame, its spec and its rendered elements shall survive a save/load round-trip | Must | T110 |
| REQ-DIAG-006 | A frame shall appear in agent-facing reading order identified by its title, without expanding its children into the block list. Closed in v0.54.0: `read_page` returns `diagrams[]` `{id, title, format, memberCount, bounds}` and excludes every `groupId`-owned text node from `blocks[]` (the v0.34.0 label-leak / invisible-frame debt) | Must | T159 |
| REQ-DIAG-007 | An entity shall belong to the frame its rendered element physically sits in; an element dragged outside the frame shall drop its entity from the spec | Must | T112 |
| REQ-DIAG-008 | Deleting a rendered element shall drop its entity from the spec | Must | T112 |

### Pipeline

| ID | Description | Priority | Test Ref |
|----|-------------|----------|----------|
| REQ-DIAG-010 | The agent shall supply entities and relationships only; the app shall compute every coordinate and dimension | Must | T111 |
| REQ-DIAG-011 | An entity's intrinsic size shall be computed from the rendered text metrics of its label, never supplied by the agent | Must | T111 |
| REQ-DIAG-012 | Entity positions shall be computed by a layout engine and snapped to a grid | Must | T111 |
| REQ-DIAG-013 | Rendered output shall consist of native `ShapeNode` and `TextNode` objects sharing the frame's `groupId` | Must | T111 |
| REQ-DIAG-014 | Rendered elements shall be selectable, draggable and resizable with the existing canvas tools | Must | T112 |
| REQ-DIAG-015 | A write to a frame's spec shall return the computed geometry and the warning list in the same response | Must | T111 |
| REQ-DIAG-016 | Warnings shall cover label overflow, node overlap, edge crossings, out-of-frame content, orphan entities and excess density | Must | T111 |
| REQ-DIAG-017 | A relationship shall reference its endpoints by agent-authored entity id, never by coordinate | Must | T111 |
| REQ-DIAG-018 | A spec exceeding the supported entity count shall be refused with an error naming the limit | Should | T111 |

### Editing and re-layout

| ID | Description | Priority | Test Ref |
|----|-------------|----------|----------|
| REQ-DIAG-020 | A rendered element moved by the user shall be marked pinned | Must | T112 |
| REQ-DIAG-021 | Re-layout shall treat pinned elements as fixed constraints and place everything else around them | Must | T112 |
| REQ-DIAG-022 | Reading a frame shall return its spec, computed geometry, warning list, and which entities are pinned | Must | T111 |
| REQ-DIAG-023 | Updating a frame shall add, remove and relabel entities and relationships without discarding pinned positions | Must | T112 |

### Layout strategies

| ID | Description | Priority | Test Ref |
|----|-------------|----------|----------|
| REQ-DIAG-030 | `flow` — layered directed layout, running down or to the right | Must | T111 |
| REQ-DIAG-031 | `sequence` — entities become lifeline columns and relationships become message rows in relationship-array order | Must | T113 |
| REQ-DIAG-032 | Activation bars shall be derived from the span between a call and its reply | Must | T113 |
| REQ-DIAG-033 | A relationship marked as a reply shall render as a dashed line with an open arrowhead | Must | T113 |
| REQ-DIAG-034 | `state` — layered layout with self-loops rendered as stubs and back-edges routed outside the row | Must | T114 |
| REQ-DIAG-035 | Initial and final pseudostates shall render as a filled circle and a ring around a filled circle, and shall carry no label | Must | T114 |
| REQ-DIAG-036 | An entity may declare a parent; a container's intrinsic size shall be the bounding box of its laid-out children | Must | T115 |
| REQ-DIAG-037 | `free` — an entity carrying an explicit position shall be born pinned and left in place by layout | Must | T116 |

### Notation and rendering

| ID | Description | Priority | Test Ref |
|----|-------------|----------|----------|
| REQ-DIAG-040 | Style shall be selected by token name; the agent shall not supply colour values | Must | T111 |
| REQ-DIAG-041 | Entities shall render with the tint fill and ink stroke; containers with a white fill and hairline stroke, so nested children stay the figure | Must | T115 |
| REQ-DIAG-042 | The accent colour shall apply only to relationships the spec marks as faults | Must | T114 |
| REQ-DIAG-043 | A relationship guard shall render in brackets as its label | Must | T114 |
| REQ-DIAG-044 | A stereotype shall render in guillemets above the entity name | Must | T115 |
| REQ-DIAG-045 | Communication paths between deployment nodes shall render without arrowheads | Must | T115 |
| REQ-DIAG-046 | An entity of shape `none` shall render as text anchored to nothing | Must | T116 |

### Components and composite structure

UML 2 treats component diagrams and composite structure diagrams as separate families. A component diagram states what depends on what; a composite structure diagram opens a classifier up and specifies what it is made of. Both are supported here, and they share an element set.

| ID | Description | Priority | Test Ref |
|----|-------------|----------|----------|
| REQ-DIAG-050 | A component shall render as a rounded box carrying the UML component icon in its upper-right corner | Must | T117 |
| REQ-DIAG-051 | A component may carry a stereotype rendered in guillemets above its name | Must | T117 |
| REQ-DIAG-052 | A port shall attach to an owning entity's boundary and may carry a name and a multiplicity | Must | T117 |
| REQ-DIAG-053 | A public port shall render straddling its owner's boundary; a protected port shall render inside it | Must | T118 |
| REQ-DIAG-054 | A provided interface shall render as a line terminating in a circle | Must | T117 |
| REQ-DIAG-055 | A required interface shall render as a line terminating in a half-circle arc, opening toward its counterpart | Must | T117 |
| REQ-DIAG-056 | Where a required interface meets a provided one, the ball shall render nested in the socket as an assembly connector | Must | T117 |
| REQ-DIAG-057 | The app shall derive connector kind rather than read it from the spec: a connector with an end on a port that is neither on a part nor a behavior port is a delegation; otherwise it is an assembly | Must | T118 |
| REQ-DIAG-058 | A spec declaring a connector kind contradicting the derived kind shall raise a warning, and the derived kind shall be used | Should | T118 |
| REQ-DIAG-059 | Ball-and-socket notation shall be refused for a complex port and for a part without ports, naming the rule broken | Must | T118 |
| REQ-DIAG-060 | A delegation connector shall render from the delegating port to the receiving port or part, with an open arrowhead at the receiving end | Must | T118 |
| REQ-DIAG-061 | A port may delegate to more than one subordinate port | Should | T118 |
| REQ-DIAG-062 | A part shall render inside its structured classifier labelled `role : Type` | Must | T118 |
| REQ-DIAG-063 | A part's multiplicity shall render in the upper-right corner of the part box, and shall be stated explicitly in the spec rather than defaulted | Must | T118 |
| REQ-DIAG-064 | An edge terminating at a port shall anchor to the port's position on the boundary, not to its owner's centre | Must | T117 |
| REQ-DIAG-065 | An interface classifier shall render as a box with the «interface» stereotype above its name | Must | T119 |
| REQ-DIAG-066 | A realization shall render as a dashed line with a hollow triangle at the interface end | Must | T119 |
| REQ-DIAG-067 | A use dependency shall render as a dashed line with an open arrowhead at the interface end | Must | T119 |

### SVG transpile (v0.37)

SVG is the odd one out, deliberately. The other formats describe a diagram and
let the app compute every coordinate; SVG *is* geometry the author has already
laid out. It skips measure and layout and is only mapped onto native nodes — so
the contract is inverted, and the tool is named separately to keep that honest.

| ID | Description | Priority | Test Ref |
|----|-------------|----------|----------|
| REQ-DIAG-080 | SVG shall be transpiled into native shape and text nodes, never embedded as an image | Must | T130 |
| REQ-DIAG-081 | `viewBox` with `width`/`height` shall set a uniform scale, and the viewBox corner shall land on the diagram's origin | Must | T130 |
| REQ-DIAG-082 | `<g>` with translate and uniform scale shall compose through nesting | Must | T130 |
| REQ-DIAG-083 | `rect` (incl. `rx`), `circle`, `ellipse`, `line`, `polyline` and `polygon` shall map to native shapes | Must | T130 |
| REQ-DIAG-084 | `text` with `tspan` and `text-anchor` shall be placed off the measured run, not the padded node box | Must | T130 |
| REQ-DIAG-085 | Paint and font properties shall be read from presentation attributes or `style`, with `style` winning, and inherited down the tree | Must | T130 |
| REQ-DIAG-086 | `<path>` shall be refused with a diagnostic naming it — flattening curves to segments produces a drawing that is subtly wrong for the rest of its life | Must | T130 |
| REQ-DIAG-087 | Gradients, patterns, filters, masks, `clipPath`, `use`, `symbol`, `image`, `foreignObject`, `textPath`, `style`, `script`, animation and nested `<svg>` shall each be refused by name | Must | T130 |
| REQ-DIAG-088 | A `rotate()` transform shall be refused, because the native rotation turns about the element's own corner rather than the user-space origin and would move the drawing | Must | T130 |
| REQ-DIAG-089 | Malformed SVG, empty input, and a missing `DOMParser` shall each produce diagnostics rather than throwing | Must | T130 |

### draw.io transpile (v0.46)

draw.io is the other geometry-is-the-source format, next to SVG. A `.drawio`
file already has every coordinate; the app maps a documented subset onto native
nodes and refuses the rest by name — a cloud stencil standing in as a rectangle
is a lie that survives every later edit.

| ID | Description | Priority | Test Ref |
|----|-------------|----------|----------|
| REQ-DIAG-110 | `<mxfile>` and a bare `<mxGraphModel>` shall be classified as draw.io. An `<svg>` source, including one that opens with `<?xml …>`, shall still be classified as SVG — mxGraph files also start with `<?xml`, so the draw.io test shall run first | Must | T146 |
| REQ-DIAG-111 | A rectangle (including `rounded=1`, which shall set a corner radius), an ellipse (as a circle sized to the cell), a rhombus (as a rectangle rotated 45° whose side is min(width, height)/√2 so the diamond fits the cell), a triangle, a standalone text cell (as a TextNode) and a label on a vertex (as a TextNode centred in the cell) shall map to native nodes | Must | T146 |
| REQ-DIAG-112 | `fillColor`, `strokeColor`, `strokeWidth`, `dashed=1` and `dashPattern` shall map to fill, stroke, strokeWidth and strokeDash. When those keys are absent the documented defaults shall be used, not left undefined | Must | T146 |
| REQ-DIAG-113 | A child cell's position shall be the parent cell's position plus the child's own offset. `relative="1"` shall treat the child's x and y as fractions of the parent's width and height | Must | T146 |
| REQ-DIAG-114 | A swimlane shall become a rectangle plus a title TextNode; its children shall land as flat siblings; every node of the drawing shall share the groupId the caller passed | Must | T146 |
| REQ-DIAG-115 | A custom stencil (`shape=` outside the documented set), an image cell, `gradientColor`, rotation on an ellipse, and a rich-HTML label shall each be refused with a diagnostic naming the construct. The transpiler shall never throw, and cells that were not refused shall still be emitted | Must | T146 |
| REQ-DIAG-116 | A multi-page mxfile shall import the first page. An `ignored` diagnostic shall name the title of each page that was not imported | Must | T146 |
| REQ-DIAG-117 | A straight edge between two vertices with `endArrow` other than `none` shall be emitted as an `arrow` ShapeNode whose (x, y) is the start point and whose width/height is the signed vector to the end. Terminals that reference source/target cells shall connect border-to-border (the centre-to-centre segment clipped at each cell's bounding box). `endArrow=none` shall emit a `line`. The v0.46 deferral diagnostic shall not appear | Must | T146 |
| REQ-DIAG-118 | A page stored as base64+raw-deflate shall normalize to readable XML that transpiles to the same marks as the uncompressed form. An already-uncompressed source shall be returned unchanged | Must | T146 |
| REQ-DIAG-119 | `buildDiagram` with format `drawio` shall return native nodes and their bounds, skipping measure and layout, because the source already is geometry | Must | T146 |

### draw.io edges and the agent tool (v0.47)

v0.46 mapped vertices. Edges were the half that would have lied if they had
been approximated: a straightened curve is not the drawing, and a router-bent
orthogonal whose bends live in draw.io rather than in the file is not either.
This slice takes the subset that *is* geometry — straight, or waypointed into
straight segments — and refuses the rest by name. The agent-facing tool is the
other half: `create_diagram_drawio` routes onto the one `create_diagram`
command, and a compressed page is inflated *before* it is stored so the redraw
dialog never shows a base64 blob.

| ID | Description | Priority | Test Ref |
|----|-------------|----------|----------|
| REQ-DIAG-120 | A connected straight edge shall clip at each vertex's bounding box (border-to-border, never centre-to-centre). `endArrow` other than `none` shall emit an `arrow`; `endArrow=none` shall emit a `line`. `dashed`, `strokeColor` and `strokeWidth` shall map on edges as they do on vertices. Floating terminals — explicit `mxPoint`s and no source/target cells — shall be used as given | Must | T147 |
| REQ-DIAG-121 | An orthogonal edge carrying explicit `mxPoint` waypoints shall decompose into consecutive 2-point `line`/`arrow` segments. Only the final segment shall carry the arrowhead. An edge label — the edge's own `value`, or a child label cell when the edge has none — shall land as a TextNode at the midpoint of the longest segment | Must | T147 |
| REQ-DIAG-122 | A `startArrow` of `classic` is accepted only when `endArrow` is `none`: the point list shall be reversed so the single available head sits at the source. `startArrow=classic` together with any end head shall be refused (the canvas has no double-headed primitive). Any other start head (`diamond`, and the rest by name) shall be refused | Must | T147 |
| REQ-DIAG-123 | `curved=1` shall be refused. `rounded=1` on a waypointed edge shall be refused (filleted corners have no canvas equivalent). A router `edgeStyle` without explicit waypoints shall be refused, and the diagnostic shall say to make the waypoints explicit. Each refusal shall name the construct; the transpiler shall never throw; cells that were not refused shall still be emitted. `rounded=1` on a 2-point edge shall be accepted as a no-op | Must | T147 |
| REQ-DIAG-124 | `create_diagram` with `format: 'drawio'` and `render: 'nodes'` (or under viewer-extension fallback) shall draw a diagram frame whose members are the transpiled native nodes, whose `elementCount` matches the member count, and whose `data.source` is the supplied XML. The agent-facing tool is `create_diagram_drawio`, routed onto that one command. *(Amended v0.64: the default render mode is `snapshot` — see REQ-DIAG-149/150; this member contract applies to the explicit `render:'nodes'` escape and the fallback.)* | Must | T147 |
| REQ-DIAG-125 | A compressed (base64+raw-deflate) source passed to `create_diagram` shall succeed, and the stored `data.source` shall be the readable uncompressed XML (opening with `<mxfile` or `<mxGraphModel`), never the base64 payload. Normalization shall run before the source is stored | Must | T147 |
| REQ-DIAG-126 | A declared `format: 'drawio'` contradicted by a source that sniffs as Mermaid shall be refused with the mismatch error, naming the language the source is actually in — the same contract as the other named tools | Must | T147 |

### File ingestion (v0.48)

Drop and paste are how a *file* lands on the canvas. The agent already had
`create_diagram`; this slice is the OS path. The gate sits **ahead of** the
existing `image/*` check in `useCanvasDragDrop`, because that check was eating
real `.svg` files (`image/svg+xml`) and rasterising them.

| ID | Description | Priority | Test Ref |
|----|-------------|----------|----------|
| REQ-DIAG-127 | Dropping a `.drawio` file, or an `.xml` file whose text sniffs as mxGraph, shall create a diagram frame at the drop point (canvas coordinates). Pasting mxGraph XML text shall create a frame at the viewport centre. The stored `data.source` shall be the readable uncompressed XML — `normalizeDrawioSource` runs before the source is stored, same contract as REQ-DIAG-125. The frame title is the filename without its extension (paste uses `Diagram`). *(Amended v0.64: the frame is a snapshot render by default — REQ-DIAG-149/150; transpiled members only on fallback.)* | Must | T148, T175 |
| REQ-DIAG-128 | Dropping a `.svg` file (or a file whose MIME is `image/svg+xml`) shall create a diagram frame of native shape/text members via the existing SVG pipeline (`format: 'svg'`), not an image node. This is a deliberate behaviour change: those files previously matched `image/*` and landed as an opaque raster. Pasted SVG *text* follows the same native-node path; a pasted `image/*` item, including a rasterised SVG, is unchanged | Must | T148 |
| REQ-DIAG-129 | Non-diagram files (a `.png` among them) shall still follow the existing image drop/paste path. The on-frame format badge shall show the human label from `FORMAT_LABEL` (`draw.io`, not the raw id `drawio`), and that label shall agree with the selection-toolbar source button | Must | T148 |

### draw.io round-trip export (v0.49)

Diagrams leave the way they came. A `.drawio` import that the user has not
edited is written back byte-for-byte; anything else — an edited import, a
PlantUML/Mermaid/SVG frame, a plain Ctrl+G group — is reverse-mapped into a
well-formed mxfile that our own transpiler accepts. Detection of "unedited"
is by comparing a re-transpile of the stored source to the current members,
not a dirty flag.

| ID | Description | Priority | Test Ref |
|----|-------------|----------|----------|
| REQ-DIAG-130 | A diagram frame whose stored source sniffs as draw.io, and whose current members match a re-transpile of that source (same count, geometry within 0.5 px, same fills and strokes), shall export the stored XML unchanged. The match is a comparison, not a dirty flag — moving a member and moving it back shall restore the verbatim path. *(Amended v0.64: a snapshot frame — `data.render` present — always exports its stored source verbatim; there are no members to compare. See REQ-DIAG-153.)* | Must | T149, T180 |
| REQ-DIAG-131 | Any other diagram frame or flat group shall export by reverse-mapping its members to a well-formed `<mxfile><diagram><mxGraphModel>` document. Geometry shall be translated so the export origin is (0, 0). Lines and arrows shall become floating edges (explicit endpoint `mxPoint`s; no source/target resolution). Re-transpiling the exported XML shall recover the same node set (count, geometry ±0.5 px, fills) | Must | T149 |
| REQ-DIAG-132 | Style shall survive the mapped path: `cornerRadius` shall become `rounded=1` plus `arcSize`; a non-empty `strokeDash` shall become `dashed=1` plus `dashPattern`; `rotation` on a rectangle shall be preserved through export then import | Must | T149 |
| REQ-DIAG-133 | An `arc` (the UML socket) has no portable draw.io built-in (`shape=arc` / `mxgraph.basic.arc` only render when the matching stencil library is loaded). It shall be exported as an `ellipse` with `fillColor=none` and named in the export report. The exporter shall never throw | Must | T149 |
| REQ-DIAG-134 | The diagram frame's context menu shall offer "Export as .drawio". The same entry shall be offered when the menu target is a member of a plain group, and shall export that group. The file shall download as `<title>.drawio` via the existing anchor/Blob mechanism | Must | T149 |
| REQ-DIAG-135 | If the export produced a report (anything not exported faithfully), the report shall be surfaced with the existing toast at info severity, joined. A faithful export shall not toast | Must | T149 |

### Fit to the landing scroll (v0.51)

A diagram created into a scroll band must not keep a layout width that spills
into the neighbouring band — derived membership would then make members
half-belong to the wrong column. The fit is a placement-time transform: it
never runs inside the layout engine, is stored on no node field, and is not
re-applied when the user later moves or resizes the frame.

| ID | Description | Priority | Test Ref |
|----|-------------|----------|----------|
| REQ-DIAG-136 | When a diagram is created into or pasted/dropped at a position whose origin falls in a scroll band, and the materialized frame width exceeds that band's width minus padding, the members and frame size shall be scaled about the frame origin (positions, widths, heights, fontSize; strokeWidth unchanged) so the diagram fits. Scale is clamped to `[0.45, 1]` | Must | T151 |
| REQ-DIAG-137 | If the scale needed to fit is below 0.45, the diagram shall be placed at 0.45× and the write response shall carry a warning naming the scroll, the requested (unfitted) width and the applied scale. Any scale strictly below 1 shall produce a warning naming the scroll and the scale. The warning joins the existing `warnings` array on `create_diagram` (v0.34 same-response contract) and the drop/paste toast | Must | T151 |
| REQ-DIAG-138 | A diagram whose frame origin does not fall inside any scroll record shall be left unscaled, with no warning | Must | T151 |
| REQ-DIAG-139 | Redrawing a frame (`rebuildDiagram` via the source dialog) shall apply the same fit against the band the frame currently sits in | Must | T151 |

### Frame deletion cascade (v0.53)

Deleting the frame used to leave every member and every grouped stroke behind.
The cascade belongs in the canvas-store primitive so the delete key, the
context menu, `delete_block` on the frame id, and `delete_diagram` cannot
drift apart.

| ID | Description | Priority | Test Ref |
|----|-------------|----------|----------|
| REQ-DIAG-140 | Deleting a `type:'diagram'` node shall also delete every node whose `groupId` is the frame id and every stroke with that `groupId`, as one undo entry that restores nodes and strokes together. The cascade shall live in the canvas-store deletion primitive so every caller inherits it | Must | T155 |
| REQ-DIAG-141 | `delete_diagram` shall take `diagramId` (and `confirm: true`). It shall return `{ deletedMembers, deletedStrokes }`. Occupants below the frame in the same scroll shall close the gap. An unknown id shall be `NOT_FOUND`. A non-diagram node id shall be refused (`UNSUPPORTED`) naming the node's type and pointing at `delete_block`. `delete_block` on a frame id shall use the same cascade | Must | T155, T110 |

### On-demand fit to the landing scroll (v0.54)

Placement-time fit is shrink-only (REQ-DIAG-136). The on-demand action is the
opposite contract: fit-to-width means fill the column, so a diagram sitting
under-width grows, and one sitting over-width still shrinks with the same 0.45
floor. The geometry is the same `fitDiagramToScroll` math; only the ≤1 clamp
is lifted. Out-of-band frames are refused rather than silently left alone.

| ID | Description | Priority | Test Ref |
|----|-------------|----------|----------|
| REQ-DIAG-142 | An on-demand fit (`fit_diagram` over the bridge, and "Fit to scroll width" on the diagram frame context menu) shall scale the frame and its members about the frame origin to band-width minus padding. Scale may be greater than 1. Scale is floored at 0.45. A frame whose origin is outside every scroll record shall be refused (`PRECONDITION`) naming the diagram. Placement-time fit remains shrink-only (REQ-DIAG-136). One undo shall restore the previous geometry | Must | T160 |

### draw.io component diagrams (v0.59)

The notebook is the long-term record. The author prototypes in diagrams.net
(component / composite structure: boxes, ports on their edges, orthogonal
arrows) and drops the `.drawio` file here.

| ID | Description | Priority | Test Ref |
|----|-------------|----------|----------|
| REQ-DIAG-143 | A vertex with `relative=1` geometry shall resolve against its parent cell, then apply `<mxPoint as="offset">`, so a port sits on the parent edge rather than at the parent's origin | Must | T166 |
| REQ-DIAG-144 | An orthogonal / routed edge (`edgeStyle=orthogonalEdgeStyle` and kin) without stored waypoints shall be routed from `exitX`/`exitY`/`entryX`/`entryY` when present, otherwise from box-edge to box-edge, as an L or Z of straight segments. It shall not be refused. An `ignored` diagnostic shall name that it was routed | Must | T166, T147 |
| REQ-DIAG-145 | `shape=module` / UML component shall draw as a rectangle with two tabs on the left edge. `shape=port` shall draw as a small rectangle. Box-like `mxgraph.uml.*` / `mxgraph.basic.*` shapes shall draw as rectangles with an `ignored` diagnostic naming the stencil. AWS/cisco/mscae image stencils remain refused | Must | T166 |
| REQ-DIAG-146 | Simple HTML in a label (`<br>`, `<div>`, `<font>`, `<b>`, `<span>`) shall be stripped and the words kept, with an `ignored` diagnostic. Empty leftover markup is still refused | Must | T146 |
| REQ-DIAG-147 | Drop/paste of `.drawio`, `.dio`, `.drawio.xml` shall import at the drop point (or viewport centre). A short toast shall report the outcome — for a snapshot render, that it was imported as a draw.io render; for the transpile fallback, mark count and skip/note counts. If any transpile diagnostic fired, the source dialog shall open on that frame. *(Amended v0.64: snapshot is the default; the toast never reads "0 marks" for a successful snapshot.)* | Must | T148, T175 |
| REQ-DIAG-148 | The diagram source dialog shall offer Open file (`.drawio` / `.xml` / `.svg`), show a draw.io-specific hint when the draft sniffs as draw.io, and list at most eight diagnostics with a "+N more" remainder | Should | T166 |

### draw.io viewer snapshot rendering (v0.64)

| ID | Description | Priority | Test Ref |
|----|-------------|----------|----------|
| REQ-DIAG-149 | A draw.io source shall by default be rendered by the embedded draw.io viewer (extension asset, offline, zero follow-up network requests) into an exact SVG snapshot stored on `DiagramNodeData.render` (`{src: data URI, naturalWidth, naturalHeight, renderer, rendererVersion, at}`). The snapshot data URI shall load as an image and draw to canvas untainted | Must | T174 |
| REQ-DIAG-150 | Snapshot placement shall succeed with zero member nodes on every entry point — drop/paste, bridge `create_diagram(_drawio)`, and the source-dialog Redraw — reporting `renderMode: 'snapshot'` and `elementCount: 0` without error. Bridge results shall never serialize `render` (summaries/details stay within the read budget) | Must | T175, T176, T177 |
| REQ-DIAG-151 | When the viewer extension is unavailable, every draw.io entry point shall fall back to the native-node transpiler and say so (toast / `warnings` / diagnostic) — a drop or agent call never dead-ends. `render:'nodes'` on the bridge forces the transpile path deliberately | Must | T178 |
| REQ-DIAG-152 | `fit_diagram` / "Fit to scroll width" on a snapshot frame shall scale the frame box to the band (grow and shrink, 0.45 floor, same rules as member fit) with the image following the frame | Must | T179 |
| REQ-DIAG-153 | Exporting a snapshot frame as `.drawio` shall emit the stored source verbatim — never an empty mxfile. Loose nodes inside the frame group are reported, not exported | Must | T180 |
| REQ-DIAG-154 | Double-clicking a snapshot frame shall open the source dialog (not group isolation). The dialog's Redraw shall be async with a visible pending state, shall re-resolve the frame after the render and abort if it was deleted, and shall clear `render` when a non-draw.io source is drawn over a snapshot | Must | T177 |
| REQ-DIAG-155 | *(v0.65)* A context-menu "Convert to editable nodes" on a snapshot frame shall transpile the stored source into member nodes, delete `render`, and be one undo | Must | T185 |
| REQ-DIAG-156 | Page and notebook search shall match diagram frames on their title and stored source text, so a snapshot diagram's labels (which live in the XML) remain findable | Should | T177 |

### Activity and swimlane diagrams (v0.35.1)

PlantUML's activity syntax is a separate grammar from the component one, so it
gets a separate parser. The source states the order, which is why no graph
layout is involved: the flow runs top to bottom and the lane fixes the column.

| ID | Description | Priority | Test Ref |
|----|-------------|----------|----------|
| REQ-DIAG-070 | The app shall detect activity syntax and route it to the activity grammar, without a flag from the author | Must | T125 |
| REQ-DIAG-071 | A component source shall never be routed to the activity grammar | Must | T125 |
| REQ-DIAG-072 | `\|Lane\|` shall assign every following step to that swimlane until the next lane statement | Must | T125 |
| REQ-DIAG-073 | Each lane shall render as a titled band, and a step's lane shall fix its column | Must | T125 |
| REQ-DIAG-074 | `start` and `stop` shall render as the filled and ringed pseudostates | Must | T125 |
| REQ-DIAG-075 | A decision shall render as a diamond, with `then`/`else` labels carried onto the outgoing arrows as guards | Must | T125 |
| REQ-DIAG-076 | `fork`, `split`, `while` and `repeat` shall be refused with a diagnostic rather than drawn wrong | Must | T125 |

**Known limitation.** `if/else` branches render in source order rather than as
parallel paths that rejoin. The chart reads correctly as a lane-partitioned
sequence but is not yet a true branching flowchart; that needs a merge point and
sub-columns within a lane.

### Source formats and the Mermaid subset (v0.35.2)

Mermaid is a second *language*, where activity was a second *dialect*. That
distinction is what the agent-facing tool names encode: `create_diagram_plantuml`
takes PlantUML and sniffs its two dialects apart internally, `create_diagram_mermaid`
takes Mermaid. A model choosing between two named tools is choosing the thing it
actually knows — which language it just wrote — instead of remembering an enum.

Only the parser differs. Mermaid produces the same spec types, so measure,
layout and materialize are shared and a Mermaid flowchart looks like it belongs
in the same notebook as a PlantUML component diagram.

| ID | Description | Priority | Test Ref |
|----|-------------|----------|----------|
| REQ-DIAG-090 | A caller may declare the source format; with none declared the format shall be detected from the source | Must | T126 |
| REQ-DIAG-091 | A declared format contradicted by the source shall be refused, naming the language the source is actually in | Must | T126 |
| REQ-DIAG-092 | `flowchart`/`graph` with a direction shall parse nodes `A[Label]`, `A(Label)` and `A{Label}` into the shared spec types | Must | T126 |
| REQ-DIAG-093 | Edges `A --> B`, `A -->\|label\| B` and `A --- B` shall parse, including chained statements; `---` shall render without an arrowhead | Must | T126 |
| REQ-DIAG-094 | A node shape with no geometric counterpart shall render as a box carrying the shape name as its stereotype, rather than as a different shape | Must | T126 |
| REQ-DIAG-095 | A flow edge shall render as an arrow whatever its label, rather than deriving an assembly connector from it | Must | T126 |
| REQ-DIAG-096 | `sequenceDiagram` shall parse `participant`, `A->>B: message` and `A-->>B: reply`; a reply shall render dashed | Must | T126 |
| REQ-DIAG-097 | Sequence messages shall be numbered in source order, since the row layout cannot otherwise show order | Must | T126 |
| REQ-DIAG-098 | Anything outside the documented Mermaid subset shall raise a diagnostic and be skipped; the parser shall never throw | Must | T126 |
| REQ-DIAG-099 | The agent-facing diagram tools shall be named for the language each accepts, and shall route to the one app command carrying that format | Must | test:bridge |
| REQ-DIAG-100 | A diagram frame's source control shall be labelled with the language the source is ACTUALLY written in, derived by sniffing the source rather than stored or assumed. It was hardcoded to "plantuml", so every SVG and Mermaid diagram stated on its face that it was something it was not | Must | T132 |
| REQ-DIAG-101 | The source dialog shall name the format of the DRAFT, updating as it is typed, so pasting one language over another shows what Redraw is about to do before it is committed | Should | T132 |
| REQ-DIAG-102 | A diagram frame shall offer the same right-click context menu as any other canvas node, including the layer control. The menu resolves a node by walking up from the click for a `Rect` carrying the node id, so the frame shall tag its Rect accordingly | Must | T132 |
| REQ-DIAG-103 | Changing a diagram frame's layer shall move the whole drawing relative to other canvas content, WITHOUT rewriting its members' layers. A diagram's marks already span layers 2..5 among themselves to keep containers behind entities and links under text, so the frame's layer shall act as a band its members sort inside, the frame pinned to the back of that band | Must | T132 |

**Documented subset.** Flowcharts: `flowchart`/`graph` with `TB`, `TD`, `BT`,
`LR` or `RL`; nodes `A`, `A[Label]`, `A(Label)`, `A{Label}`, with quoted labels;
edges `-->`, `--->`, `---`, `----`, each optionally carrying `|label|`; chains.
Sequences: `participant X`, `participant X as Label`, `actor X`, `A->>B: text`,
`A-->>B: text`. Everything else — subgraphs, `-.->`, `==>`, `--o`, `--x`,
compound shapes such as `A[[Sub]]` and `A((Circle))`, `loop`/`alt`/`opt`/`par`/
`note`/`activate`, and the class, state, ER and Gantt families — raises a
diagnostic and is skipped. Styling (`style`, `classDef`, `click`, `linkStyle`,
`%%{init}%%`) is reported as skipped, like `skinparam` in PlantUML.

**Known limitations.** Direction is not honoured: the shared layout places roots
in one left-to-right row, so `flowchart TD` reports its direction as skipped and
draws left to right with the arrows carrying the flow. A sequence renders as
participants side by side with numbered messages, not as lifelines running down
the page — that is REQ-DIAG-031..033, still unbuilt — and two messages between
the same pair therefore share a line. `{decision}` renders as a box stereotyped
«decision» rather than as a diamond; the activity grammar has a diamond, but it
belongs to a different layout.

## UML conformance notes

Three points where the specification above follows a rule rather than a convention, recorded so the reasoning is not lost.

**Connector kind is derived (REQ-DIAG-057).** UML states that a connector with one or more ends connected to a port that is not on a part and is not a behavior port is a delegation, and otherwise an assembly. This is a rule, not a modelling choice, so the app applies it. The agent names endpoints; it does not get to declare what kind of connector it drew. This matches how the rest of the pipeline divides labour.

**Ball-and-socket has legality limits (REQ-DIAG-059).** UML forbids the notation for complex ports and for parts without ports. Both cases are legitimate models that simply cannot be drawn that way, so the app refuses the notation rather than the model.

**Part multiplicity is required, not defaulted (REQ-DIAG-063).** Sources disagree on what an omitted multiplicity means — the older UML notation guide reads an absent mark as *many*, while a property's default multiplicity is 1. Rather than pick a side and render something the author did not intend, the spec requires it explicitly.

## Dependencies

Two additions to `ShapeNodeData` are required before the notation above can be rendered. Both are tracked in `SRS_SHAPES.md` and are not yet written:

| Field | Needed for | Proposed ID |
|-------|-----------|-------------|
| `cornerRadius` | UML states are rounded rectangles; every node box in the chosen style is rounded. Shapes are square today | REQ-SHAPE-021 |
| `rotation` | A gain triangle points along the signal path, a realization arrowhead points at its interface, and a socket opens toward its ball. Konva triangles point up, and only `ImageNodeData` carries rotation today | REQ-SHAPE-022 |
| `arc` shape type | A required-interface socket is a half-circle. None of rect, circle, triangle, arrow or line can produce one | REQ-SHAPE-023 |

## Out of scope

| Item | Reason |
|------|--------|
| Mermaid beyond the documented subset | The families that map onto the existing layouts are read. Class, state, ER and Gantt sources need layouts that are not built, and half-reading them would draw a diagram the author did not write |
| Hand-drawn rendering | Per-stroke roughness cannot come from Konva rectangles without abandoning native shape nodes, which contradicts REQ-DIAG-013 |
| A user-facing spec editor | The spec is written by agents. Users edit the rendered result directly, which is what pinning exists to protect |
| Deeper than two nesting levels | Recursive layout supports it, but no token set has been designed for a third level of tonal hierarchy |
| Behavior ports | Referenced by the connector-kind rule in REQ-DIAG-057 so the derivation is correct, but not renderable — a spec declaring one is refused rather than drawn wrong |
| Collaborations and collaboration uses | Part of the UML composite structure element set and offered by Enterprise Architect, but they describe interaction patterns rather than structure, and nothing in the four original families needs them |
| Conjugated ports | The `~` reversed-direction port. Legal UML, but it changes what provided and required mean at a port, and that ambiguity is not worth carrying before anyone asks for it |

## Traceability

| Test | Covers |
|------|--------|
| T110 | REQ-DIAG-002..005 — `tests/diagram/110-column-reflow.spec.ts` |
| T120 | REQ-DIAG-001, 010..014, 040.. — PlantUML native frames (`tests/diagram/120-diagram-plantuml.spec.ts`). There is no T111 file. |
| T112 | REQ-DIAG-007, 008, 014, 020, 021, 023 — **no such spec.** Positional membership and the pin loop are Not built / descoped. |
| T113 | REQ-DIAG-031..033 — not written; sequence/state layouts are Not built. |
| T114 | REQ-DIAG-034, 035, 042, 043 |
| T115 | REQ-DIAG-036, 041, 044, 045 |
| T116 | REQ-DIAG-037, 046 |
| T117 | REQ-DIAG-050..052, 054..056, 064 |
| T118 | REQ-DIAG-053, 057..063 |
| T119 | REQ-DIAG-065..067 |
| T130 | REQ-DIAG-080..089 |
| T146 | REQ-DIAG-110..119 |
| T147 | REQ-DIAG-120..126 |
| T148 | REQ-DIAG-127..129 |
| T149 | REQ-DIAG-130..135 |
| T166 | REQ-DIAG-143..148 |
| T151 | REQ-DIAG-136..139 |
| T174 | REQ-DIAG-149 |
| T175 | REQ-DIAG-127, 147, 149, 150 |
| T176 | REQ-DIAG-124, 150 |
| T177 | REQ-DIAG-154, 156 |
| T178 | REQ-DIAG-151 |
| T179 | REQ-DIAG-152 |
| T180 | REQ-DIAG-130, 153 |
| T185 | REQ-DIAG-155 |
| T125 | REQ-DIAG-070..076 |
| T126 | REQ-DIAG-090..098 |
| test:bridge | REQ-DIAG-099 |
| T132 | REQ-DIAG-100..103 |
