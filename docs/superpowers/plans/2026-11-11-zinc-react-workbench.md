# Zinc React Workbench Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 按四阶段要求将 Budde 生产工作台迁移到 React/Tailwind/shadcn/Zinc，保留已验证的本地产品行为并完成双尺寸截图闭环。

**Architecture:** 保留已测试的命令/草稿/生命周期控制器和公开 mountWorkbench 合约，将字符串 HTML 视图替换为 React 视图，依赖事件委派的控件保持稳定的 data-part hooks。React 负责组件、Lucide、dnd-kit sortable 和 Motion；已有 DraftSession、单调 refresh、mutating 锁与实例内 dialog 焦点/inert 管理继续为行为真相。所有基础组件集中维护；Tailwind 禁用全局 preflight，前缀与实例作用域防止污染思源。

**Tech Stack:** React 19、TypeScript TSX、Tailwind CSS 3.4（prefix bd- + important .budde）、shadcn/ui owned-source + Radix primitives、lucide-react、framer-motion、@dnd-kit/core/sortable、esbuild/PostCSS、Playwright/Edge。

**Spec:** [ui-design-system.md](../../../ui-design-system.md)

## Global Constraints

- 工作区 `#F9FAFB`，侧栏/列 `#F3F4F6`，surface 白色，边框 `#E4E4E7`，阴影最多 shadow-xs。
- 36px 控件；20px 页面标题、14px medium 列/卡标题、12px 元信息；所有计数 tabular-nums。
- 列 min-width 240px，卡 p-3.5/gap-2.5，详情 p-6。中文无孤字折行，描述 line-clamp-2。
- 宿主容器 h-full/min-h-0/overflow-hidden；独立看板和详情滚动；预览 h-screen。
- Motion duration 0.2s 并尊重 reduced motion；dnd-kit overlay 半透明，跨阶段调用现有乐观版本命令，不虚构持久化排序。
- 保留草稿保存/放弃/取消、失败/冲突、pending locks、refresh 单调、多实例、destroy 后无 DOM/焦点副作用。
- 不更改核心数据，不改旧静态原稿，不用真实事项，不提交/合并/推送、不自动安装思源。
- 用户已确认：工作树共享依赖联接移至 artifacts 备份并安装独立依赖；只批准 esbuild@0.25.12 与 esbuild@0.28.2 安装脚本。

## Review Focus

1. IME、请求幂等、重复操作与异步刷新/销毁竞态。
2. 编辑草稿的 expectedVersion 与错误/冲突保留。
3. CSS、portal、inert、焦点和 ID 的实例隔离。
4. 中文/URL/长类型和阶段/大计数、空状态和窄容器。
5. 完成阶段语义、暂停/归档、笔记、设置迁移、键盘等效操作。

## File Map

- 根 ui-design-system.md / AGENTS.md：永久规则及入口（阶段一）。
- package.json / pnpm-lock.yaml / pnpm-workspace.yaml：隔离依赖、精确脚本许可与命令。
- components.json / tailwind.config.ts / tsconfig.json：shadcn、Tailwind 与 TSX/别名配置。
- scripts/css.mjs / build.mjs / preview.mjs：共享 PostCSS 构建，生产和预览同源样式。
- src/ui/lib/utils.ts / react-renderer.tsx：cn、实例 ID/渲染桥；控制器仍拥有挂载/销毁。
- src/ui/components/ui/：Button、Input、Textarea、NativeSelect、Badge、Dialog、DropdownMenu、Tooltip，源码统一。
- src/ui/components/icons.tsx：Lucide 语义映射，不再维护原生 SVG 图标库。
- src/ui/workbench-view.tsx / collection-view.tsx：导航、捕获、统计、列表、sortable 卡片/列。
- src/ui/detail-view.tsx / settings-view.tsx / guard-view.tsx：React 表单、详情、stepper 与设置视图。
- src/ui/index.ts / detail.ts / settings.ts / dialog.ts：只替换渲染和拖拽接缝，保留成熟命令保护。
- src/ui/styles.css / tokens.css：Tailwind 入口、scoped reset 与语义颜色，无页面组件手写 CSS。
- tests/ui-stack.test.ts / scripts/verify-design-system.mjs：栈与构建/视觉/几何回归。
- docs/validation.md：最终命令、截图、差异及仍未完成的实机验收。

## Task 1 — 规则落盘（阶段一）

- [x] 写入完整规范并链接 AGENTS.md。
- [x] 明确 Tailwind 默认 Zinc 与指定 hex 的差异、14/10px 密度例外、宿主容器边界。

## Task 2 — 可构建的隔离技术栈（阶段二）

- [x] 检查现有 package.json；保留共享联接备份后安装工作树独立依赖。
- [x] 用户精确授权两个 esbuild 安装脚本；记录 allowBuilds，保持其它脚本策略。
- [x] 新增失败的栈/样式构建测试，执行并确认原因。
- [x] 配置 TSX、shadcn aliases、Tailwind prefix/scoped important、语义 palette 与 PostCSS 构建。
- [x] 跑栈测试、旧单元测试与生产构建，确认依赖真实可用后进入阶段三。

## Task 3 — 共享基础组件与 React 视图（阶段三）

