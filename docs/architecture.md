# Budde 架构说明（v0.2.0）

## 分层结构

```text
src/
├── brand.ts                  # 工作台与思源顶栏共享的原创小芽 SVG 矢量
├── index.ts                  # 思源 Plugin 生命周期入口（页签、顶栏、快捷键、块/文档菜单、快速捕获 Dialog）
├── core/
│   ├── types.ts              # 领域模型（schemaVersion: 2）、Command 联合类型与平台契约接口
│   ├── type-config.ts        # 离线精选 Lucide 图标集、语义色板、复查周期预设与阶段模板
│   └── service.ts            # 纯函数状态校验、v1->v2 自动迁移与 BuddeService 事务命令引擎
├── platform/
│   ├── node-file-store.ts    # 基于锁文件 + 转移门闩 + 临时文件原子重命名的本地 JSON 存储（含 mtime 变更检测）
│   └── siyuan-notes.ts       # 思源本地 SQL 搜索、块/引用解析、笔记本枚举与一键创建 Markdown 文档
└── ui/
    ├── index.ts              # mountWorkbench / mountQuickCapture 单一 React Root 挂载与销毁出口
    ├── context.tsx           # BuddeProvider 全局工作台状态、命令派发、轮询同步与实例级 HUD
    ├── model.ts              # 纯函数视图选择器（Pool / Active / Board / Archive）、排序与复查判定
    ├── workbench-app.tsx     # 顶栏导航、池子、推进、归档与主工作区响应式骨架
    ├── board-view.tsx        # 多列看板、同列排序与跨列流转（@dnd-kit）、Ghost Column 新增阶段
    ├── detail-panel.tsx      # 自适应并排/抽屉详情、直接编辑与冲突保护、阶段时间轴、思源笔记搜索与创建
    ├── settings-modal.tsx    # 类型/阶段可视化配置、安全迁移删除与 JSON 导入导出弹层
    ├── quick-capture.tsx     # 全局快捷键触发的轻量快速捕获组件
    ├── lib/owned-sensors.ts  # 严格绑定实例生命周期的 @dnd-kit 指针/键盘传感器封装
    └── components/           # 本地所有权的 CVA / Radix 基础组件与静态图标映射
```

## 关键设计决策

1. **单一状态枚举替代布尔组合**：以 `status: "pool" | "active" | "paused" | "archived"` 取代早期的 `promoted + paused + archived` 三个布尔值，彻底消除非法组合；读取 `schemaVersion: 1` 旧快照时自动在内存中无损映射为 `v2`。
2. **显式持久化排序序号（`order`）**：新建事项自动排在顶部，看板列内拖拽取前后卡片序号中点，并在间距过密时自动重整步长，使手动优先级真正持久化。
3. **低开销跨窗口同步**：`NodeFileStore.hasChangedSince(mtimeMs)` 通过 `fs.stat` 检查文件修改时间，仅在外部窗口或快捷捕获实际改写 `state.json` 时才读取与解析 JSON，避免高频无效磁盘 I/O 与界面闪烁。
4. **严格的宿主与多实例边界**：所有弹层、下拉菜单、拖拽传感器、快捷键和 `inert` 属性均封闭在当前 `.budde` 实例内部，确保思源多页签分屏并存或页签销毁时不留任何全局监听与样式污染。
