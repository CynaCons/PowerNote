# PowerNote — Claude Instructions

## Project Overview
PowerNote is an offline-first, file-based visual note-taking app combining OneNote (structure) + PowerPoint (canvas) + Whiteboard (freedom). Built with React 18 + TypeScript + Vite + Konva.js + Zustand.

## Tech Stack
- **Canvas**: Konva.js (react-konva) — MIT license, chosen over tldraw ($6K/year)
- **State**: 3 Zustand stores (workspace, canvas, tool)
- **Text**: Markdown rendering via `marked`, raw editing in textarea overlay
- **Testing**: Playwright E2E, ASPICE-style SRS docs with traceability

## Critical Workflow: Handling User Feedback

When the user gives feedback, bug reports, or feature requests — **ALWAYS** do these 3 things before writing code:

1. **Update PLAN.md** — Add a task under the current iteration with `- [ ]` checkbox
2. **Create a TodoWrite** — Track the work item as in_progress
3. **Assess SRS impact** — Check if a new requirement (REQ-XXX-NNN) is needed in the relevant `docs/SRS_*.md`. If yes, add it with a test reference.

Only then proceed with implementation.

## PLAN.md Format (STRICT)
- Markdown checklists with `- [ ]` / `- [x]`
- Version-numbered iterations: v0.1.0, v0.1.1, v0.2.0, etc.
- Each iteration has a title and summary
- Status table at the bottom
- Update in real-time as tasks are completed

## Testing Requirements
- Every feature must have E2E test coverage
- Test numbers are **globally unique** across the project (00, 01, 02, ...)
- Tests reference requirement IDs: `Covers: REQ-TEXT-001`
- Tests live in `tests/<feature>/NN-test-name.spec.ts`
- SRS docs live in `docs/SRS_<FEATURE>.md`
- Run `npx playwright test` after every change — must be green before commit

## Before Reporting Completion
- ALWAYS run a smoke test: `npm run dev` must launch without crashes
- Check console for critical errors
- Run `npx playwright test` — all tests must pass

## User Preferences
- **Always cross-check priorities** with the user before deciding what to build
- Don't assume what's important — ask directly
- Focus on core UX and structural features, not cosmetic additions
- Simplicity > completeness. Speed > features. Ship fast.

## Code Patterns
- Components in `src/components/<area>/`
- Stores in `src/stores/`
- Types in `src/types/data.ts`
- All key DOM elements have `data-testid` attributes
- Zustand stores exposed on `window.__POWERNOTE_STORES__` in dev mode for testing
- Konva nodes use Group positioning: Group at (node.x, node.y), children at (0, 0)

## Git Conventions
- Commit messages: `feat:`, `fix:`, `refactor:`, `test:`, `docs:`
- Always include `Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>`
- Tag major milestones: `v0.1.0`, `v0.2.0`
- Never amend commits — always create new ones
