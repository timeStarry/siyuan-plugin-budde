# Budde 0.1.0-alpha.1 验证记录

日期：2026-11-11。目标宿主为思源 3.4.1+ 桌面端；自动化环境为 Windows、本机 Edge。测试仅使用合成数据和临时目录，不读写真实思源工作空间。

## 当前验证：原小芽 + Quicksand 600 品牌接入（2026-11-11）

用户已批准右侧 Quicksand 600 方案、“接入并更新 ZIP”和直接执行计划。品牌接入阶段只改品牌、不重新设计工作台，最初不含真实安装；随后用户明确要求“实装覆盖”，执行结果见本节下方。

- 共享矢量：[品牌常量](../src/brand.ts) 同时供工作台与 SiYuan 入口使用，保留圆头双叶和直立茎；构建后的合成宿主实际注册 symbol 路径与工作台 SVG 相同。普通功能图标仍为 Lucide 16px/1.75，品牌为 24px/1.75。
- 仅英文 Budde 使用 18px、600 的私有字体别名 `BuddeBrandQuicksand`；正文、中文、按钮、卡片字体与既有 Zinc 布局不变。原始 [TTF](../src/ui/assets/Quicksand-variable.ttf) 124,824 bytes，以 CSS data URI 离线内嵌，无新增运行时包或字体网络请求；[源 OFL](../src/ui/assets/Quicksand-OFL.txt) 和随包 [README](../README.md) 均保留完整版权/许可。
- TDD：两项新断言先在旧实现上因通用 Lucide Sprout、缺少离线字体而失败，再接入品牌；最终 `pnpm check` 类型检查、**31/31** 测试和正式构建通过。
- 串行 `pnpm test:ui` 通过 **133** 组：主交互 9、生命周期 12、几何矩阵 70、parity 11、设计系统 10、高级宿主隔离 14、品牌 7。首次发现旧 parity/design-system 断言仍强制品牌为 Lucide；依据已批准的局部品牌例外，只调整品牌 class 预期，普通图标及尺寸/描边/aria 断言完整保留。
- [品牌浏览器报告](../artifacts/qa/brand-quicksand/report.json) 验证实际 FontFace 加载成功、600/18px、无合成粗体、普通文本未受影响；1440×900 和 1280×800 的明暗四组合均无页头挤压或外层溢出，零外部请求与浏览器异常。最终截图已逐张人工检查。机械 detector 对最终工作台源文件返回空 findings；这是静态源检查，不代替浏览器或原生宿主验收。
- `pnpm test:plugin` 在 UI 回归后和最终打包后均通过：真实构建 CJS 的合成 SiYuan loader、入口注册、tab.init、工作台记录/阅读、销毁/重挂载与 unload；没有接触真实工作空间。
- 一次新鲜、只读、未运行测试或修改文件的品牌范围复核未发现 Critical / Important / actionable Minor。复核未裁定既有整轮 React 改造、尚未替换的旧 ZIP、真实宿主/OS 行为、绝对商标/法律许可或独立重跑字体 hash：既有行为由本轮完整回归覆盖；最终包和字体由下方发布校验覆盖；原生行为仍待用户验收，未作零法律风险承诺。

| 尺寸 | 浅色 | 深色 |
| --- | --- | --- |
| 1440×900 | [最终工作台](../artifacts/qa/brand-quicksand/1440x900-light.png) | [最终工作台](../artifacts/qa/brand-quicksand/1440x900-dark.png) |
| 1280×800 | [最终工作台](../artifacts/qa/brand-quicksand/1280x800-light.png) | [最终工作台](../artifacts/qa/brand-quicksand/1280x800-dark.png) |

另见实际渲染的 2× [浅色品牌截图](../artifacts/qa/brand-quicksand/brand-light@2x.png) / [深色品牌截图](../artifacts/qa/brand-quicksand/brand-dark@2x.png)；不是仅字体选型的对比页。

### 当前品牌发布包

