# 正式插件工作台接入实施计划

> 执行方式：Lead 单写入、当前已隔离 worktree 内执行；只读代理探索/复核。不自动 commit、merge、push，不安装到真实工作空间。

## 目标与已确认契约

用户已授权“直接完整接入”：沿用已确认交互与 alpha.1 范围，不再逐项设计确认，交付可安装包。

规范：`../specs/2026-11-11-workbench-design.md` 的功能约束；`../../../design/workbench-v2-preview/DESIGN.md` 的 36px 中性设计契约及页面样张（覆盖旧绿色/40px/默认可编辑设计）。

- `src/index.ts` 继续用 `mountWorkbench(element, BuddeClient, NoteBridge) -> {refresh,destroy}`；不改业务命令、文件锁或数据格式。
- 工作台包含想法池、按类型看板、跨类型推进列表、归档；标题记录使用独立类型与幂等请求。先阅读，点击编辑才进入草稿；保存明确，失败/冲突保留输入，不静默合并或放弃。
- 详情显示阶段路径与当前位置。顺序不是历史，完成仅由 `Stage.completed` 判定。浏览不修改复查时间，只有显式复查/进展命令修改。
- 类型/阶段管理保留版本冲突、草稿保护和包含归档的迁移提示；JSON 导出完整本地状态，不导出笔记正文。
- 根容器隔离样式/ID/事件/对话框；按容器而非窗口宽度响应。已有功能原型只移植业务交互，不导入 fixture、demo 时钟、全局主题控制或模块级启动。
- 采用 approved token 值与组件契约：普通控件 36px、图标16px、详情420px、索引144px；深浅主题继承宿主，强调不使用彩色 primary。窄面板不会缩控件。减少动态效果，键盘可用。
- 不承诺原生宿主已验收；真实思源安装需另获工作空间路径与授权。所有验证用合成/临时数据。

## Task 1 — 建立生产模型和草稿测试

文件：新增 `src/ui/model.ts`、`src/ui/draft.ts`、`tests/ui-model.test.ts`。

1. 先写红测试：真实时钟可注入的复查谓词；池/看板/活跃/归档集合；幂等捕获；草稿保存失败/冲突/重复提交保护。
2. 从已验证功能原型迁移纯模型与 DraftSession，去除示例会话依赖；只依赖 core/types。
3. 跑新测试到绿，再检查现有核心18测试无回归。

## Task 2 — 接入正式交互控制器

文件：替换 `src/ui/index.ts`；新增 `src/ui/view.ts`、`detail.ts`、`settings.ts`、`dialog.ts`、`dom.ts`。

1. 先为真实 production UI 写浏览器契约（使用现有 preview）：阅读→编辑、路径语义、草稿离开保护、失败和冲突、links、board/type/archive/settings/export。
2. 从 functional prototype 提取控制器，不更改 design 目录；删除 demo boot、fixture、固定时钟与故障工具。
3. 使用实例内 ID/查询及确认层；对话框在插件区域内，不能用 native showModal 锁住整个思源；显式焦点圈定/恢复与 Escape。支持嵌套确认。
4. 防重复提交、捕获输入失败保留、忙碌态 aria-busy/disabled；异步结果在 destroy 后不重绘。保留 src/index.ts 的周期 refresh 契约。
5. 详情默认阅读，编辑/保存/取消清晰；只在明确保护选择后才丢弃草稿。读写配置改变后保留草稿及冲突提示。

## Task 3 — 规范化生产视觉与容器布局

文件：替换 `src/ui/styles.css`，新增 `src/ui/tokens.css`；`scripts/verify-ui.mjs`。

1. 将 V2 canonical tokens 一次性迁移为 production 唯一源，样式限制于 .budde；无 host/global reset 或彩色 primary。
2. 全部生产入口（含管理/确认/错误恢复）统一 36px；内容卡/笔记为明确例外；SVG统一16px/品牌24px。
3. 固定容器布局与面板宽度；容器 <1200 详情覆盖，<720 全宽，<360 仅减内边距；320px不横向溢出。
4. 增加 browser 几何/主题/宿主污染/多实例/键盘/动态缩放验收与截图，不启动长期替代服务器。

## Task 4 — 验收、打包、文档和复核

文件：`scripts/preview.mjs`、`scripts/verify-ui.mjs`、`scripts/smoke-plugin.mjs`（必要时），新增 `scripts/package.mjs`；更新 `package.json`、`README.md`、`PRODUCT.md`。

1. 扩充隔离 preview 测试注入点；运行真实生产 UI 的完整自动化。测试数据与工具不进入构建。
2. `pnpm check`、`pnpm test:ui`、`pnpm test:plugin`；浏览器实看深浅与宽/窄截图；收集全部后台任务结果。
3. 只读审查重点：草稿/版本/幂等、异步卸载、宿主/多实例隔离、容器布局/控件规范、demo泄漏、打包范围。
4. 构建 dist 并生成 ZIP（标准根目录插件文件，不带 fixtures、node_modules 或工作空间数据），验证清单与散列。
5. 更新安装/支持边界、阅读编辑使用说明、测试证据；交付安装包及简短总结，不伪称真实思源走测完成。

## 已知基线

- 当前 linked worktree：workbench-prototype，保留未跟踪的批准视觉资产。
- `pnpm check` 基线已启动。现有 node_modules 为指向主仓的 junction，pnpm 前置自动校验会安全拒绝删除；不安装/重建依赖或修改持久设置。
- 原有 browser 断言面向旧 UI，必须替换为新的真实交互契约，不能靠只改断言文案掩盖功能缺失。

## 执行记录（2026-11-11）

- Task 1 完成：纯模型/幂等捕获/草稿会话及 6 项回归，核心与平台合计 27 项测试；没有改变存储格式、文件锁或业务命令。
- Task 2 完成：正式 UI 控制器、默认阅读详情、草稿保护、已有笔记关联、类型/阶段设置、JSON 导出与销毁清理。NoteBridge.open 增加可选 AbortSignal，避免视图销毁后的迟到宿主跳转。
- Task 3 完成：唯一 production token 源、36px 控件、宿主主题、实例/容器隔离；10 张详情宽度/主题截图，70 组主视图、设置编辑、确认和详情编辑几何组合。已看宽屏详情、320px 明暗详情、窄主屏与设置截图。
- Task 4 完成：生产 UI 交互与生命周期浏览器套件、构建 CJS 的 DOM 宿主模拟、依赖零新增的 allowlist ZIP、可重复打包、散列、标准解压、临时工作空间连续安装及 storage/启用配置字节保护；文档更新为正式 alpha.1。最终命令与已知边界见 [验证记录](../../validation.md)。
- 两轮只读审查由 Lead 逐项重现并修复：data-id 前缀误改、reload 忙碌保护、设置打开 single-flight/销毁守卫、旧保存响应/配置单独更新/忙碌期间配置失效、延迟笔记打开、覆盖层焦点与 guard 缩放后的 inert。额外几何矩阵发现设置 implicit grid 溢出，显式约束轨道修复。
- 批准的 V2 原型与原计划未修改；V2 HTML SHA-256 仍为 `5be356c7e213ca627f1b035720dfea4aa112f0cefa284207cb5a6ab9ae64c3be`。
- 不做真实思源安装、自动 commit/merge/push；原生思源、macOS/Linux 实机验收保持明确未验证。
