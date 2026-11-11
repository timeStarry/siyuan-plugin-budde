# Budde Workbench Prototype Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** 交付「聚焦一个类型」的独立可点击工作台原型，演示已确认的记录、推进、详情、草稿和配置行为，不修改正式插件。

**Architecture:** 原型源码独立放在 `design/workbench/`，esbuild 输出可直接打开的本地 HTML/CSS/IIFE 脚本到 `artifacts/design/workbench/`。复用现有 `BuddeService`、`MemoryStore` 与类型；单一合成状态派生各视图。原型 UI、演示故障、主题工具和浏览器验证不进入正式插件构建。

**Tech Stack:** TypeScript DOM/CSS、现有 esbuild / tsx / node:test / Playwright，Edge；无新增依赖。

**Spec:** [已确认的工作台设计](../specs/2026-11-11-workbench-design.md)，验收映射见 [验证清单 C01–C22](../../design/workbench-validation.md)。

## Global Constraints

- 本轮交付是**独立可点击设计稿及说明**。不修改正式插件 UI、核心业务、持久化或宿主桥接；正式 UI 落地另行确认。
- 技术继续使用 TypeScript DOM/CSS，不引入框架、线上字体或远程素材。
- 默认打开「想法池」；标题上限沿用核心 500 字；复查沿用 14 天规则。
- 采用显式保存。版本冲突保留本地全部输入，不覆盖他人修改，不宣称自动合并。
- 颜色映射至 `--b3-theme-background`、`--b3-theme-surface`、`--b3-theme-on-background`、`--b3-theme-on-surface`、`--b3-border-color`、`--b3-theme-primary` 等语义变量。
- 窄分屏适配不是新增移动端支持。验证尺寸为 1440×1000、1024×768、720×900、480×800。
- 不调用真实 SiYuan API、文件存储、网络或 localStorage。刷新重置，界面明确标注示例数据。
- 主控是唯一写入者，其他代理只读；不推送、不合并。执行前使用 using-git-worktrees 建立隔离；文档和实现只做任务相关提交。
- 不触碰原有 `src/`、`scripts/`、`tests/`、依赖、锁文件或生产构建入口；原型有自己的测试与类型检查。

## Review Focus

1. 标题、说明及类型名称含 HTML、引号、重复名称：字面显示，无脚本执行，选择以 ID 而非名称为键。归 Task 2/4 浏览器测试。
2. 中文组词回车、快速重复提交、筛选与创建类型不同：不误提交、不重复、不隐式推进。归 Task 1/2。
3. 保存已提交但响应丢失、过期草稿、设置版本变化：失败不清空输入；同一请求重试只创建一次；配置不覆盖外部修改。归 Task 1/3/4。
4. 类型/阶段改名或重排、同名阶段、初始阶段删除、归档引用：完成与推进语义按属性和 ID 保持，迁移完整。归 Task 4。
5. 长标题、多阶段、窄容器打开详情后缩放、Escape 和嵌套确认：无外层溢出或丢稿，焦点可达并正确返回。归 Task 3/5。

## File Map

全部为新增文件；正式代码只读导入，不复制或重写核心规则。

| 文件（拟建） | 职责 |
| --- | --- |
| `design/workbench/fixture.ts` | 固定演示时钟、单一合成状态、示例笔记 |
| `design/workbench/model.ts` | 演示内存客户端、故障注入、集合派生、幂等捕获请求 |
| `design/workbench/model.test.ts` | 夹具、谓词、默认类型和失败/重试测试 |
| `design/workbench/main.ts` | 挂载、导航、搜索、记录、事件路由与演示工具 |
| `design/workbench/view.ts` | 安全 HTML、图标、列表/看板渲染；不写业务数据 |
| `design/workbench/styles.css` | 思源语义 token、焦点、组件、容器响应式 |
| `design/workbench/draft.ts` / `draft.test.ts` | 可测试的详情草稿和保存状态，不依赖 DOM |
| `design/workbench/detail.ts` | 详情表单、关联、状态动作、关闭/跳转确认 |
| `design/workbench/settings.ts` | 独立类型/阶段对话框与配置草稿保护 |
| `design/workbench/index.html` / `build.mjs` | 无网络本地页面壳与独立 esbuild 入口 |
| `design/workbench/tsconfig.json` | 扩展根配置，仅检查原型及只读核心导入 |
| `design/workbench/verify.mjs` | 浏览器行为、故障、主题/分屏检查与截图 |
| `design/workbench/README.md` | 打开/构建/测试、示例限制、截图与结果索引 |

## Task 1: 单一合成状态与演示客户端

**Files:** Create `fixture.ts`, `model.ts`, `model.test.ts`, `tsconfig.json` under `design/workbench/`.

