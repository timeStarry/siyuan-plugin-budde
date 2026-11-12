# Budde Agent Guide

- Read [PRODUCT.md](PRODUCT.md), [ui-design-system.md](ui-design-system.md), and [docs/architecture.md](docs/architecture.md) before making architectural or UI changes.
- Budde is a desktop SiYuan plugin (`minAppVersion: 3.4.1`), bundled as CommonJS (`dist/index.js` + `dist/index.css`) with zero runtime network dependencies.
- Keep strict separation across layers:
  - `src/core/`: Pure domain types, `schemaVersion: 2` validation (with lossless `v1 -> v2` upgrade), and `BuddeService` command execution. No DOM or SiYuan imports.
  - `src/platform/`: `NodeFileStore` (cross-process lock + atomic file swap + `mtime` change detection) and `SiYuanNotes` (SQL search, block resolution, notebook listing, Markdown doc creation).
  - `src/ui/`: Single-root React 19 Workbench & Quick Capture UI scoped strictly inside `.budde`. Never mutate `document.body` or global host styles.
- Preserve the unmodified `Quicksand-variable.ttf` asset and its full SIL OFL 1.1 license text in `README.md`.
- Verification gates:
  - `pnpm check` (TypeScript + unit tests + production build)
  - `pnpm test:ui` (Playwright workbench & responsive verification)
  - `pnpm package:plugin && pnpm test:plugin && pnpm test:release` (CJS smoke test, host style isolation, reproducible 6-file release ZIP)
- Never include private user notes, tokens, or real workspace paths in code, tests, or fixtures.
