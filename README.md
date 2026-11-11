# Budde

思源里的轻量想法池与生命周期看板。先记一个标题，想推进时再展开。

这是思源插件，不需要独立账号、服务、模型或数据库进程。当前版本为 `0.1.0-alpha.2`，优先验证个人桌面端使用。

## 使用

启用插件后，点击顶栏的萌芽图标，或通过命令入口打开 Budde。快捷键为 Alt + Shift + B。

- **池子**：只输入标题即可保存，默认使用通用类型；不自动创建笔记。
- **看板**：开始推进后，事项进入对应类型看板；拖动或在详情中选择阶段均可推进和回退。
- **正在推进**：跨类型查看未暂停、未完成、未归档的事项。
- **详情**：默认先阅读，点击“编辑事项”才进入草稿；明确保存，失败或版本冲突时保留输入。离开未保存草稿时可保存、放弃或继续编辑。可填写说明与下一步，关联已有思源文档或块，暂停、恢复和归档。
- **阶段路径**：垂直时间轴显示完整阶段名称，点击可前进或回退；只表示阶段顺序和当前位置，不是执行历史或完成百分比，完成由阶段的“完成阶段”属性决定。
- **类型与阶段**：看板侧栏 + 新建类型，选择初始阶段模板、36 个离线线框图标或单个 Emoji、六种克制配色；类型旁编辑，列标题菜单重命名、调整完成属性及顺序。最右虚线列输入名称后按 Enter 新增阶段；删除非空阶段必须迁移，归档事项同样受到保护。
- **键盘与反馈**：工作台非编辑区按 C 聚焦快速记录，Enter 保存；Esc 关闭干净详情，未保存修改仍需确认，输入法候选期间不触发关闭。暂停/恢复、复查及归档/恢复在保存成功后显示本实例内的短暂提示；减少动态效果偏好会禁用非必要运动。
- **导出**：完整 JSON 包含类型、阶段、事项、版本和请求去重记录；不包含关联笔记全文或附件。

## 数据与支持范围

数据保存在当前工作空间的 `data/storage/petal/siyuan-plugin-budde/state.json`，与插件安装目录分离。保存采用同机写入锁、版本校验和文件替换；文件损坏时停止读写，不自动清空重建。

alpha.2 的并发保证限于同一台电脑访问同一工作空间文件的 Budde 实例。不支持跨设备同时编辑、离线合并、浏览器或移动端。思源文件同步不等同于并发事务；跨设备操作前应先完成同步，并避免同时编辑。

创建请求标识持久保存于数据中，跨插件重启有效；同一请求参数的重试返回原事项，不以标题去重。修改事项必须提供读取时的版本，过期修改会拒绝。界面和未来的适配层共用 `BuddeService`，当前没有对外 MCP 或 CLI 接口。

暂不提供自动创建思源文档、用户导入界面和永久删除；导出格式可用于受控恢复。外部 AI 入口和跨设备并发不是本版本交付内容。

## 安装与升级

要求思源 **3.4.1 或以上桌面端**。安装包 `siyuan-plugin-budde-0.1.0-alpha.2.zip` 根目录包含插件文件；退出思源或关闭 Budde 页签并禁用插件后，将包内文件解压到工作空间的 `data/plugins/siyuan-plugin-budde/`，不要再套一层同名目录，然后重新打开思源并启用插件。

升级前建议备份工作空间。只替换插件目录中的构建文件，保留 `data/storage/petal/siyuan-plugin-budde/`，不要删除数据目录。安装与升级不自动修改插件启用配置。

本轮验收使用隔离浏览器和合成宿主，**不自动安装、重启思源或修改启用状态，尚未验收真实思源窗口**。测试环境不等于原生宿主验收；首次启用后建议先用少量测试事项走测记录、编辑、关联笔记和重启恢复。

## 开发

需要 Node.js 22+ 和 pnpm。运行 `pnpm install`，再运行 `pnpm check`。`pnpm build` 生成可安装的插件目录 `dist/`，不会自动安装或启用。

将 `dist/` 的内容放到思源工作空间的 `data/plugins/siyuan-plugin-budde/`，然后在思源集市的已下载插件中启用。也可运行 `node scripts/install.mjs <思源工作空间根目录>`，此命令仅复制构建产物，不自动启用插件。更新时替换插件目录里的构建产物，保留 `data/storage/petal/` 数据。

`pnpm test:ui` 使用本机 Edge 的隔离浏览器检查正式工作台交互、36px 控件、明暗主题、容器布局、多实例和异步卸载；`pnpm test:plugin` 检查 CommonJS 加载、构建后页签实际挂载、入口与卸载。`pnpm package:plugin` 构建并生成可重复的 ZIP 与 SHA-256；`pnpm test:release` 检查 ZIP 文件清单及临时工作空间的安装/升级数据保护。它们不替代真实思源窗口中的启用走测。

`src/core/` 为无宿主依赖的业务逻辑，`src/platform/` 负责文件存储与思源笔记，`src/ui/` 为插件工作台。开发预览与测试夹具不属于独立产品，不随插件运行。

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