- [x] 先增加新设计的浏览器验收（240px 列、指定颜色、密度、无外层溢出、Lucide、真实 DnD/动画），确认旧版失败。
- [x] 基础组件遵循 shadcn 所有权模式；NativeSelect 保留原生键盘语义/控制器接缝；Radix 菜单/tooltip 使用本地 portal、非全局 modal；native Dialog/Sheet 保留既有实例内焦点管理。
- [x] 保留实例 data-part 与 ID/ARIA 映射，建立可销毁的 React renderer。
- [x] 导航/捕获/统计/列表及看板迁移；dnd-kit 用稳定 ID 和键盘 sensor、半透明 Overlay；Motion 重排 0.2s。
- [x] 详情/笔记/stepper、guard 和设置迁移；保留已有草稿与冲突保护，抽屉独立滚动和 0.2s 位移。
- [x] 删除生产入口的字符串 HTML 和原生 drag/drop 依赖，但不擅自删除历史原稿/原始实现文件。
- [x] 跑交互、生命周期、几何与宿主测试，修正真实回归，不能用删功能断言换绿。

## Task 4 — 双尺寸视觉闭环（阶段四）

- [x] 新规范替代旧静态 parity 尺寸断言：记录旧断言为何过时，保留图标/状态/长文/hover 回归。
- [x] 1440×900、1280×800 浅色看板与详情截图；检查真实像素、滚动、列与计数分离、抽屉留白。
- [x] 检查深色、小容器、长中文/英文与大量内容，修复后重跑截图。
- [x] pnpm check、test:ui、test:plugin、git diff --check；用户 19:42 同意覆盖旧包后，另行通过 package:plugin / test:release，备份后覆盖本地发布 ZIP，不实际安装思源。
- [x] 完整 diff 自查 + 一个只读独立复核，修复重要发现并回归。
- [x] 更新验证文档与计划状态；提供截图和可打开预览/产物，明确真实思源尚未覆盖/验收。

## Final Verification — 2026-11-11

- 四阶段均已完成；生产组件与正式插件构建共用 React/CSS，不使用静态原型替代验收。
- 最终串行执行 `pnpm check`、`pnpm test:ui`、`pnpm test:plugin`、`git diff --check`，整条命令 exit 0：29 项单元/存储测试，UI 9、生命周期 12、几何 70、当前规范 parity 11、设计系统 10、高级宿主 14 组通过。
- 人工逐张打开 [1440×900 看板](../../../artifacts/qa/zinc-react/1440x900-board.png)、[1440×900 详情](../../../artifacts/qa/zinc-react/1440x900-detail.png)、[1280×800 看板](../../../artifacts/qa/zinc-react/1280x800-board.png)、[1280×800 详情](../../../artifacts/qa/zinc-react/1280x800-detail.png)、[深色看板](../../../artifacts/qa/zinc-react/1280x800-dark.png)。列伸展到滚动视口底部，标题截断不挤计数；详情 420px、p24、独立滚动，未见外层横向溢出或双滚动条。
- 独立只读复核指出键盘拖动失去焦点和宿主祖先滚动两条路径；浏览器先重现，再修复。第三条待验证的空列低位碰撞假设也在浏览器重现并修复。新增回归还验证同实例其他控件/第二实例焦点、键盘放下后的安全焦点恢复、reduced-motion 实际开关抽屉；所有发现已回归通过。
- dnd-kit 6.3.1 的传感器没有 public disposal API，私有兼容接缝集中在 [owned-sensors.ts](../../../src/ui/lib/owned-sensors.ts)；更换 dnd-kit 版本必须重新运行宿主释放/多实例/滚动测试。
- 旧 parity 中历史 SVG path/侧栏宽度等断言已按当前规范迁移，但保留实际图标、hover/active、长阶段文本、容器与滚动行为断言；历史设计源没有改写。
- 初次 UI 验收时暂缓覆盖历史 ZIP；用户随后明确同意覆盖旧包，已备份后运行 `pnpm check` / `package:plugin` / `test:plugin` / `test:release`，完整命令 exit 0，生成 332,760-byte React/Zinc 发布包。备份、新包、SHA-256 和可复现/合成升级校验见[验证记录](../../validation.md)。没有实际思源安装/重启，没有提交、合并或推送；保持当前分支和工作树。真实思源、macOS/Linux 原生验收仍待进行。

## Execution Ledger

- 2026-11-11：阶段一已完成。初次依赖安装因共享 junction 的 virtual-store-dir-max-length 配置不一致退出；用户批准工作树隔离后，将联接原样备份到 artifacts/dependency-backups/node_modules-shared-20261111-180143，主仓目录未改动。
- 2026-11-11：运行时依赖安装成功，但 pnpm 拦截 esbuild 安装脚本；用户批准两个精确版本后完成 rebuild 和 Tailwind/PostCSS/types 安装，exit 0。
- Ruling: 使用 Tailwind 3.4 而非强行升级 4.x — 用户没有规定版本，3.4 的稳定 prefix/important scope 适合思源宿主隔离，shadcn v3 风格配置可复用；shadow-xs 显式定义。
- Ruling: 保留业务控制器、用 React 替换视图 — 既有生命周期回归覆盖了大量竞态；重写业务状态机没有用户价值且增加数据风险。源码不再以 HTML 字符串作为生产视图。
- Ruling: 不执行计划惯例中的 commit — 用户未授权，优先保留广泛未提交的既有工作。