- 旧 ZIP 与校验文件已先备份到 [品牌接入前备份](../artifacts/release-backups/budde-before-quicksand-20261111-202036/siyuan-plugin-budde-0.1.0-alpha.1.zip)，两份文件的备份散列均与原件相同，见 [备份记录](../artifacts/release-backups/budde-before-quicksand-20261111-202036/verification.json)。旧 ZIP 332,760 bytes，SHA-256 `31d57823dbaad868ceb09bdf7744fc642cec5a2cca9e044fd2d260f9748e1d49`。
- 当前 [发布 ZIP](../artifacts/release/siyuan-plugin-budde-0.1.0-alpha.1.zip) 已覆盖同一路径，版本仍为 `0.1.0-alpha.1`；**417,190 bytes**，SHA-256 **`636cba93df58ffd0a7c0bbd13206bf1afe1ab1ef7d1722ed222fafd46be40dce`**，附 [SHA-256 文件](../artifacts/release/siyuan-plugin-budde-0.1.0-alpha.1.zip.sha256)。
- 最终串行 `pnpm check` → `pnpm package:plugin` → `pnpm test:plugin` → `pnpm test:release` 整条命令 exit 0。六文件白名单与构建逐字节一致、重打包可复现；临时合成工作空间两次覆盖安装后，事项存储与启用配置逐字节不变。
- PowerShell 标准 `Expand-Archive` 独立解压后，六份文件 SHA-256 均与构建一致，见 [标准解压记录](../artifacts/qa/brand-quicksand/release-standard-extract.json)。
- 发布校验直接解码最终 CSS 字体，SHA-256 仍为 `39c9b64223561f56aaff6062a6f04063c4fc86809ad6768722c06614d977e1cc`，并断言最终 README 包含完整源许可；新增断言不取代原发布包/合成安装检查。
- **首次 ZIP 交付边界（下述实装之前）：只更新本地 ZIP，未安装、重启思源或修改真实数据/配置；当前 worktree 和既有改动全部保留，未提交、合并或推送。** 真实思源窗口、macOS/Linux 和原生辅助技术行为仍未验收。

### 用户随后授权实装覆盖（2026-11-11）

- 用户明确要求“实装覆盖”，授权将上述已验证 ZIP 覆盖到真实已安装 Budde。重新校验 ZIP SHA-256 未变；核对真实目标清单与目录，不经过重解析链接，不安装到其它工作空间。
- 先把真实已安装的六份程序文件备份到 [旧程序目录](../artifacts/install-backups/budde-quicksand-20261111-203403/previous/)，每份备份散列均与覆盖前原件一致，见 [备份核验](../artifacts/install-backups/budde-quicksand-20261111-203403/backup-verified.json)。只备份程序，不复制真实事项内容。
- 从已校验 ZIP 新解压的隔离目录复制六份发布文件；安装后逐份 SHA-256 均与发布包一致，且旧程序备份再次校验通过，见 [实装核验记录](../artifacts/install-backups/budde-quicksand-20261111-203403/verification.json)。未改源码、版本或发布包，未删除额外文件。
- 真实事项存储只记录存在性、大小和 SHA-256，覆盖前后完全一致；两处受保护的启用配置候选文件原本不存在，覆盖后仍不存在。没有创建配置、修改事项或切换启用状态。
- **已覆盖程序文件，但没有重启思源，也没有声称真实窗口验收通过。用户保存正在编辑的内容后，需重启思源加载新版。** 保留当前 worktree，不提交、合并或推送。

## 前序基线：React / Tailwind / Zinc 工作台（2026-11-11）

本节记录品牌接入前的 React 改造，旧 ZIP 大小与散列已由上节品牌包取代，保留为历史证据。下方原有“核心与持久化”至“本次修正版收尾与覆盖安装”同样为较早版本记录，其中旧依赖联接、原稿几何、27 项测试及实际覆盖安装**不代表本次品牌包已安装**。

