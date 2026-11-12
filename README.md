# Budde

思源里的轻量想法池与生命周期看板：**先记一个标题，想推进时再展开；用思源笔记承载长内容。**

Budde 是运行在思源笔记桌面端的原生插件（当前版本 `0.2.0`），不需要独立账号、云服务或外部数据库进程，数据随当前思源工作空间安全存储。

## 核心工作流与功能

### 1. 随时捕获（零打断进入想法池）
- **打开工作台**：点击思源顶栏的萌芽图标，或按 `Alt + Shift + B`（macOS 为 `⌥⇧B`）。工作台非编辑区按 `C` 即可聚焦快速输入框。
- **全局快速记录弹窗**：按 `Alt + Shift + N`（macOS 为 `⌥⇧N`），或按住 `Shift` 点击顶栏萌芽图标，无需离开当前正在阅读/写作的文档即可记下一条想法（`Enter` 记入想法池，`⌘/Ctrl + Enter` 直接开始推进）。
- **编辑器一键收入**：在思源文档块标菜单或文档标题菜单点击 **「收入 Budde 想法池」**，自动提取块/文档标题并建立双向关联引用。

### 2. 四视图生命周期闭环
- **池子（Pool）**：承接零散念头，只需标题即可保存，不强迫填写日期、优先级或长描述；想动手时一键「开始推进」。
- **推进（Active）**：跨类型聚合个人精力焦点，内置 **推进中 / 需复查 / 已暂停 / 已完成** 四个聚焦子视图，支持置顶与按手动、最近更新、最早创建或最久未复查排序。
- **看板（Board）**：按类型呈现多阶段生命周期列。支持**同列上下拖拽排序**与**跨阶段拖放流转**（池中想法移入后续阶段会自动转为推进中），也可一键批量归档已完成事项。
- **归档（Archive）**：集中沉淀已归档事项，支持搜索、恢复到原阶段、单条彻底删除及清空归档。

### 3. 详情面板与思源笔记深度联动
- **直接编辑 + 冲突保护**：打开详情即可直接编辑标题、类型、下一步行动与简要说明（失焦自动保存或 `⌘/Ctrl + S` 保存）；遇到多窗口并发修改时保留本地输入并提供重新读取或覆盖保存。
- **垂直阶段时间轴**：完整换行显示所有阶段名称与完成属性，点击任意阶段即可前进或回退。
- **实时搜索关联思源文档/块**：无需手抄块 ID，直接在详情里按关键词搜索思源文档、标题或段落（同样支持直接粘贴块 ID、`siyuan://` 链接或 `((块引用))`），区分「参考资料」与「产出文档」。
- **一键创建产出文档**：当某个想法准备展开长文写作时，可直接在详情面板选择思源笔记本，一键创建带初始上下文的思源文档并自动挂载为「产出文档」后打开。

### 4. 类型定制与数据导入导出
- **统一生命周期设置**：内置通用、文章、软件、旅行四种默认类型及五套阶段模板；支持 36 个离线精选图标与单个 Emoji、6 种语义配色、按类型自定义复查周期（7 / 14 / 30 / 60 天或关闭提醒）。
- **安全迁移删除**：删除仍有事项（含归档事项）的阶段或类型时，强制要求选择迁移目标并原子迁移全部事项，绝不产生孤儿数据。
- **JSON 导出与导入**：支持导出完整状态快照，也支持从备份 JSON（含 `v1` 旧版格式自动升级到 `schemaVersion: 2`）校验导入。

## 数据与支持范围

- 数据保存在当前思源工作空间的 `data/storage/petal/siyuan-plugin-budde/state.json`，与插件代码目录分离。
- 写入采用跨进程文件锁、乐观版本校验与临时文件原子替换；遇到文件损坏或未知高版本格式时安全阻断读写，绝不静默清空原文件。
- 创建请求携带持久化幂等标识；`requests` 去重记录自动按上限裁剪并在事项删除时清理。
- 当前版本面向思源 **3.4.1 及以上桌面端**，并发保证限于同一台设备访问同一工作空间；跨设备同步请先完成思源文件同步后再编辑。

## 安装与升级

安装包 `siyuan-plugin-budde-0.2.0.zip` 根目录直接包含插件运行文件。退出思源（或关闭 Budde 页签并禁用插件）后，将压缩包解压至工作空间的 `data/plugins/siyuan-plugin-budde/`，保留 `data/storage/petal/siyuan-plugin-budde/` 数据目录不变，重启思源并启用插件即可（旧版 `schemaVersion: 1` 数据会在读取与写入时自动无损升级为 `schemaVersion: 2`）。

## 开发与验证

需要 Node.js 22+ 与 pnpm：