**Interfaces:**
- Consumes: `createInitialState`, `validateState`, `BuddeService`, `MemoryStore` from existing core; `BuddeClient`, `BuddeState`, `Item`, `Command`, `NoteBridge`.
- Produces: `DEMO_NOW = "2026-11-11T00:00:00.000Z"`; `createDemoState(): BuddeState`.
- `View = "pool" | "board" | "active" | "archive"`; `Filters = { query: string; typeId: string; unpromotedOnly: boolean }`.
- `selectItems(state: BuddeState, view: View, filters: Filters): Item[]`; `needsReview(state: BuddeState, item: Item, now: string): boolean`.
- `createDemoSession(): DemoSession`, where `DemoSession` exposes stable `client: BuddeClient`, `notes: NoteBridge`, `armFault(mode: "none" | "reject-next" | "lose-response"): void`, `simulateExternalChange(id: string): Promise<void>`, `reset(): Promise<BuddeState>`.
- `CaptureRequest.prepare(title: string, typeId?: string): Extract<Command, {kind: "item.create"}>`; `CaptureRequest.success(): void`. Repeated unchanged input keeps its requestId until success.

- [x] **Step 1: Write failing model tests.** Core assertions:
  ```ts
  assert.equal(validateState(createDemoState()).items.length, 15);
  assert.equal(selectItems(seed, "pool", all).length, 14);
  assert.equal(selectItems(seed, "board", all).length, 12);
  assert.equal(selectItems(seed, "active", all).length, 6);
  assert.equal(selectItems(seed, "archive", all).length, 1);
  ```
  Assert the active software initial-stage item has an empty nextStep and is included; paused/completed/unpromoted/archived are excluded only where appropriate. Paused promoted overdue items can need review; unpromoted/completed/archived never do. Test the 14-day exact boundary. Retry after `lose-response` creates exactly one item; `reject-next` changes nothing; same CaptureRequest content keeps requestId; changed content gets a new one. A removed general type falls back to the first remaining type.
- [x] **Step 2: Run red.** `node node_modules/tsx/dist/cli.mjs --test design/workbench/model.test.ts`; expected missing exports/module before implementation, then assertion failures if counts/semantics are wrong.
- [x] **Step 3: Implement the interfaces.** Seed the 12 promoted/unarchived items described in the validation table (4 paused, 2 complete, 6 active), plus 2 unpromoted and 1 archived. Use existing preset IDs/stages, synthetic dates and valid synthetic block IDs; no real note contents. Default review time can be 2026-10-20 for an overdue sample. Inject failure only into the next mutation, before or after actual service execution as named. Mock note opening only reports a demo action; invalid/external note targets reject.
- [x] **Step 4: Run green and typecheck.** Repeat model test; `node node_modules/typescript/bin/tsc -p design/workbench/tsconfig.json`; expected zero failures/errors. Browser model must not import node-file-store or SiYuan runtime.
- [x] **Step 5: Commit** only the four new files, message `feat(design): add isolated workbench demo model`.

## Task 2: 可打开的布局、集合与快速记录

**Files:** Create `main.ts`, `view.ts`, `styles.css`, `index.html`, `build.mjs`, `verify.mjs`; extend model tests only if a demonstrated gap needs it.

**Interfaces:**
- Consumes: Task 1 `DemoSession`, `View`, `Filters`, `selectItems`, `CaptureRequest`.
- Produces: `mountPrototype(root: HTMLElement, session: DemoSession): { refresh(): Promise<void>; destroy(): void }` in `main.ts`; `escape(value: unknown): string` and `renderItems(state: BuddeState, view: View, filters: Filters, selected: string): string` in `view.ts`.
- Expose isolated browser-test access as `window.buddePrototype = { client: session.client, refresh, reset: session.reset }`; no production global.
- `build.mjs` emits `artifacts/design/workbench/index.html`, `prototype.js`, `prototype.css` with relative references; no module/file fetch and no server. `verify.mjs` builds, opens a `file:` URL in headless Edge, runs named groups (`--group=shell` initially; no argument runs all defined groups), closes browser in finally, fails nonzero on assertion or page errors.

- [x] **Step 1: Write failing browser group `shell`.** Assert default pool and 14 items; explicit create-type select independent from filter; pool/unpromoted, board/type index, active and archive collections; visible empty-state recovery. Record two titles continuously; confirm only success clears/refocuses; synthesised composing Enter does not submit; double submission makes one record; board capture stays unpromoted and links back to pool. HTML-like title `<img src=x onerror=alert(1)>` appears as literal text, with no injected image/dialog. Assert 500-char acceptance and 501-char rejection/preserved input.
- [x] **Step 2: Run red.** `node design/workbench/verify.mjs --group=shell`; expected missing page/build entry or absent required UI, never a silent skip.
- [x] **Step 3: Implement the shell and capture.** Build semantic buttons/forms with event delegation and native labels. Separate current view/filter/type from new-item type. Focus one board type; list cross-type active items including initial-stage/blank-nextStep. Type picker is neutral, only capture submit gets the primary treatment. Render from model and preserve capture/query focus, caret and text across updates. Keep stable dialog/overlay mount nodes outside replaced content.
- [x] **Step 4: Run green.** Shell group, model tests and prototype typecheck pass; file works with no network request or console errors. Save the first wide screenshot, noting detail is not implemented yet.
- [x] **Step 5: Commit** the new shell/build/test files, message `feat(design): add focused workbench shell and capture`.

