# Budde UI Design System — 持久化开发约束

> 适用于全部生产工作台、基础组件、设置与确认对话框、浏览器预览及后续新增界面。
> 当前规范包含用户批准的 0.1.0-alpha.2 综合升级，取代旧横向阶段路径、普通 1.75px 图标、统一 0.2s 和所有场景最多 shadow-xs 的约定；不改变业务语义与存储安全。
> 开发前先读本文件；违反硬性标准的变更必须取得用户明确批准。详见 [alpha.2 设计](docs/superpowers/specs/2026-11-11-alpha2-design.md) 与 [执行计划](docs/superpowers/plans/2026-11-11-alpha2.md)。

## 1. 技术栈与组件边界

- 使用 **React + TypeScript + Tailwind CSS + shadcn/ui（Zinc 中性灰阶）+ Lucide Icons**。
- 基础交互组件集中于 `src/ui/components/ui/`，遵循 shadcn/ui 的源码所有权、CVA 变体和可访问性模式；共享 `cn()`，禁止在业务页面复制按钮/输入框样式。
- 基础组件至少覆盖 Button、Input、Textarea、Select、Badge、Dialog/Sheet、DropdownMenu、Tooltip。焦点、禁用、错误、加载状态一并设计。
- 普通功能图标使用静态本地 Lucide，默认 16×16px、**1.5px**、fill=none、currentColor、圆端点/连接。图标按钮有可访问名称，装饰图标对辅助技术隐藏。
- 品牌为批准的例外：保留原小芽，工作台与思源入口共享 [品牌矢量](src/brand.ts)，24px / 1.75px，不用通用 Lucide Sprout 替代。Emoji 仅用于用户明确选择的类型展示，不伪装功能按钮图标。
- 禁止厚重后台组件库、CDN、运行时字体/图标请求和逐页杂乱手写 CSS。原生 CSS 限于 Tailwind 入口、语义 token、宿主隔离 reset、必要的可访问性/容器边界及共享反馈 keyframes。
- React、Lucide、Motion、dnd-kit 全部打包进插件；运行时离线、本地，不依赖开发服务器。
- 无全局 Tailwind preflight；样式和 portals 限定于实例，不修改宿主 body/html、其它插件的主题、inert、滚动或焦点。

## 2. 色彩与层次

| 语义 | 浅色值 | 用途 |
| --- | --- | --- |
| workspace | `#F9FAFB` | 主工作区 |
| muted surface | `#F3F4F6` | 侧栏、看板列，可用 70% 透明度 |
| surface | `#FFFFFF` | 卡片、详情、弹层 |
| border | `#E4E4E7` | 1px 分割线与边框 |
| foreground | Zinc 900 | 主文本和主按钮 |
| muted foreground | Zinc 500 | 辅助路径和元信息 |

- 浅色 workspace/muted 值以本表语义 token 为准，不偷偷替换为近似的 Tailwind 默认色。
- 主按钮使用语义 Zinc 主色/白字及 hover；深色采用可读反色主按钮，不黑底黑字。
- 工作区、列、卡片、详情层级明确；边框统一 1px。深色映射 Zinc token，卡片顶部有 `inset 0 1px 0 rgba(255,255,255,0.06)`。
- 静止表面最多轻量 shadow-xs；拖拽 overlay 允许有限的软偏移抬升阴影，不使用重阴影、彩色光晕、渐变、厚选中框或大块高饱和色。
- 菜单与成功 HUD 使用半透明表面和 12px backdrop blur，保持可读对比；不向宿主 portal。
- 状态以极小圆点、低饱和徽章及文字表达，不能仅靠颜色表示暂停、完成、待复查。
- 类型色仅限 default / blue / emerald / amber / violet / rose；无配置时中性，不按旧名称猜测图标/配色。继承思源明暗主题，不修改宿主主题。

## 3. 排版与数字

- 页面主标题 20px/28px、semibold；列/卡片标题 14px/20px、medium。
- 正文 14px/24px，控件 13px/20px，辅助路径/计数/元信息 12px/16px。
- 统计数字、事项计数、阶段位置及动态数字使用 `tabular-nums`。
- 正文、中文、按钮、卡片继承宿主/本地系统字体。仅英文 Budde 字标使用离线 Quicksand SemiBold 600、18px、正常字距；原始字体和 OFL 保留，CSS 内嵌，不请求网络。
- 私有品牌 family 只作用于 `.budde` 内字标。单个品牌 @font-face 是资源声明例外，不授权更换正文或逐页手写 CSS。
- 不以全局 letter-spacing、强制两端对齐、超小文字制造精致感。

## 4. 防折行与防溢出

- 看板列至少 240px，不为塞进视口而压缩；列标题 min-w-0、truncate，计数/菜单 shrink-0，右内边距稳定，完整名通过可访问名称读取。
- 列标题不得被计数挤成孤字折行、互相覆盖或贴右边。卡片标题保持可读宽度；描述和下一步摘要最多两行。
- 收缩文字 min-w-0，动作/图标 shrink-0，用 gap 分隔，不用绝对定位遮住文字；长 URL/英文必要时断词。
- **详情阶段路径为完整换行的垂直时间轴，无横向滚动、无截断**；长中文和连续英文不撑开面板，按钮命中区至少 36px，长名称可增高。
- 时间轴只表示顺序、当前位置与 Stage.completed，不表示执行历史、累计进度、完成百分比；可向前或向后点击。
- 空内容、长中文/英文、较大计数、加载、错误和禁用均需几何稳定。

## 5. 布局、滚动与响应式

