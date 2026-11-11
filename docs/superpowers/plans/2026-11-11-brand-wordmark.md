# Budde Quicksand Brand Wordmark Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将已选右侧“原小芽 + Quicksand SemiBold 600”接入正式插件，校验后备份并更新本地 alpha.1 ZIP。

**Architecture:** 单独维护共享的矢量小芽常量，让工作台与思源入口使用同一品牌图形。保留原始 Quicksand 可变字体，通过既有 CSS 构建器将其嵌入为私有品牌字体；只有 Budde 字标应用 600 字重，不增加运行时依赖，不扩大发布包六文件白名单。

**Tech Stack:** 现有 React/TypeScript/Tailwind/PostCSS/esbuild、Playwright Edge、Node 测试；原始 SIL OFL 1.1 Quicksand TTF。

**Spec:** [已批准品牌定稿方案](../specs/2026-11-11-brand-wordmark-design.md)。

## Global Constraints

- 仅微调品牌：保留原小芽双叶、圆头笔画和直立茎；不得用通用 Lucide Sprout 替代。
- Quicksand 字重固定 600；正文/中文/按钮/卡片字体和普通 Lucide 图标不变。
- 完全离线；不依赖宿主安装字体、不发起外部字体请求、不引入新运行时包。
- 官方原始 TTF 为 124824 字节，SHA-256 `39c9b64223561f56aaff6062a6f04063c4fc86809ad6768722c06614d977e1cc`。只内嵌该未修改字体，不借子集/重命名混淆 Reserved Font Name 条款；完整版权和 OFL 许可保留于源目录及随包 README。
- 品牌是 [UI 规范](../../../ui-design-system.md) 中通用图标/系统字体规则的已授权局部例外；其余布局、主题、生命周期、数据语义完全保留。
- 主控是唯一写入者；如需复核最多委派一个只读代理，不让其运行写入型命令。
- 复用当前隔离 worktree，保留所有既有修改；不提交、合并、推送。
- 浏览器套件必须串行，避免覆盖共用预览目录；所有夹具均为合成数据。
- 仅覆盖本地发布 ZIP；不安装到真实思源，不改数据、启用配置或重启思源。

## Review Focus

1. 图形：原小芽的圆头双叶/直茎、入口与工作台统一、装饰图标辅助技术隐藏。
2. 字体：实际加载 Quicksand 600，而非仅配置字体名后回退；不影响其它文本或宿主。
3. 边界：浅深主题、1440×900 与 1280×800、标题栏不折行/不挤压导航、实例销毁无新生命周期工作。
4. 发布：内嵌字体完整性、许可随包、六文件清单仍成立、真实环境不动。
5. 回归：现有业务/草稿/拖拽/宿主断言不删改；新品牌断言先验证旧实现失败。

## File Map

- 新建 `src/brand.ts`：无 React/宿主依赖的固定 SVG viewBox、path、stroke 和思源 symbol 生成数据。
- 修改 `src/index.ts`、`src/ui/components/icons.tsx`：入口及工作台消费共享品牌数据，普通图标映射不变。
- 新建 `src/ui/assets/Quicksand-variable.ttf`、`src/ui/assets/Quicksand-OFL.txt`：从已核对的本地下载副本原样复制，可复现、无构建时下载。
- 修改 `scripts/css.mjs`、`tailwind.config.ts`、`src/ui/workbench-view.tsx`：生产 CSS 内嵌 data URI 的 `BuddeBrandQuicksand` 私有字体，仅 `.budde` 内的品牌 span 使用；既有 raw 静态工具模式无需加载该字体。
- 修改 `README.md`、`ui-design-system.md`：许可全文和授权品牌例外，不覆盖旧文档其它内容。
- 新建 `tests/brand.test.ts`、`scripts/verify-brand.mjs`：共享 SVG、字体完整性及浏览器品牌回归；修改 `package.json` 将品牌校验接入串行 `test:design`。
- 修改 `scripts/verify-design-system.mjs`：截图稳定阶段等待 `document.fonts.ready`，不改变旧断言。
- 修改 `docs/validation.md` 及本计划：记录新截图、实际结果、发布校验和边界。

## Task 1 — Shared original mark and isolated offline wordmark