- 规则：[ui-design-system.md](../ui-design-system.md) 已持久化，并由 [AGENTS.md](../AGENTS.md) 引用；[实施计划](superpowers/plans/2026-11-11-zinc-react-workbench.md) 已完成四阶段状态和执行记录。
- 技术栈：工作树使用独立依赖，主仓依赖保持不变；仅授权 `esbuild@0.25.12` / `esbuild@0.28.2` 安装脚本。React TSX + Tailwind 3.4（`bd-` 前缀、`.budde` 作用域、无全局 preflight）+ owned-source shadcn/ui 组件/Radix + Lucide + Framer Motion + dnd-kit。正式 UI 和预览使用同一生产视图/样式；无 CDN、账号或云端运行依赖。
- 最终串行命令：`pnpm check` → `pnpm test:ui` → `pnpm test:plugin` → `git diff --check`，完整命令 **exit 0**。
- `pnpm check`：TypeScript、**29/29** 单元/草稿/笔记桥/进程存储/栈测试，以及正式插件构建通过。
- `pnpm test:ui`：主交互 **9**、生命周期 **12**、几何矩阵 **70**、当前设计规范 parity **11**、设计系统 **10**、高级宿主隔离 **14** 组均通过。保留幂等请求、版本冲突、草稿输入/IME、异步销毁、设置迁移、笔记、导出等原行为断言。
- `pnpm test:plugin`：实际构建 CJS 的模拟 SiYuan loader、Node 内置模块、注册/unload、tab.init、正式 UI 记录/阅读、销毁/重挂载通过。仅合成宿主，不等于真实思源窗口验收。
- 设计：精确浅色 tokens、36px 控件、Lucide 16px/品牌24px、240px 最小列宽、卡片 p14/gap10、420px 详情/p24、标题/计数分离均由浏览器检测；根容器不滚动，看板和详情各自滚动。`prefers-reduced-motion` 使用独立浏览器页验证实际抽屉在两个 rAF 内完成位移，而非仅检查 CSS 标志。
- 只读复核后的 RED → GREEN：键盘拖动后聚焦另一实例仍保留拖影；靠近可滚动宿主边缘时宿主偏移变成 `left=500, top=600`；空列下半部无法接收卡片。分别以焦点所有权取消/禁用全局焦点恢复、仅 collection 可滚动及本地横向 reveal、列 stretch 修复。回归还验证同实例其他输入、放下后键盘焦点、偏移容器拖影、长阶段菜单、pointer/keyboard 拖动时替换/销毁的监听器释放；没有全局合成 Escape 或宿主滚动锁。
- 人工逐张检查以下最终生产截图：两种目标尺寸的列标题/计数、卡片截断、长英文、抽屉留白与深色均未见挤压或外层溢出；打开抽屉后列超出视口的部分由看板内部横向滚动承载。

| 尺寸 | 看板 | 详情 |
| --- | --- | --- |
| 1440×900 | [截图](../artifacts/qa/zinc-react/1440x900-board.png) | [截图](../artifacts/qa/zinc-react/1440x900-detail.png) |
| 1280×800 | [截图](../artifacts/qa/zinc-react/1280x800-board.png) | [截图](../artifacts/qa/zinc-react/1280x800-detail.png) |

另见 [1280×800 深色截图](../artifacts/qa/zinc-react/1280x800-dark.png)、[设计系统报告](../artifacts/qa/zinc-react/report.json)、[高级宿主报告](../artifacts/qa/react-host/report.json)。这些证据仅含合成数据。

**当前交付边界：** 生产构建和发布 ZIP 已更新（见下方用户授权后的覆盖记录），没有实际安装或重启思源，没有提交/合并/推送。真实思源及 macOS/Linux 原生验收待进行。dnd-kit 的私有 sensor disposal 接缝已集中封装；升级版本必须重跑上述边界回归。

### 发布包覆盖授权与校验（2026-11-11 19:42 后）

- 用户明确同意“可以覆盖旧包”。按覆盖本地发布 ZIP 处理，未扩展为实际思源安装/重启授权；版本仍为 `0.1.0-alpha.1`。
- 覆盖前将旧 [ZIP](../artifacts/release-backups/budde-before-zinc-20261111-194341/siyuan-plugin-budde-0.1.0-alpha.1.zip) 和 [校验文件](../artifacts/release-backups/budde-before-zinc-20261111-194341/siyuan-plugin-budde-0.1.0-alpha.1.zip.sha256) 备份，并逐一校验备份与原文件 SHA-256 一致。旧包 32,975 bytes，SHA-256：`820ce630ac4d294330c3f8c1ccdd52425ed4a0a41a7c9259e5b45d7844adb8ec`。
- 新 [发布 ZIP](../artifacts/release/siyuan-plugin-budde-0.1.0-alpha.1.zip) 已覆盖同一路径；**332,760 bytes**，SHA-256：`31d57823dbaad868ceb09bdf7744fc642cec5a2cca9e044fd2d260f9748e1d49`，附 [校验文件](../artifacts/release/siyuan-plugin-budde-0.1.0-alpha.1.zip.sha256)。包含当前 React/Zinc 生产 UI 及其本地运行依赖，不包含测试夹具/预览数据。
- 此次重新串行执行 `pnpm check` → `pnpm package:plugin` → `pnpm test:plugin` → `pnpm test:release`，完整命令 **exit 0**。类型检查、29/29 测试、构建、CJS 合成宿主 UI、发布校验均通过；未修改 UI 源码，双尺寸视觉验收沿用上节同一生产 UI 的证据。
- 发布测试确认 ZIP 的 6 项运行文件与当前构建逐字节一致、校验和正确、重打包可复现；在系统临时目录的合成工作空间连续覆盖安装两次后，合成 storage/state 和插件启用配置逐字节未变。该测试不接触用户真实思源工作空间，也不等于实际安装验收。

## 核心与持久化（历史基线）

