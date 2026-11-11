# 工作台设计验证清单

状态：已按用户确认的「聚焦一个类型」设计制作独立可点击原型。2026-11-11 本地浏览器与仓库检查通过；独立只读整体复核完成，无阻塞项，三项细节已修正并通过回归。正式插件界面未修改、未安装、未合并或推送。

## 当前证据及其边界

- [单文件原型](../../artifacts/design/workbench/budde-workbench.html) 可直接用桌面 Edge 打开，无需服务器；构建和体验方法见 [原型说明](../../design/workbench/README.md)。
- [浏览器结果](../../artifacts/design/workbench/results.json)：`shell`、`detail`、`settings`、`visual` 四组通过，每组页面错误及 HTTP(S) 请求均为空。
- 原型严格类型检查通过；[模型单测](../../design/workbench/model.test.ts) 与 [草稿单测](../../design/workbench/draft.test.ts) 合计 **12/12**；仓库 `pnpm check` 的类型、**18/18** 原有测试、构建通过。
- [静态设计检测结果](../../artifacts/design/workbench/design-scan.json) 为空列表。最终扫描使用已构建入口及源样式，样式引用可解析；第一次源模板扫描曾提示生成样式不在源目录，因此没有把该不完整扫描当最终证据。
- 已人工查看真实生成截图：宽屏池/看板/详情、深色、720px 看板、480px 全宽详情、设置迁移、嵌入窄容器设置、失败及冲突。截图仅证明独立原型，不证明真实思源宿主验收。
- 所有变更通过真实核心命令和内存存储；未接真实思源 API、未持久化、未访问私有数据。时间固定为 `2026-11-11T00:00:00.000Z`，刷新重置合成数据。

## 验收矩阵

以下「通过」均限独立原型。完整结果见上述四组报告；链接直接指向相应可重跑检查。

