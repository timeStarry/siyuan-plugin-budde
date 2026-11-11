# Budde 工作台交互原型

采用已确认的「聚焦一个类型」布局。**独立交互原型 · 示例数据，刷新重置**，不是已安装的思源插件，不替换正式界面。

## 打开

推荐直接双击生成的 [单文件原型](../../artifacts/design/workbench/budde-workbench.html)，用桌面 Edge / Chromium 浏览器打开。这个文件已内嵌所有脚本和样式，可单独复制，不需要服务器、联网或安装。

也可以打开 [本地资源入口](../../artifacts/design/workbench/index.html)，但需保留同目录的脚本和样式。生成目录被 Git 忽略；更换 checkout 后请重新构建。

```powershell
node design/workbench/build.mjs
```

使用仓库现有开发依赖，无新增依赖。不要为预览启动另一套开发服务器，也不要把原型安装成思源插件。

## 建议体验顺序

1. 在想法池连续记下两个标题：成功后输入清空并恢复焦点，不强制打开详情。
2. 切到看板，按类型查看阶段；看板页记录的新事项仍留在想法池，不自动推进。
3. 打开一张卡片，修改下一步并显式保存；试着带着未保存修改切视图、关闭详情或归档。
4. 拖动卡片改变阶段，或用卡片菜单 / 详情阶段选择器完成同样操作。
5. 在「更多 → 管理类型与阶段」新建类型、设置初始/完成阶段；删除有引用的阶段前查看迁移影响，包括归档事项。
6. 在「更多 → 导出 JSON」下载当前示例状态。导出不含思源笔记正文。
7. 缩窄窗口体验覆盖式 / 全宽详情；底部「演示工具」切换浅深主题、触发失败或模拟外部修改。

## 演示工具与数据边界

- 底部：浅色/深色、下次保存失败、下次响应丢失、所选事项的外部修改、重置示例数据。
- 设置弹窗内部：另有「演示工具 → 模拟外部配置变化」，用于保留本地表单并重现配置版本冲突。
- 响应丢失模式会先真实提交到内存服务再报错；记录标题不变时使用原请求标识重试，避免重复创建。
- 所有事项和配置通过现有 `BuddeService` / `MemoryStore` 命令修改，不是只改变页面文字。没有持久化、localStorage、网络或真实思源 API。
- 示例固定时间为 `2026-11-11T00:00:00.000Z`。初始 15 条：想法池 14、看板 12、正在推进 6、归档 1。
- 笔记只接受合成示例 `20260101000000-demo001`、`20260101000000-demo002`。打开只验证示例目标，不导航真实笔记；移除关联不删除正文。
- 失败和冲突保留原输入及载入版本；重新读取必须明确确认放弃草稿。刷新页面则直接重置全部示例。

## 布局与主题

以插件容器宽度而非浏览器宽度决定布局：≥1200px 为 320px 详情侧栏，720–1199px 为 360px 覆盖详情，<720px 为全宽详情。看板阶段只在内部横滚，详情与主区独立滚动；窄容器的设置和确认弹窗保持在容器范围内。

默认跟随系统浅深偏好，演示工具可临时覆盖；已有思源语义颜色变量优先于原型回退色，控件继承字体。原生模态 `dialog` 的背景遮罩和 inert 范围仍是整个文档，这是独立原型的实现边界，**不表示已验证真实思源宿主集成**。

## 验证

在已配置 Node / pnpm 的仓库环境中顺序运行：

```powershell
node node_modules/typescript/bin/tsc -p design/workbench/tsconfig.json
node node_modules/tsx/dist/cli.mjs --test design/workbench/model.test.ts design/workbench/draft.test.ts
node design/workbench/verify.mjs
pnpm check
```

浏览器检查使用已有 `@playwright/test` 和本机 Edge，无下载步骤。可加 `--group=shell`、`--group=detail`、`--group=settings` 或 `--group=visual` 单独定位问题；单组运行会覆盖结果文件，最终验收请跑完整四组。

本机 pnpm 有运行脚本前自动校验依赖的设置，因此验收使用进程级 `$env:pnpm_config_verify_deps_before_run='warn'`，没有修改包管理器配置或重装依赖。依赖同步 warning 不等于已安装新包。

- [完整浏览器结果](../../artifacts/design/workbench/results.json)：四组通过、页面错误和 HTTP(S) 请求均为空。
- [逐项验收矩阵](../../docs/design/workbench-validation.md)：C01–C22 的证据与未验证边界。
- [设计说明](../../docs/superpowers/specs/2026-11-11-workbench-design.md) / [执行计划](../../docs/superpowers/plans/2026-11-11-workbench-prototype.md)。

### 代表截图

- [宽屏看板与详情](../../artifacts/design/workbench/light-1440-detail.png)
- [深色看板与详情](../../artifacts/design/workbench/dark-1440-detail.png)
- [480px 全宽详情](../../artifacts/design/workbench/light-480-detail.png)
- [设置迁移影响](../../artifacts/design/workbench/settings-migration.png)
- [保存失败](../../artifacts/design/workbench/detail-failure.png) / [版本冲突](../../artifacts/design/workbench/detail-conflict.png)

## 尚未验收

真实思源 3.4.1 宿主、多窗口、内核/笔记访问、OS 中文输入法组词、屏幕阅读器及不同桌面系统均未实测；浏览器合成 composition 事件不能代替真实输入法验收。480px 是桌面窄分屏，不构成移动端支持承诺。跨设备并发不在 alpha.1 支持范围内。