- `pnpm check`：TypeScript、27 项业务/存储/草稿/笔记桥测试和正式插件构建通过。
- 覆盖标题唯一必填、幂等请求跨服务重启、同标题允许不同事项、创建响应丢失重试、事项/配置乐观版本冲突、原类型删除后的创建重试、跨类型/阶段迁移（含归档事项）、完整 JSON 导出与核心恢复。
- 文件存储覆盖独立实例事务、两进程 48 次提交、5 轮各 32 实例的锁交接压力、回调/重命名失败、损坏或未知格式不覆盖、失效主锁恢复、不确定 transfer gate 保守停止。
- 笔记桥验证当前会话的本地 SQL、目标存在性、输入白名单；延迟查找期间收到视图 AbortSignal 后，不再调用宿主打开页签。
- 本 linked worktree 的 node_modules 指向主仓，pnpm 的脚本前依赖校验会报告 `ERR_PNPM_UNSAFE_MODULES_DIR` 并拒绝自动重装；随后 typecheck/test/build 实际执行成功，完整命令退出码为 0。没有删除或重配依赖目录，未修改依赖或锁文件。

## 正式工作台浏览器检查

`pnpm test:ui` 使用真实 `mountWorkbench`、真实 `BuddeService`、内存存储和合成笔记桥，不导入设计原型。

- 主交互 9 组：标题记录、默认阅读/显式编辑、保存失败与冲突保留输入、离开草稿保护、笔记资料/成果关联、原子保存并推进、暂停/归档恢复、响应丢失去重、IME/XSS、搜索筛选、跨类型显式阶段、键盘/拖放、生命周期 CRUD/冲突/包含归档的迁移、重复保存忙碌态、完整 JSON 下载。
- 生命周期 12 组：读取最新版本期间锁定原草稿；乱序快照/旧保存响应不回退；配置单独变化的阅读刷新（含只读动作失败期间的延迟失效）；容器缩小时只移动本实例焦点；确认框期间缩放后重算 inert；两个实例 ID/弹层/主题/宿主隔离；设置打开 single-flight；设置读取期间卸载；读取、保存、笔记验证和确认期间卸载不复活 DOM、不泄漏 inert、不在迟到回调中抢焦点。
- 浅色/深色 × 1440、1024、720、480、320px **插件容器**宽度，共 10 张详情截图；浏览器窗口保持宽屏以证明响应于容器。普通控件 36px、图标 16px/品牌24px、描边1.75、无外层横向溢出；阶段路径允许内部滚动。
- 几何矩阵另覆盖 70 组：两种主题 × 五个容器宽度 × 想法池/看板/正在推进/归档/设置编辑/确认/详情编辑。普通控件均为 36px，根容器与对话框无外部溢出。720px 设置弹层的 implicit grid 轨道原会撑到 880px，已用显式 minmax(0,1fr) 轨道修复并回归；补看了 320px 主屏与设置编辑截图。
- 阅读详情在容器 <1200px 为本地覆盖层，<720px 全宽；不使用 native `showModal()` 锁住整个思源文档。减少动态效果遵循 `prefers-reduced-motion`。
- Impeccable 对生产 UI/样式/token 检测返回空 findings。已人工查看明暗主题、宽屏详情和 320px 详情截图。

结果和截图位于忽略提交的 `artifacts/qa/`。没有用户真实事项、私有笔记或凭证进入夹具和安装包。

## 构建、宿主模拟与安装包

- `pnpm test:plugin`：Node 中模拟思源 CommonJS loader 与内置模块，验证页签/命令/顶栏注册；浏览器加载 **dist 中的 CJS**，在合成宿主中实际调用 tab.init，验证正式 UI 的记录、阅读、命令/顶栏入口、tab.destroy、重挂载与 unload。浏览器场景将服务替换为合成内存服务，真实文件存储另由上述进程测试覆盖。
- `pnpm package:plugin`：构建并生成 `artifacts/release/siyuan-plugin-budde-0.1.0-alpha.1.zip` 及 SHA-256。ZIP 根目录仅有 `index.js`、`index.css`、`plugin.json`、`README.md`、两份 i18n 文件；无示例数据、设计稿、node_modules 或工作空间数据。
- `pnpm test:release`：验证包内容与 dist 字节相同、重复生成字节相同、散列正确；临时工作空间连续安装两次，原 storage 与插件启用配置保持字节不变。没有在真实工作空间运行安装脚本。
- 使用 PowerShell 标准 `Expand-Archive` 独立解压，六个文件的 SHA-256 均与 dist 一致，不只依赖自写 ZIP 检查器。

## 只读审查与修复

