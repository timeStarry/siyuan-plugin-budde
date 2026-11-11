# Workbench Token Normalization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** 补齐当前 V2 静态草图的中性设计 token 与控件规范，再以同一来源统一整页。

**Architecture:** 保留独立 HTML 架构，将唯一来源拆为 HTML 内三个有标识的样式块：`budde-tokens`、`budde-components`、`budde-layout`。常规操作统一消费 `.button` 尺寸契约；内容入口另行分类。生成的离线组件样张与 CSS 直接抽取这些块，避免平行规范漂移。

**Tech Stack:** 原生 HTML/CSS/JavaScript；Node.js；已有 Playwright + Edge；无新增依赖。

**Spec:** [页面设计规范](../../../design/workbench-v2-preview/DESIGN.md)

## Global Constraints

- 固定常规操作高度 36px、图标按钮 36×36px、界面图标 16px，品牌图标独立 24px。
- 黑白灰；保留文字/表面/字体的宿主适配，不使用彩色 primary。
- 仅迁移静态草图；不修改正式插件、核心、存储或现有交互原型。
- 不新增网络、持久化、真实数据或服务器，不安装依赖。
- 单写入者，复核只读；不自动提交、合并或推送。

## Review Focus

1. 内容型卡片/笔记入口不能误按普通按钮强制 36px。
2. 窄详情下工具栏按钮不应被 flex 挤成非正方形；关闭详情后的看板也不能使根页面溢出。
3. hover/pressed 的 computed color 可能是 `color(srgb ...)`，对比度解析须正确处理。
4. focus、disabled、loading 的示例不能产生业务写入；禁用不能被 JS 全局事件监听器误激活。
5. 组件样张必须来自当前页面的实际样式块，而非手写第二套值。

---

### Task 1: 先固定浏览器尺寸验收

**Files:** 修改 `design/workbench-v2-preview/render.mjs`。

**Interfaces:** 读取页面已有 selectors、三段 CSS、实际按钮盒模型；生成尺寸/排版/状态验收记录。

- [x] 添加 `assert.equal(control.height,36)`、`assert.equal(icon.width,36)`、字体 13px/行高 20px、圆角 6px、界面图标 16px 检查；排除 `.item-card`、`.note-link` 两种明确的内容入口。
- [x] 执行 `node design/workbench-v2-preview/render.mjs`，确认旧稿因主题/图标按钮等尺寸不符而失败，不因缺依赖失败。
- [x] 新增状态检查、窄分屏关闭后的根溢出检查及 source-styles 唯一来源检查；保留所有原有静态/键盘/主题/宿主探针断言。

### Task 2: Token 与页面迁移

**Files:** 修改 `design/workbench-v2-preview/index.html`。

**Interfaces:** 产生 `style#budde-tokens`、`style#budde-components`、`style#budde-layout`；`.button`、`.primary`、`.ghost`、`.icon-button` 定义组件变体；保留现有语义选择器和预览行为。

- [x] 按 Spec 建立基础→语义→组件三层；字号/行高成对、字重/边界/圆角/空间/状态/动效/布局均从 token 消费。
- [x] 给所有常规操作迁移 `.button` 共用基类，移除区域内尺寸/字号/padding 覆盖；主题按钮不再缩小。
- [x] 把界面 SVG 统一为 16px；品牌仍 24px；卡片至少 80px、笔记入口至少 56px，保留文本增长。
- [x] 实现 default/hover/pressed/focus/disabled/loading 规则，并保持 reduced-motion、静态提示、关闭恢复焦点等行为。
- [x] 执行任务 1 的浏览器验收，确认新规范与旧语义测试同时通过。

### Task 3: 同源样张、复核与交付

**Files:** 修改 `design/workbench-v2-preview/render.mjs`、`design/workbench-v2-preview/README.md`；生成 `artifacts/design/workbench-v2-system/` 离线交付。

**Interfaces:** 输出完整工作台 HTML、设计系统样张 HTML、抽取的 token/组件 CSS、8 张主题尺寸截图、`results.json`。

- [x] 从三个样式块生成离线页面和样张，展示按钮变体/状态、搜索/类型入口、图标、排版、空间、色阶与内容型入口。
- [x] 验证样张使用抽取的相同 CSS，并测量 disabled/loading/hover/pressed/focus；解析 `rgb()` 与 `color(srgb ...)` 以避免假对比度。
- [x] 运行 `node design/workbench-v2-preview/render.mjs` 与仓库 `pnpm check`，确认退出码 0；核对生产/原型范围 diff 不变。
- [x] 目视检查浅深 1440 及窄 480 截图；请求一名只读复核，主代理处理有证据的问题并重新运行验收。
- [x] 同步规范与 README 的最终实际值；交付工作台、组件样张及规范，明确仍未接业务。

## 执行确认

已采用 Native：用户确认 36px 与静态范围后，同一主代理实施，最后一名代理只读复核。复核的一个状态/对比度验收缺口及两个样张小问题已修正；最终 8 个工作台配置 + 4 个组件样张配置通过，36 组真实变体状态文字对比度最低 5.27:1。仓库检查退出码 0（18 项测试及构建通过）；现有 node_modules 联接触发 pnpm 安装前预检警告，未改依赖或配置。生产/核心/V1 范围 diff 为空；无提交、合并、推送。执行证据详见[执行记录](../../../artifacts/design/workbench-v2-system/progress.md)与[浏览器结果](../../../artifacts/design/workbench-v2-system/results.json)。