## Task 3: 详情、草稿保护、关联与版本冲突

**Files:** Create `draft.ts`, `draft.test.ts`, `detail.ts`; modify prototype `main.ts`, `styles.css`, `verify.mjs`.

**Interfaces:**
- Consumes: core `ItemPatch`, `BuddeClient`, `NoteBridge`, `DemoSession`; Task 2 mount/refresh.
- Produces: `DraftSession` in `draft.ts` with readable `item?: Item`, `dirty: boolean`, `status: "saved" | "dirty" | "saving" | "error" | "conflict"`, `error: string`; `select(item?: Item): void`, `edit(patch: ItemPatch): void`, `save(client: BuddeClient, extra?: ItemPatch): Promise<BuddeState>`, `discard(latest?: Item): void`. Save retains inputs and expectedVersion on rejection, advances draft/version only on success.
- `mountDetail(container: HTMLElement, options: { client: BuddeClient; notes: NoteBridge; onSaved(state: BuddeState): void; onClosed(): void }): { open(item: Item): Promise<boolean>; requestClose(): Promise<boolean>; refresh(state: BuddeState): void; destroy(): void }` in `detail.ts`. False means a dirty/error action cancelled navigation. Internal dialog choices are save/discard/continue, and destructive reload is separately explicit.

- [x] **Step 1: Write failing draft tests + browser group `detail`.** Test failed/stale save keeps title/nextStep/links/version, successful save clears dirty, outside refresh does not replace dirty form. Browser: title/type/stage/nextStep/description Save; type change requires target stage; switch/close/Escape with dirty data offers all choices; failed save does not perform queued navigation. Open/close returns focus; select same item does not reset. Add/remove synthetic note references stays draft until save; invalid target and mock open failure leave original links intact. Pause/archive/review confirmation clearly includes saving edits, cancelling leaves both unchanged. Simulate `lose-response` capture retry and selected-item external change without losing local input.
- [x] **Step 2: Run red.** Draft test and `node design/workbench/verify.mjs --group=detail`; expected missing draft exports/detail form or incorrect transitions.
- [x] **Step 3: Implement interfaces and connect navigation.** Workbench view/type switches route through `requestClose`; title search/general filters preserve open draft. Use expectedVersion from the draft, never overwrite it with background snapshot. Stage selectors/card menu are keyboard alternatives; drag writes only same-type stage, never ordering. Dirty same-item card actions require explicit resolution. Disable mutating controls during save; errors remain visible and actionable.
- [x] **Step 4: Run green.** Both node test files, detail + shell groups and typecheck pass; no success before command commitment, no input loss after failure or cancelling navigation.
- [x] **Step 5: Commit** only prototype files, message `feat(design): add draft-safe details and conflict recovery`.

## Task 4: 生命周期设置、归档与导出

**Files:** Create `settings.ts`; modify prototype `main.ts`, `styles.css`, `verify.mjs`.

**Interfaces:**
- Consumes: existing core configuration commands and expectedRevision; Task 2 shell; Task 3 dirty confirmation conventions.
- Produces: `mountSettings(dialog: HTMLDialogElement, options: { client: BuddeClient; onSaved(state: BuddeState): void; onClosed(): void; confirmDiscard(): Promise<boolean> }): { open(): Promise<void>; requestClose(): Promise<boolean>; destroy(): void }` in `settings.ts`.
- JSON export delegates to `client.exportData()` and downloads the returned string; include notice that note bodies are excluded.

- [x] **Step 1: Write failing browser group `settings`.** Add/rename type, add/rename/reorder stages, initial/completed flags independently; duplicate names selected by ID; draft names containing HTML stay literal. Nonempty type deletion (including archived-only use) rejects. Delete occupied or initial stage only with valid migration target; archived references migrate and versions change. Settings input survives snapshot refresh; external revision makes save reject while preserving local text; explicit reload discards only after confirmation. Dirty close/Escape can cancel. Archive/restore preserves stage and paused state; exported JSON matches current sample and `noteContentsIncluded === false`.
- [x] **Step 2: Run red.** `node design/workbench/verify.mjs --group=settings`; expected absent settings operations or failed guards.
- [x] **Step 3: Implement interfaces.** Settings is reachable from More and board index, uses native dialog and existing commands, retains config revision from its loaded snapshot. Show migration impact including archived references; no import, permanent delete or create-document affordance. Restore archive without changing paused/promoted/stage fields. Close dialogs through guarded paths; parent rerenders must not recreate an open dialog and lose input.
- [x] **Step 4: Run green.** All existing browser groups, node tests and prototype typecheck pass; verify export is demo-only and every mutating setting uses expectedRevision.
- [x] **Step 5: Commit** prototype changes, message `feat(design): add lifecycle management and archive flows`.

