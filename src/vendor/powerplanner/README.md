# Vendored PowerPlanner embed

This is a snapshot of PowerPlanner's embeddable Gantt renderer, copied verbatim
from [CynaCons/powerplanner](https://github.com/CynaCons/powerplanner) at the
version listed below. It is read-only inside this repo.

**Source:** https://github.com/CynaCons/powerplanner/tree/main/src
**Version:** v2.0.0
**Vendored:** 2026-05-27

## What's here

- `embed/` — the public-API barrel and the `<GanttRenderer>` component
- `layout/`, `types/`, `utils/`, `persistence/` — minimal transitive deps

## How to upgrade

```bash
# From the PowerNote repo root, with PowerPlanner cloned at ../powerplanner:
PP=../../../public-repo/powerplanner/src
DST=src/vendor/powerplanner
cp $PP/types/document.ts          $DST/types/
cp $PP/utils/dates.ts             $DST/utils/
cp $PP/layout/{engine,timeAxis,criticalPath}.ts $DST/layout/
cp $PP/persistence/schema.ts      $DST/persistence/
cp $PP/embed/{GanttRenderer.tsx,index.ts} $DST/embed/
```

## Why vendored, not submoduled?

We may switch to a git submodule once the embed API is stable. Vendoring keeps
this iteration self-contained and reviewable in a single PowerNote diff.
