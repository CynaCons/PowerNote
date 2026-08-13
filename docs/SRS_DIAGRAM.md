# SRS: Diagrams

**Project:** PowerNote
**Version:** 0.35.1
**Date:** 2026-08-13

## Purpose

Let an agent draw diagrams on the canvas using the same elements a user draws by hand. A diagram is authored as a **spec** — entities and the relationships between them — and rendered by the app into native `ShapeNode` and `TextNode` objects inside a bounded **diagram frame** that sits in a scroll like any other block.

The division of labour is the point. The agent supplies semantics: what exists and what connects to what. The app supplies geometry: how wide a box must be to hold its label, where the boxes go, how the edges route. An agent that guesses coordinates produces overlapping boxes and overflowing labels; an agent that names entities does not.

Because the output is ordinary canvas objects, the user can drag, restyle and delete any part of a generated diagram the moment it appears.

## Implementation status

This document specifies more than has shipped. Requirements are written ahead of
implementation on purpose, but the difference matters when reading it:

| Area | State as of v0.35.1 |
|------|---------------------|
| Diagram node, PlantUML parsing, layout, materialize | Shipped — REQ-DIAG-001, 006, 010..014, 017, 040..046, 050..067, 070..076 |
| Activity and swimlane grammar | Shipped — REQ-DIAG-070..076 |
| Agent authoring over the bridge | Shipped — `create_diagram` |
| Frame reflow and document flow (REQ-DIAG-002..005) | **Not built.** Diagrams sit on the canvas; blocks below a frame do not move when it resizes |
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
| REQ-DIAG-002 | A diagram frame shall occupy a scroll like a text block, with an intrinsic height derived from its contents | Must | T110 |
| REQ-DIAG-003 | When a block or frame's height changes, blocks below it in the same scroll shall move down; when it shrinks, they shall close the gap | Must | T110 |
| REQ-DIAG-004 | Reflow shall be scoped to the affected column, leaving other columns unchanged | Must | T110 |
| REQ-DIAG-005 | A frame, its spec and its rendered elements shall survive a save/load round-trip | Must | T110 |
| REQ-DIAG-006 | A frame shall appear in agent-facing reading order identified by its title, without expanding its children into the block list | Must | T111 |
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
| Mermaid ingest | Agents write Mermaid fluently, so parsing it into a spec is a cheap later win. Not required for any of the four families |
| Hand-drawn rendering | Per-stroke roughness cannot come from Konva rectangles without abandoning native shape nodes, which contradicts REQ-DIAG-013 |
| A user-facing spec editor | The spec is written by agents. Users edit the rendered result directly, which is what pinning exists to protect |
| Deeper than two nesting levels | Recursive layout supports it, but no token set has been designed for a third level of tonal hierarchy |
| Behavior ports | Referenced by the connector-kind rule in REQ-DIAG-057 so the derivation is correct, but not renderable — a spec declaring one is refused rather than drawn wrong |
| Collaborations and collaboration uses | Part of the UML composite structure element set and offered by Enterprise Architect, but they describe interaction patterns rather than structure, and nothing in the four original families needs them |
| Conjugated ports | The `~` reversed-direction port. Legal UML, but it changes what provided and required mean at a port, and that ambiguity is not worth carrying before anyone asks for it |

## Traceability

| Test | Covers |
|------|--------|
| T110 | REQ-DIAG-002..005 |
| T111 | REQ-DIAG-001, 006, 010..018, 022, 030, 040 |
| T112 | REQ-DIAG-007, 008, 014, 020, 021, 023 |
| T113 | REQ-DIAG-031..033 |
| T114 | REQ-DIAG-034, 035, 042, 043 |
| T115 | REQ-DIAG-036, 041, 044, 045 |
| T116 | REQ-DIAG-037, 046 |
| T117 | REQ-DIAG-050..052, 054..056, 064 |
| T118 | REQ-DIAG-053, 057..063 |
| T119 | REQ-DIAG-065..067 |
| T125 | REQ-DIAG-070..076 |