## Task 5: 宿主主题、窄分屏、完整验证与交付

**Files:** Modify prototype `styles.css`, `main.ts`, `detail.ts`, `settings.ts`, `verify.mjs`; create `README.md`; update validation/design documents with actual evidence only.

**Interfaces:**
- Consumes: the complete Task 1–4 prototype and browser groups.
- Produces: labelled demo-only foldout for light/dark, reject-next/lose-response, external item/config change and reset; same underlying `DemoSession`. `verify.mjs` adds `visual` group and writes `artifacts/design/workbench/results.json` plus named screenshots.

- [x] **Step 1: Write failing `visual` checks.** At all four specified sizes and both themes, assert outer scrollWidth <= viewport/root width; board has its own scroll container; detail switches from side rail to overlay/full pane by container width; selected item and list scroll restore on return. Tab/Escape and confirmation maintain visible focus. Override host semantic background/primary tokens and inherited font in-browser; computed styles must follow them without fixed-white leaks. Long titles and 6 stages with long/same-name labels remain operable without external overflow. Resize an open dirty detail from wide to 480px and back without discarding it. Overlays/dialogs stay inside the prototype container, not an assumed full host viewport.
- [x] **Step 2: Run red.** `node design/workbench/verify.mjs --group=visual`; expected evidence of unsupported theme/layout/focus paths before responsive finishing.
- [x] **Step 3: Implement token/container responsiveness and demo controls.** Use the chosen layout, system font, 20/14/12px hierarchy, 40px main controls, neutral borders and one primary action. Around >=1200px use optional 320px rail; 720–1199px overlay; <720px type selector/full-pane detail; builder may adjust thresholds only to keep agreed behavior readable. Status needs text, not color alone. Hide no essential operation behind hover; no decorative imagery or application shell.
- [x] **Step 4: Run full checks serially.** Prototype typecheck, both node test files, `node design/workbench/verify.mjs` (all groups), then repo `pnpm check`. Read any failure before deciding next action. Existing baseline lock timeout must not be “fixed” by changing core or increasing timeouts within this UI task. pnpm dependency auto-install/store warnings do not authorize purging/reinstalling; use current installed tools for isolated verification and report baseline separately if full check cannot pass.
- [x] **Step 5: Inspect actual screenshots** (wide pool/board/detail, dark, 720/480 overlay, settings, failure/conflict). Run the available Impeccable detector against final authored HTML/CSS as applicable and resolve supported actionable findings. Compare selected layout by hierarchy, not screenshot pixel matching; record remaining gaps explicitly.
- [x] **Step 6: Write opening/build/test instructions and evidence.** C01–C22 each links to a real check/result or is clearly marked unverified (especially actual OS IME and real SiYuan host). Include “示例数据，刷新重置”, no host acceptance claim. Request one fresh read-only whole-prototype review; Lead fixes material findings, reruns affected/full checks, and commits only scoped changes.
- [x] **Step 7: Deliver the independently openable prototype** with design note, summary/screenshots and exact verification status. Do not install or replace the plugin. Ask for feedback/production implementation authorization only after the user can inspect the prototype.

## Self-review / Coverage

- IA and selected layout: Task 2; dirty/async/association flows: Task 3; settings/archive/export: Task 4; theme/container/accessibility/demo controls: Task 5; semantic invariants and stable retries: Task 1.
- C01–C05/C07–C08: Task 1/2; C06/C09–C15: Task 1/3; C16–C17: Task 4; C18–C21: Task 5; C22: Task 1 and final UI evidence. Five Review Focus classes each have owning assertions above.
- Interfaces use the same `DemoSession`, `DraftSession`, `BuddeState` and mount return methods throughout; no second business state machine or new production endpoint.
- Deliberately unverified by a local prototype: real SiYuan windows, real note/kernel operations, OS IME composition beyond synthetic events, mobile/browser support and cross-device behavior. These are not design acceptance claims.

## Execution Handoff

设计与本计划均已获用户明确确认，开始执行。按用户单写入规则采用主控在当前会话原生执行（executing-plans），最后进行一次独立只读整体复核；不启动多个实现写入者。先提交已确认的设计文档，再在隔离 worktree 按任务验证与提交；不合并或推送。
