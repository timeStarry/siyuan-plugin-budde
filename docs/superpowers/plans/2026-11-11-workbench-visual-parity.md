# Workbench Visual Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore the approved workbench's SVG icon coverage and visual composition without changing plugin data or business behavior.

**Architecture:** Retain the existing client, draft, event and lifecycle controllers. Map their rendered DOM to the already-approved V2 component variants and layout; reuse the approved inline SVG paths without global sprite IDs. Add deterministic same-view browser comparisons instead of treating control geometry alone as visual acceptance.

**Tech Stack:** TypeScript, scoped CSS/container queries, inline SVG, Playwright/Edge, existing Node build/install tools.

**Spec:** [Approved design](../../../design/workbench-v2-preview/DESIGN.md), [approved page](../../../design/workbench-v2-preview/index.html). User's real-host screenshot confirms missing icons, nested input borders, floating detail card, misplaced edit and heavy action borders.

## Global Constraints
- 36px controls, 16px icons, 24px brand, 1.75 SVG stroke, no remote assets/dependencies.
- Preserve alpha.1 desktop scope, idempotency, optimistic versions, dirty guards, monotonic reconciliation and instance-local lifecycle.
- No schema/core/storage changes; no private user content in fixtures. Do not copy the supplied screenshot into the repository.
- One writer (Lead); bounded read-only review. No commit, merge or push.
- Existing approved design and inline development choice stand; this is correction, not a new design gate.

## Review Focus
- Navigation/search/type/state/action icons are actually rendered, not merely defined.
- Approved ghost/outline/primary hierarchy and capture border specificity.
- Header/board/index alignment, unboxed columns, edge-attached 420px detail.
- Settings/guards/overlay keyboard and dirty-save behavior remain intact.
- Package allowlist, installed file hashes and data/config protection.

## Task 1: Reproduce icon and visual parity gaps
Files: create `scripts/verify-parity.mjs`; update `package.json` test:ui.
- [x] Seed only synthetic approved-example data through the real service in isolated preview.
- [x] Render approved page and production board at equal 1440x1000 light/dark sizes.
- [x] Assert actual navigation/search/action SVGs, 16px geometry, ghost borders, capture's single outline, detail attachment and board structure; verify expected RED before UI edits (4 pass / 7 fail).

## Task 2: Restore approved UI mappings
Files: `src/ui/dom.ts`, `src/ui/view.ts`, `src/ui/index.ts`, `src/ui/detail.ts`, `src/ui/styles.css`; only adjust tokens if required by approved contract.
- [x] Extend inline SVG registry from approved symbols, with stable data-icon names, accessible parent labels and no global IDs.
- [x] Restore navigation/type/search/status/stage/edit/footer/note affordances, using semantic-neutral fallback icons for custom type names.
- [x] Restore header/index alignment, 56px capture surface, ghost controls, plain stage columns, edge-attached detail, next-step surface and top edit action.
- [x] Keep all existing data selectors/actions, safe escaping and draft/lifetime guards. Preserve horizontal scrolling of long stage paths; do not shrink controls.
- [x] Run parity GREEN and inspect same-view screenshots before full regressions (11/11; inspection led to added long-label spacing and settled hover/active regressions).

## Task 3: Verify and redeploy
Files: `docs/validation.md`; existing ignored release/QA/install-backup artifacts.
- [x] Run `pnpm check`, `pnpm test:ui`, `pnpm test:plugin`; investigate every failure. Final chained run exit 0: 27 tests / 9 UI / 12 lifecycle / 70 geometry / 11 parity.
- [x] Obtain bounded read-only review while running independent checks; resolve definite issues. No Critical/Important; one Minor note-hover outline reproduced and fixed.
- [x] Run package/release checks, inspect screenshots and standard ZIP extraction/hash equivalence. Final archive SHA-256: `820ce630ac4d294330c3f8c1ccdd52425ed4a0a41a7c9259e5b45d7844adb8ec`.
- [x] Back up the six installed program files and overwrite only the same authorized plugin directory; verify all six installed hashes and unchanged storage/enable config. Backup: `artifacts/install-backups/budde-icons-20261111-160317/`; state hash unchanged, absent enable-config path remained absent.
- [x] Report actual visual changes and restart requirement; do not claim unseen native-host acceptance. See `docs/validation.md`; preserve branch/worktree, no commit/merge/push.