独立审查不修改文件或运行有写入副作用的命令。发现并加入回归：实例 ID 处理不得改写 data-id；延迟 reload 不得丢弃新草稿；设置打开 single-flight/卸载守卫；旧保存响应不能覆盖更高 revision；配置单独变化与忙碌期间配置失效不能遗失；笔记打开在卸载后停止宿主续作；覆盖层缩放焦点与弹层关闭后的 inert 所有权。均先重现，再针对根因修复。

## 图标与原稿一致性修正（2026-11-11）

- 用户真实宿主截图暴露的图标缺失属于实现遗漏，不是资源加载失败。此前的控件几何和功能检查不能代替视觉一致性验收；本次补上专门回归。
- 新增 `scripts/verify-parity.mjs`，在隔离的真实服务上使用合成示例；初始 RED 为 11 组中 7 组失败：导航/类型/状态/操作 SVG 缺失、69px 而非 64px 的页头、记录条嵌套描边、盒状阶段列。修正后检查 SVG 是否实际可见、路径与原稿相同、16/24px 与 1.75 描边、ghost 边框、144px 索引与 192px 对齐、56px 记录面、贴边 420px 详情、顶栏编辑及下一步容器。
- 明暗主题均生成生产版/批准稿的同视图 1440×1000 截图，参考页只移除静态预览披露栏，未改参考源文件。使用禁用截图动画避免主题过渡中间帧。不是像素完全相同声明：功能文案、动态计数、排序和真实内容仍随数据变化；不补造原稿无实际功能的更多菜单。
- 人工检查还发现长自定义阶段名互相覆盖：新增 1024/720/480/320px 四组标签间距 RED，再以路径步长下限加内容最小宽度修正，保留内部横向滚动和键盘焦点，不缩小字号或控件。
- 一次有界只读复核未发现 Critical/Important 源码问题；其 Minor 为笔记行 hover/active 被通用按钮规则加回描边。等待实际 CSS 动画结束后复现了该失败，再增加局部透明边框规则。复核没有写文件或运行测试；未裁定的真实宿主样式、原生键盘/焦点、持久化与 OS 辅助技术行为均保留在下方未验证范围，不以浏览器替代。
- 当前截图与机器检查记录位于 `artifacts/qa/visual-parity/current/`；初始遗漏的 RED 证据位于 `artifacts/qa/visual-parity/before/`。没有复制用户截图或其中的私有内容进入仓库。

## 本次修正版收尾与覆盖安装

- 最终完整重跑 `pnpm check`、`pnpm test:ui`、`pnpm test:plugin`、`pnpm package:plugin`、`pnpm test:release` 和 `git diff --check`，整条命令退出码 0。27 项单元/进程测试、9 组主交互、12 组生命周期、70 组几何矩阵、11 组图标/视觉一致性检查均通过。最后一轮包含长阶段标签间距与动画结束后的笔记 hover/active 回归。
- 修正版 ZIP 为 32,975 字节，SHA-256 `820ce630ac4d294330c3f8c1ccdd52425ed4a0a41a7c9259e5b45d7844adb8ec`；标准 `Expand-Archive` 独立解压后六份文件与 dist 散列相同。
- 16:03 先将真实已安装的六份程序文件备份到 `artifacts/install-backups/budde-icons-20261111-160317/previous/` 并核对备份散列，再从已核对的解压目录覆盖原插件。六份安装后文件的散列均与正式包相同。没有删除额外文件、重启思源或更改启用状态。
- 真实事项存储覆盖前后 SHA-256 相同；受保护的 `data/plugins/conf.json` 路径覆盖前后均不存在，没有为它创建配置。只保存散列和文件元数据，不复制实际事项内容。完整记录为 `artifacts/install-backups/budde-icons-20261111-160317/verification.json`。
- 仍需用户先保存正在编辑的内容，再重启思源加载新版。安装完成及隔离宿主走测不等于真实窗口视觉验收。保留当前工作树，未提交、合并或推送。

## 尚未验证／尚未实现

- **尚未在用户真实思源窗口内启用走测。宿主模拟不等于原生窗口验收。** 首次启用应检查实际主题、快捷键冲突、关联笔记跳转、重启持久化和升级。
- 未验证 macOS、Linux 实机；不支持移动端、浏览器客户端或跨设备并发合并。思源文件同步不是分布式事务。
- 支持关联已有笔记，尚不主动创建笔记；无用户导入界面、永久删除或外部 AI 适配。
- 待复查采用 14 天默认规则，无单独关闭配置。
- 这是桌面 alpha.1 范围交付，不是全部正式需求完成声明。未自动提交、合并或推送代码。
