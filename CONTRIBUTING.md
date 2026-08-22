# Contributing to PowerScroll

Thank you for helping make privately owned visual notebooks better.

## Before opening code

- Use an issue or Discussion to describe substantial changes first.
- Keep the single-file, offline-first model intact.
- Preserve compatibility with existing PowerNote notebooks and their embedded
  `powernote-*` protocol identifiers.
- Prefer a focused user-visible improvement over broad feature expansion.

## Development

```bash
npm install
npm install --prefix powernote-mcp
npm run dev
```

Before submitting a pull request:

```bash
npm run typecheck
npm run lint -- --max-warnings 9999
npm run build:template
npx playwright test
npm run test:bridge
```

Every behavioral requirement belongs in the relevant `docs/SRS_*.md` file and
needs a Playwright test with a globally unique test number. Do not commit user
notebooks, tokens, captured personal data, or generated test reports.

## Pull requests

Explain the user problem, the chosen behavior, compatibility implications, and
the verification performed. Screenshots must come from the running app rather
than a recreated mockup.
