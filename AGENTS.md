# Budde

- Before any UI work, read and follow [ui-design-system.md](ui-design-system.md). It is the current persistent UI architecture, visual, interaction and verification contract, superseding earlier visual prototypes where they conflict.
- This is a SiYuan plugin, not a standalone product. Keep runtime code offline and local.
- Product source of truth: SiYuan document `20261111001236-5io3spm` (Budde｜需求文档).
- Use `pnpm check` after substantive changes; UI changes also require browser inspection.
- Never store credentials or private workspace data in the repository or fixtures.
- Preserve collaborators' edits. Keep core logic independent of SiYuan and UI.
- Scope for alpha.2: desktop plugin, idea capture, contextual type/stage configuration with optional icon/color and templates, per-type boards, wrapped vertical stage path, details, links, archive/pause, JSON export, shared idempotent/versioned mutations. Preserve schemaVersion 1 and exact legacy omissions.
- Multi-device concurrent editing and external AI adapters remain unsupported. Do not claim otherwise.