- 预览壳 h-screen/flex-col/overflow-hidden；插件填满宿主分配容器 h-full/min-h-0，不越过宿主标签栏或工具栏。
- 主区域 flex-1/min-h-0/min-w-0。只有中间看板 viewport 横向滚动；列表/大量事项在内容 viewport 纵向滚动；详情正文独立纵向滚动。导航、快速记录、详情标题及操作栏保持可见。
- 列内不额外嵌套纵向滚动条，时间轴不横向滚动；不得制造整页双滚动条。
- 导航、快速输入、类型侧栏、多列看板、详情明确分区，不使用后台密集表格或套娃面板。
- 桌面详情约 400–420px，容器不足时使用实例内叠层抽屉，保持关闭、Escape、焦点圈定、返回触发点和草稿保护。
- modal/inert、菜单、焦点捕获只能作用本实例；其它实例和宿主不受影响。

## 6. 尺寸、密度与就近配置

- 保持 **36px** 控件和最小图标按钮命中区，不能通过缩小控件塞入窄屏。
- 间距主刻度 4/8/12/16/20/24/32/48；卡片 p-3.5（14px）、卡片间 gap-2.5（10px）、详情 p-6（24px）是明确批准的密度例外。
- 小圆角 6–8px；除选中导航反馈，不将表面普遍胶囊化。图标/文字通常间隔 8px。
- 全局菜单仅导出 JSON/重新读取。类型侧栏 + 新建，行内 hover/focus 编辑；列标题菜单重命名、完成属性、左右移动和迁移删除。
- 最右虚线 Ghost Column 输入名称，Enter 创建、Esc 取消；IME、提交锁、失败留文、revision 冲突不自动重放。
- 类型设置支持 36 个静态图标的中文关键词搜索、单 Emoji 字素、六色与预览；可原子选择 basic/article/software/travel/blank 新类型模板，不改旧类型阶段。

## 7. 拖拽、动效与输入

- 使用 dnd-kit core/sortable，稳定事项/阶段 ID、Pointer/Keyboard sensors、可访问反馈，不退回仅原生 drag/drop。
- 次要卡片操作和手柄仅 hover/focus-within 显示，**150ms ease-out**；键盘仍可操作，触摸显式显示。
- 拖动原位为安静的虚线占位，overlay 95% 不透明度、scale 1.02、有限抬升阴影；跨阶段继续使用 expectedVersion，不虚构持久化卡片排序。
- 顶部导航胶囊与当前阶段指示器 **180ms cubic-bezier(0.22,1,0.36,1)**，layoutId 按实例隔离，阶段还按事项隔离；指示器不截获点击。
- 详情轻滑入/退出，卡片布局过渡使用 Motion；脏保存轻呼吸，关闭保护单次弹性摇动，成功 HUD 短暂淡入。
- `prefers-reduced-motion` 禁用非必要位移、呼吸和摇动，操作与反馈仍可用。
- root 内 C 聚焦快速记录；忽略 editable、IME、修饰键、repeat、开放弹层、其它实例和宿主。快速输入旁显示 Enter 提示。
- Esc 经 requestClose 关闭干净详情，脏详情必须确认；isComposing/keyCode229 和 tracked composition 均不得触发关闭，guard 同样保护 IME。
- 暂停/恢复、复查、归档/恢复只在持久化成功后显示本实例底部居中、短暂、blur 的 HUD；失败/挂起不能提前成功，重复反馈重置 timer，destroy 清理。

## 8. 产品、数据与生命周期保护

- 记录不等于推进，浏览不等于复查。已有笔记引用、暂停/恢复、归档/恢复、类型/阶段管理与 JSON 导出保留。
- 草稿关闭/切换的保存、放弃、继续编辑保留；失败/冲突不得清空草稿或更新其原 expectedVersion。编辑期间保留类型配置快照，外部删除目标类型不使草稿崩溃；写入仍以最新持久化配置验证，显式重新读取/放弃才采用新配置。阶段点击复用 DraftSession apply，不另开绕过校验的 mutation。
- 保留幂等、版本、配置 revision、原子事务、锁、rollback、单调 refresh、多实例隔离和 destroy 后异步无副作用。
- React 重渲染不能重置输入、IME、selection、提交状态或当前焦点。
- schemaVersion 仍为 1，icon/color 可选；缺省仅渲染回退，不补写旧状态；update 缺省保留、null 清除。导出信封不变。配置更新不增加事项 version；阶段迁移删除覆盖归档事项并增加相关 version。
- 不移除数据、不连接真实个人事项，不新增账号、云服务、移动/浏览器或多设备并发承诺。

## 9. 验收与交付边界

- 采用先 RED 后 GREEN；核心覆盖元数据、模板、旧快照字节保持、导出和版本约束；浏览器覆盖就近配置、Ghost、垂直全名路径、键盘/IME、HUD、动效降级和宿主隔离。
- 串行运行 `pnpm typecheck`、`pnpm test`、`pnpm test:ui`、`pnpm test:plugin`、`pnpm check`。共享 preview artifacts 的浏览器套件不可并行。
- 生产组件检查 **1440×900 / 1280×800** 明暗和 **320px** 窄容器长内容；检查对齐、留白、层次、溢出、详情开闭、拖拽、菜单、hover/focus、错误和禁用。静态截图等待/关闭动画，交互动画另测。
- 只用合成数据，不将真实标题、私密笔记、凭证放进仓库或截图夹具；预览不是独立产品。
- 旧断言仅在批准契约改变时替换并记录理由，不能删除功能保护换取通过。新增组件/依赖沿用本地所有权、构建与隔离入口。
- 网络/TLS、凭证、沙箱或权限边界立即停止询问，不换镜像/代理绕过，不破坏主仓依赖联接。
- 浏览器/合成宿主不等于真实思源窗口、macOS/Linux 或原生辅助技术验收。无另行授权不安装、重启、改变启用状态、提交、合并或推送。