| 编号 | 场景与已观察结果 | 状态 / 证据 |
| --- | --- | --- |
| C01 | 连续记录标题，成功后清空并恢复焦点；各只出现一次，不强制开详情 | 通过：[shell](../../design/workbench/verify.mjs#L24) |
| C02 | 合成 IME Enter 确认阻止默认动作；compositionstart 期间实际 submit 不提交，compositionend 后可提交；空白、501 字保留输入，500 字可保存 | 原型通过：[shell](../../design/workbench/verify.mjs#L24)；**真实 OS IME 未验证** |
| C03 | 保存失败保留输入；响应丢失后使用同一请求重试不重复创建，不假报成功 | 通过：[模型单测](../../design/workbench/model.test.ts)、[detail](../../design/workbench/verify.mjs#L105) |
| C04 | 看板页仅记录标题仍未推进，成功提示可回想法池 | 通过：[shell](../../design/workbench/verify.mjs#L24) |
| C05 | 创建类型独立于筛选；通用类型被移除后遵循核心回退 | 通过：[shell](../../design/workbench/verify.mjs#L24)、[模型单测](../../design/workbench/model.test.ts) |
| C06 | 初始阶段开始推进，stageId 保持；可进入看板及推进列表 | 通过：[shell](../../design/workbench/verify.mjs#L24)、[模型单测](../../design/workbench/model.test.ts) |
| C07 | 池、看板、推进、归档集合从同一状态派生；初始阶段、暂停、完成语义不混用 | 通过：[模型单测](../../design/workbench/model.test.ts) |
| C08 | 搜索无结果、空池、空推进清单有不同文案与恢复入口 | 通过：[shell](../../design/workbench/verify.mjs#L24)、[visual](../../design/workbench/verify.mjs#L402) |
| C09 | 实际 pointer 拖动与键盘阶段菜单均改变同类型阶段，不要求只能拖动 | 通过：[detail](../../design/workbench/verify.mjs#L105) |
| C10 | 改类型后必须显式选择目标阶段；未选不能保存 | 通过：[detail](../../design/workbench/verify.mjs#L105) |
| C11 | 切事项、关闭、切视图、暂停/归档前保护草稿；失败保存阻止后续导航 | 通过：[草稿单测](../../design/workbench/draft.test.ts)、[detail](../../design/workbench/verify.mjs#L105) |
| C12 | 外部更新不替换本地输入；原 expectedVersion 保存失败，不覆盖已提交内容 | 通过：[草稿单测](../../design/workbench/draft.test.ts)、[detail](../../design/workbench/verify.mjs#L105)、[冲突截图](../../artifacts/design/workbench/detail-conflict.png) |
| C13 | 放弃并读取前再次确认；继续编辑保留原稿，明确确认才读最新版本 | 通过：[detail](../../design/workbench/verify.mjs#L105) |
| C14 | 暂停、恢复、归档、找回保持原阶段；找回不隐式恢复暂停状态 | 通过：[detail](../../design/workbench/verify.mjs#L105)、[模型单测](../../design/workbench/model.test.ts) |
| C15 | 添加/移除关联是草稿，显式保存后生效；无效目标有反馈、不删正文 | 合成目标通过：[detail](../../design/workbench/verify.mjs#L105)；**真实思源笔记打开未验证** |
| C16 | 类型/阶段增改删、重排、初始/完成独立；同名不同 ID；阶段迁移含归档并更新版本；引用类型不可删；配置冲突保留表单 | 通过：[settings](../../design/workbench/verify.mjs#L259)、[迁移截图](../../artifacts/design/workbench/settings-migration.png) |
| C17 | 实际下载 JSON 与当前状态一致，明确不含笔记正文；无导入、AI、主动新建文档或永久删除入口 | 通过：[settings](../../design/workbench/verify.mjs#L259) |
| C18 | 1440×1000、1024×768 两主题无外层横溢；详情/主区独立滚动；120字类型名在1440/1024/480px开关详情时不挤出搜索，非覆盖状态可操作搜索 | 通过：[visual](../../design/workbench/verify.mjs#L402)、[宽屏详情](../../artifacts/design/workbench/light-1440-detail.png) |
| C19 | 720×900 覆盖详情、480×800 全宽详情；保持选中与列表滚动；看板内部横滚；脏稿缩窄再放大不丢失；带偏移的480px容器内确认/设置弹窗边界正确 | 通过：[visual](../../design/workbench/verify.mjs#L402)、[480px详情](../../artifacts/design/workbench/light-480-detail.png)、[嵌入设置](../../artifacts/design/workbench/embedded-480-settings.png) |
| C20 | 四尺寸×两主题；替换宿主语义颜色与字体后 computed style 跟随；正文、次信息、主按钮前景/背景对比度均≥4.5:1 | 浏览器替代宿主通过：[visual](../../design/workbench/verify.mjs#L402)、[深色详情](../../artifacts/design/workbench/dark-1440-detail.png)；**真实宿主主题未验证** |
| C21 | 可见焦点，Tab/Shift+Tab 详情循环；Escape 保护脏稿；设置切类型、保存、重读、键盘连续重排及边界均恢复焦点，关闭回实际看板/顶部入口；原生模态有取消入口 | 通过：[detail](../../design/workbench/verify.mjs#L105)、[settings](../../design/workbench/verify.mjs#L259)、[visual](../../design/workbench/verify.mjs#L402)；**屏幕阅读器未验证** |
| C22 | 精确14天边界；浏览不更新复查，未推进不催复查；已复查按钮实际更新；阶段/下一步规则沿用核心命令 | 通过：[模型单测](../../design/workbench/model.test.ts)、[detail](../../design/workbench/verify.mjs#L105)、[核心测试](../../tests/core.test.ts) |

## 固定样例与语义约束

初始共15条，其中14条未归档、12条已推进的看板事项、6条正在推进、1条归档。所有集合从 [同一合成状态](../../design/workbench/fixture.ts) 计算，不分别手写数据。

| 类型 | 看板事项 | 暂停 | 完成 | 正在推进 |
| --- | ---: | ---: | ---: | ---: |
| 通用 | 2 | 1 | 0 | 1 |
| 文章 | 3 | 1 | 1 | 1 |
| 软件 | 5 | 1 | 1 | 3 |
| 旅行 | 2 | 1 | 0 | 1 |
| 合计 | 12 | 4 | 2 | 6 |

软件类型的两个初始阶段事项，一个暂停，一个正在推进，均保留在初始列。**初始阶段不等于未推进，完成与列位置无关**；空下一步仍可属于正在推进。暂停/归档/恢复不偷偷改阶段。核心约束见 [类型定义](../../src/core/types.ts) 和 [命令服务](../../src/core/service.ts)：

- 记录用稳定 `requestId`；修改用草稿载入的 `expectedVersion`；配置用载入的 `expectedRevision`。任何核心变更都可能推进配置 revision，不能仅观察配置字段变化。
- 保存失败保留输入及原载入版本，不静默保存、丢弃或合并。重新读取须明确放弃。
- 非空阶段删除先选同类型迁移目标，包括归档引用；被事项引用的类型不能删除。

## 未验证与不在范围内

- 真实思源3.4.1的主题注入、窗口/分屏、内核访问和笔记导航：未测试，不把浏览器替代宿主的通过当作已通过。
- 真正操作系统中文输入法、屏幕阅读器、不同桌面系统：未实测。合成 composition 与键盘事件仅覆盖原型事件路径。
- 原生 `dialog` 内容会限制在原型容器内，但遮罩与 inert 范围仍为整个文档；真实插件需采用宿主认可的模态方案再验收。
- 480px指桌面窄分屏，不承诺移动端。真实多窗口并发、跨设备并发均未验收；后者不在alpha.1支持范围。
- 没有账号、云同步重设计、AI、导入或新建文档；数据跟随思源的正式方案不变。本原型仅使用内存，无持久化。

## 独立复核与最终修正

独立只读复核覆盖原型的完整差异、说明与验收证据，无 Critical / Important 阻塞项。以下三项 Minor 反馈均已处理：

1. 设置重绘后按控件语义身份恢复焦点，连续键盘重排到边界时转到同行可用操作；关闭后回到实际入口，而非总回顶部菜单。
2. 允许的120字连续类型名称可换行，搜索保留可用宽度；回归检查实际边界与可操作性，不只检查页面 scrollWidth。已查看 [长类型名与详情截图](../../artifacts/design/workbench/long-type-1440-detail.png)。
3. IME 合成测试直接断言默认动作被阻止，并验证组词期间 submit 被抑制、组词结束后提交成功；不以此替代真实操作系统输入法验收。

焦点及长名称用例在修正前均观察到预期失败。全量回归中另发现原生 dialog 的 close 事件异步导致旧断言偶发抢先读取；浏览器用例改为等待确认窗移除且保存忙碌结束，再检查结果，不使用固定延时、不放宽业务断言。最终四组浏览器检查、原型类型/12项单测、仓库类型/18项测试/构建均通过。

## 历史与下一步

前期三种布局草图仅验证了宽屏空间组织，并经只读复核修正了“初始阶段=未推进”的错误推导；它们不再作为当前交互验收依据。当前授权和约束见 [设计说明](../superpowers/specs/2026-11-11-workbench-design.md) 与 [执行计划](../superpowers/plans/2026-11-11-workbench-prototype.md)。

交付独立原型供用户体验；生产 UI 改造仍需另行授权，不自动安装、合并或推送。