- `pnpm install`：安装依赖
- `pnpm check`：执行 TypeScript 类型检查、核心与存储单元测试及生产构建（产物位于 `dist/`）
- `pnpm test:ui`：启动隔离浏览器验证工作台四视图、拖拽排序、思源笔记搜索与创建、生命周期设置、导入导出、明暗主题及多尺寸响应式布局
- `pnpm test:plugin`：验证 CommonJS 插件包加载、快速捕获弹窗、编辑器菜单联动与宿主样式隔离
- `pnpm package:plugin && pnpm test:release`：生成可重复构建的发行 ZIP 与 SHA-256，并验证发行清单与升级数据保护
- `node scripts/install.mjs <思源工作空间根目录>`：仅将 `dist/` 复制到指定工作空间插件目录（不自动修改启用状态）

## 品牌字体与第三方许可

Budde 品牌字标使用 Quicksand SemiBold 600，字体离线内嵌于插件 CSS，仅作用于英文品牌文字；正文仍使用宿主/系统字体。原始字体来自 [Google Fonts 的 Quicksand 目录](https://github.com/google/fonts/tree/main/ofl/quicksand)，以 SIL Open Font License 1.1 分发，支持按许可随软件嵌入与再分发（包括商业软件），不代表对名称、商标等一切权利的绝对无风险承诺。

本插件嵌入未经修改的原始字体字节；`BuddeBrandQuicksand` 只是 CSS 内部引用别名，不是修改字体名称或重新发布衍生字体。Quicksand 的完整版权声明及许可证如下，也可离线查看本段。

```text
Copyright 2011 The Quicksand Project Authors (https://github.com/andrew-paglinawan/QuicksandFamily), with Reserved Font Name “Quicksand”.

This Font Software is licensed under the SIL Open Font License, Version 1.1.
This license is copied below, and is also available with a FAQ at:
http://scripts.sil.org/OFL


-----------------------------------------------------------
SIL OPEN FONT LICENSE Version 1.1 - 26 February 2007
-----------------------------------------------------------

PREAMBLE
The goals of the Open Font License (OFL) are to stimulate worldwide
development of collaborative font projects, to support the font creation
efforts of academic and linguistic communities, and to provide a free and
open framework in which fonts may be shared and improved in partnership
with others.

The OFL allows the licensed fonts to be used, studied, modified and
redistributed freely as long as they are not sold by themselves. The
fonts, including any derivative works, can be bundled, embedded, 
redistributed and/or sold with any software provided that any reserved
names are not used by derivative works. The fonts and derivatives,
however, cannot be released under any other type of license. The
requirement for fonts to remain under this license does not apply
to any document created using the fonts or their derivatives.

DEFINITIONS
"Font Software" refers to the set of files released by the Copyright
Holder(s) under this license and clearly marked as such. This may
include source files, build scripts and documentation.

"Reserved Font Name" refers to any names specified as such after the
copyright statement(s).

"Original Version" refers to the collection of Font Software components as
distributed by the Copyright Holder(s).

"Modified Version" refers to any derivative made by adding to, deleting,
or substituting -- in part or in whole -- any of the components of the
Original Version, by changing formats or by porting the Font Software to a
new environment.

"Author" refers to any designer, engineer, programmer, technical
writer or other person who contributed to the Font Software.

PERMISSION & CONDITIONS
Permission is hereby granted, free of charge, to any person obtaining
a copy of the Font Software, to use, study, copy, merge, embed, modify,
redistribute, and sell modified and unmodified copies of the Font
Software, subject to the following conditions:

1) Neither the Font Software nor any of its individual components,
in Original or Modified Versions, may be sold by itself.

2) Original or Modified Versions of the Font Software may be bundled,
redistributed and/or sold with any software, provided that each copy
contains the above copyright notice and this license. These can be
included either as stand-alone text files, human-readable headers or
in the appropriate machine-readable metadata fields within text or
binary files as long as those fields can be easily viewed by the user.

3) No Modified Version of the Font Software may use the Reserved Font
Name(s) unless explicit written permission is granted by the corresponding
Copyright Holder. This restriction only applies to the primary font name as
presented to the users.

4) The name(s) of the Copyright Holder(s) or the Author(s) of the Font
Software shall not be used to promote, endorse or advertise any
Modified Version, except to acknowledge the contribution(s) of the
Copyright Holder(s) and the Author(s) or with their explicit written
permission.

5) The Font Software, modified or unmodified, in part or in whole,
must be distributed entirely under this license, and must not be
distributed under any other license. The requirement for fonts to
remain under this license does not apply to any document created
using the Font Software.

TERMINATION
This license becomes null and void if any of the above conditions are
not met.

DISCLAIMER
THE FONT SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO ANY WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT
OF COPYRIGHT, PATENT, TRADEMARK, OR OTHER RIGHT. IN NO EVENT SHALL THE
COPYRIGHT HOLDER BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
INCLUDING ANY GENERAL, SPECIAL, INDIRECT, INCIDENTAL, OR CONSEQUENTIAL
DAMAGES, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
FROM, OUT OF THE USE OR INABILITY TO USE THE FONT SOFTWARE OR FROM
OTHER DEALINGS IN THE FONT SOFTWARE.
```
