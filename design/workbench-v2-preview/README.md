# Budde V2 · Token 规范化静态预览

本轮按用户确认的 **36px 常规控件契约**，先补齐 token 与组件规则，再统一整个静态工作台。不是正式插件、不是业务交互版本；现有可交互原型及生产代码保持不变。

## 打开与交付

- [完整工作台源码](index.html)：直接用桌面 Edge / Chromium 打开，无需服务器或网络。
- [设计规范](DESIGN.md)：颜色、排版、空间、控件、状态、布局与动效的规范值。
- [生成的完整工作台](../../artifacts/design/workbench-v2-system/budde-v2-system.html)。
- [同源组件样张](../../artifacts/design/workbench-v2-system/budde-component-kit.html)：可切换浅深主题，试用 hover / pressed / Tab 焦点，查看所有解析后的 token。
- [Token CSS](../../artifacts/design/workbench-v2-system/budde-tokens.css)、[组件 CSS](../../artifacts/design/workbench-v2-system/budde-components.css)、[解析值清单](../../artifacts/design/workbench-v2-system/tokens.json)。接入组件 CSS 前先加载 token CSS；生成文件不得手工修改。
- [浏览器验收记录](../../artifacts/design/workbench-v2-system/results.json)及[截图目录](../../artifacts/design/workbench-v2-system/)。旧绿色稿与单色初稿保留在各自原目录。

## 整页共用规则

- 常规按钮、顶部导航、类型、管理入口、搜索、详情操作、主题切换：**统一 36px 高**。
- 图标按钮：**36 × 36px**；界面图标 **16 × 16px**，品牌标识独立为 24 × 24px；统一 1.75 SVG 线宽。
- 控件文字 **13 / 20px、500**；左右内边距 12px、图文间距 8px、圆角 6px；主按钮同高，仅用反色区分。
- 标题 20 / 28px、正文 14 / 24px、标签 13 / 20px、元信息 12 / 16px；字重限 400 / 500 / 600。
- 内容型按钮是明确例外：事项卡最小 80px，笔记入口最小 56px；随文本增长，不强制压成 36px。
- default / hover / pressed / focus-visible / disabled / loading 共用规则；焦点环 2px、偏移 2px，busy 同时禁用。减少动态效果时取消过渡与面板动画。
- 原始颜色保持黑白灰；交互边界和装饰分隔分别定义。宿主字体、文字和表面可继承思源，不映射宿主彩色 primary。

## 唯一来源

[工作台页面](index.html)内的 `style#budde-tokens` 是唯一 token 来源；`style#budde-components` 管组件；`style#budde-layout` 只管页面布局。

[生成器](system.mjs)逐字抽取前两段 CSS 和本地图标生成样张及可复用 CSS。样张布局单独定义，不重写组件尺寸和色值。[浏览器检查](verify-system.mjs)断言源码、样张、CSS 导出完全一致，防止文档一套、页面另一套。

## 复现验收

在仓库已有 Node.js / Playwright 环境中运行：

```text
node design/workbench-v2-preview/render.mjs
pnpm check
```

[渲染脚本](render.mjs)使用已有桌面 Edge，无需安装浏览器或启动服务器。覆盖浅深主题 × 1440 / 1024 / 720 / 480px 工作台；每个尺寸分别检查详情打开与关闭。组件样张覆盖浅深主题 × 1120 / 480px。另补充 320px 极窄面板打开/关闭、从宽屏切换到覆盖面板、正常动效 160ms 的检查；这仍不是移动端支持承诺。

检查真实盒模型、公共组件类、字号/行高/圆角、图标、hover / pressed / focus / disabled / busy、减少动态效果、样张同源性、根溢出、阶段语义、静态边界、键盘循环、采样文字/控件边界对比度、宿主变量探针，以及无页面错误 / 无 HTTP(S) 请求。组件状态对比度使用浏览器 Canvas 解析颜色，避免 `color(srgb …)` 被误当作 0–255 RGB。

## 交互与产品边界

- 详情默认是阅读态，无输入框、选择器或保存按钮。编辑入口明确可见，但在本稿只显示静态提示。
- 阶段轴只表达路径与当前位置；位置 2 / 4 不表示完成百分比，不推断之前的阶段已完成。完成阶段独立标注。
- 420px 阅读侧栏；小于 1200px 为覆盖面板，小于 720px 为全宽；主题开关移入同一焦点循环。窄面板不是移动端支持承诺。
- 可关闭 / 重开详情、按 Escape 关闭、切换主题；其他业务按钮不创建、修改或保存数据，不使用网络、localStorage 或独立同步。
- 组件样张的空状态 / 失败文案只是样式示例，不代表真实保存、失败恢复、思源主题或跨平台宿主验收已经完成。