- [x] 记录当前 Git 状态和已改文件，读取目标文件及 craft-floor；不得清理旧改动。
- [x] 先增加 `tests/brand.test.ts`：共享原小芽数据一致、原始字体 SHA-256 和 OFL 文本存在、品牌消费者/许可约束可验证；运行单测，确认旧实现不满足品牌断言。
- [x] 建立共享 SVG 品牌常量，用原图校准圆头、对称双叶、直立茎；将工作台与 SiYuan symbol 的引用接入，移除只用于品牌的 Lucide Sprout 引用。
- [x] 原样复制已核对 TTF/OFL；既有 CSS 构建器以 `data:font/ttf;base64` 注入 `@font-face`，私有 family 为 `BuddeBrandQuicksand`、weight 范围 300–700；不输出额外运行时字体文件。
- [x] Tailwind 增加品牌专用 family，字标 span 保持 18px、600、正常字距和无合成粗体，图标仍为 24px；其它字体配置不变。
- [x] 在 README 保留完整版权/许可；UI 规范补充本次品牌例外，明确不授权推广到正文或功能图标。
- [x] 运行新单测和 `pnpm check`；必须通过类型、全部单元测试与生产构建。

## Task 2 — Browser brand verification and UI regression

- [x] 先写 `scripts/verify-brand.mjs`，使用真实生产预览而非对比页：断言 `FontFace.status=loaded`、品牌 family/600/18px、普通正文不受影响、品牌图形与入口共用常量、无外部字体请求。
- [x] 在 1440×900 与 1280×800 的浅色/深色下验证标题栏几何、导航间隔和对比度；截图写入 `artifacts/qa/brand-quicksand/`。
- [x] 将品牌校验接入现有 `test:design`，为已有视觉截图等待实际字体就绪；保留所有旧功能断言。
- [x] 串行运行 `pnpm test:ui` 与 `pnpm test:plugin`；检查失败，不掩盖既有问题。
- [x] 批量打开最终截图，核对小芽与获批参考、Quicksand 字形/字重及小尺寸对齐；发现视觉问题先修复再看。
- [x] 完成后仅运行一次机械设计 detector；真实缺陷修复，误报只记录窄范围原因，不将 warning 宣称为无警告通过。
- [x] 需要时委派一个只读复核，主控审核最终 diff、测试与许可/资源边界；不覆盖协作者修改。

## Task 3 — Backup, reproducible release and delivery

- [x] 将当前 ZIP 与 `.sha256` 复制到一个新的 `artifacts/release-backups/budde-before-quicksand-<timestamp>/`，核对其 SHA-256 仍为 `31d57823dbaad868ceb09bdf7744fc642cec5a2cca9e044fd2d260f9748e1d49`，不覆盖已有备份。
- [x] 运行 `pnpm package:plugin`、`pnpm test:plugin`、`pnpm test:release`；验证六个 ZIP 文件与 dist 一致、可重复打包、字体及许可随包、两次合成安装不改状态和启用配置。
- [x] 更新验收记录、本计划及最终结果，记录实际包大小和新 SHA-256；清楚声明未安装到真实思源。
- [x] 交付最终品牌截图、ZIP 和校验文件；不把仅字体选型的 PNG 当作已接入截图。

## Execution Method

建议 **Native / 主控直接执行**：三个步骤共享品牌数据、CSS 构建和发布产物，单写入者更适合此小范围修改。沿用用户既定的主控单写入约束，不默认启动多代理实现。

用户已确认“按计划直接执行”；Native 单写入者实施与验证已完成。当前工作树保留，未提交、合并或推送。

## Execution Record

- 基线 29/29；两项品牌单测先 RED（通用 Sprout、未内嵌字体），再 GREEN，最终类型检查、31/31 测试和构建通过。
- 串行 UI 133 组全部通过，合成 CJS/浏览器宿主通过；新增浏览器品牌 7 组覆盖实际字体加载、18px/600、正文隔离、四种尺寸/主题与无外部请求。最终截图见 [验收记录](../../validation.md)。
- 有据偏差：旧 parity / design-system 测试强制品牌也为 Lucide，与获批原小芽冲突；窄化为非品牌必须 Lucide、品牌必须非 Lucide，保留全部几何/描边/aria 与业务断言。同时加强实际构建宿主 SVG 一致性、实际发布字体 SHA 和许可全文检查。
- 最终生产工作台源文件 detector 返回空 findings；一次只读新鲜品牌复核无 Critical / Important / actionable Minor。真实宿主、OS 和绝对法律保证未作验收声明。
- 旧包及校验文件经散列核对备份到 [品牌接入前备份](../../../artifacts/release-backups/budde-before-quicksand-20261111-202036/verification.json)。
- 新 [ZIP](../../../artifacts/release/siyuan-plugin-budde-0.1.0-alpha.1.zip) 417,190 bytes；SHA-256 `636cba93df58ffd0a7c0bbd13206bf1afe1ab1ef7d1722ed222fafd46be40dce`。最终 `pnpm check` → `pnpm package:plugin` → `pnpm test:plugin` → `pnpm test:release` exit 0；六文件白名单、字体字节、完整许可、可重复打包及两次合成安装保持状态/配置均通过。标准解压逐文件散列另行通过。
- 只覆盖本地 ZIP。没有安装到真实思源，没有修改真实事项/启用配置或重启。
