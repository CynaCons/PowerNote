# PowerNote — Long-Term Vision

**Status:** Post-MVP. Not in active scope. Tracked here so ideas are not lost.

This document captures product directions that depend on infrastructure PowerNote does not yet have (notably: a cloud backend). When cloud deployment exists, items here become candidates for the active roadmap in `PRD.md` §12.

---

## Paid Tier (Deferred)

A paid subscription (~€1.99–€4.99 / month) unlocking cloud-backed capabilities, while the free, offline, file-based tier remains fully functional.

**Possible paid capabilities:**
- **Cloud sync** — notebooks stored remotely, device-agnostic access
- **Multi-device access** — same notebook across desktop, tablet, phone
- **Backup** — server-side snapshots independent of the local file
- **Version history** — browse and restore prior states of a notebook
- **Collaboration** — multiple editors on the same page in real time

**Why deferred:**
- Requires a cloud backend (auth, storage, sync engine) that does not exist.
- Requires a billing and account system.
- None of the above should block the offline-first MVP from shipping.

---

## Other Long-Term Ideas

- Mobile apps (currently a non-goal in `PRD.md` §8 — may be revisited)
- Plugin system for custom node types
- Advanced diagram libraries (flowchart palettes, UML, ERD)
- PowerPoint-style animations / reveal transitions
- Complex database / table features

---

## Relationship to the PRD

- `PRD.md` describes what PowerNote **is**, what it **ships**, and what it does **now**.
- `VISION.md` describes what PowerNote **might become** after the MVP is done and infrastructure exists.
- When an item from this document is promoted to active work, it moves into `PRD.md` §12 and gets one or more `SRS_*.md` requirements.
