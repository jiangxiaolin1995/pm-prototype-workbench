# PRD 与三栏交互原型工作台

给 Codex 使用的 `pm-prototype-workbench` Skill。可以编写本地 HTML PRD、创建交互原型，也可以把已有 HTML 转成三栏工作台，保留原有页面、交互和说明。

- **左侧**：「需求说明」下的全局描述、上线后数据需求、埋点说明，以及按产品组织的二级菜单。每个产品都有「本产品全局说明」和各业务页面，页面注明端与需求归属。
- **中间**：三个独立的纯文字正文页，以及可切回体验的业务原型。点击「选位置写说明」后选择一个可见元素，选择结束即恢复原有交互。
- **右侧**：完整展开的研发说明，和页面上的彩色编号、边框同步高亮。已有说明在原位置编辑，长文本自动展开。

工作 HTML 可以继续标注；手动导出的只读 HTML 可以体验原型、切换页面和定位说明，但不能修改说明。默认不自动下载只读预览，不主动补写业务规则或研发说明。

## PRD 正文

左侧「需求说明」只有三个入口：**全局描述、上线后数据需求、埋点说明**。分别填写需求共用文字、上线后希望观察哪些数据，以及需要的埋点说明；没有埋点可以留空。这里没有上线排期章节。

每页一个大文本框，直接编辑、自动暂存，长文完整展开。只写文字，不增加版本负责人表单、章节开关、表格、图片或 Markdown 编辑工具。默认全部留空，不自动补写业务规则、指标或事件。全局描述打开就是空白输入框，不自动带入旧章节或示例；用户填写的文字正常保存。旧 PRD 原始模型和附件继续保存在 HTML 中，旧埋点沿用迁移进入埋点说明。

- **保存可编辑副本**：手动把 PRD、原型数据、状态和说明草稿保存为新的工作 HTML，换电脑也可继续编辑。
- **导出 PRD**：手动导出包含需求正文及页面编号说明的 Markdown。
- **导出只读 HTML**：供研发查看正文、体验交互和定位说明，不允许编辑；默认不自动下载。

原型中的任意可见 HTML 元素都可选位置填写说明，包括文字、图片、SVG、按钮、禁用控件、表格单元格和弹窗内容。iframe/Shadow DOM 需按元素选择接入约定逐个可访问业务根适配；Canvas 内部图形不属于独立 HTML 元素。

## 安装

将整个仓库放入 Codex 的 Skills 目录，并保留目录名 `pm-prototype-workbench`。使用默认个人目录时，可以运行：

```sh
git clone https://github.com/jiangxiaolin1995/pm-prototype-workbench.git "$HOME/.codex/skills/pm-prototype-workbench"
```

这是公有仓库，无需登录 GitHub 即可查看和克隆。如果目标目录已经存在，请先保留现有改动，不要直接覆盖。本机已安装的 Skill 无需重复安装。自定义 Skills 目录时，将目标路径替换为实际目录。

## 使用

在 Codex 中提供需求或 HTML，并明确调用这个 Skill：

```text
使用 $pm-prototype-workbench，把这个 HTML 转成三栏工作台，保留原来的交互。
```

```text
使用 $pm-prototype-workbench，按我提供的需求生成原型。左侧按产品组织页面，说明留空，由我自己填写。
```

生成的工作 HTML 内联必要资源，可以本地直接打开，不需要后端、构建工具或 CDN。浏览器暂存不等于保存到文件；继续编辑可手动保存工作副本，给研发交付时，使用页面右上角的「导出只读 HTML」。

`assets/workbench.html` 是用于说明机制的示例模板，包含渠道和审核的演示业务及已有示例标注。新项目初始化会清空示例标注和 PRD 正文。新建实际原型时，应根据用户需求替换示例内容；没有提供说明时应留空。转换已有 HTML 时保留源页面，不用示例替换原业务。

## 画布与展示比例

预览区随中间栏可用宽高铺开，默认等比自适应，大屏可放大超过 100%。选择固定比例时，空间不足可横向、纵向滚动查看。中间工具条支持 **100%、90%、80%、70%、60%、50%、自适应**；缩放只作用于原型和标注，目录、工具和右侧说明保持原大小。选择「自适应」会根据可用宽高自动调整，内部列表仍可滚动。改变比例会保留业务输入、说明草稿和当前场景，各页面分别记住选择；只读导出也可调整查看比例。

[H5 工作台示例](examples/h5-workbench.html) 使用 390 × 844 画布，包含列表、收藏、详情和输入交互。下载该 HTML 后可本地打开，默认说明为空，可自行选择位置填写；不依赖网络资源。

## 文件

| 路径 | 用途 |
| --- | --- |
| [SKILL.md](SKILL.md) | Codex 执行约定与验证要求 |
| [agents/openai.yaml](agents/openai.yaml) | Skill 名称、提示词和调用配置 |
| [assets/workbench.html](assets/workbench.html) | 单文件交互模板 |
| [examples/h5-workbench.html](examples/h5-workbench.html) | 可直接打开的 H5 缩放示例 |
| [references/prd-template.md](references/prd-template.md) | 三个文字入口、内容边界、旧正文迁移与导出 |
| [references/template-map.md](references/template-map.md) | 模板模型与修改入口 |
| [references/existing-html.md](references/existing-html.md) | 已有 HTML 转换流程 |
| [references/element-targeting.md](references/element-targeting.md) | 元素选择与稳定定位 |
| [scripts/](scripts/) | 初始化与隔离验证脚本 |

## 初始化与验证

从仓库根目录运行初始化脚本，需要 Python 3：

```sh
python3 scripts/init_prototype.py --title "项目名称" --product "产品名称" --platform "CMS" --output "output/项目原型.html"
```

脚本创建可编辑骨架并隔离缓存，不覆盖已有文件。生成后继续按需求调整业务和说明。

验证脚本需要 Node.js 和 jsdom，HTML 本身不需要安装它们。以下命令可在 Node.js 24 下运行：

```sh
npm install --no-save --package-lock=false jsdom@29.1.1
node scripts/verify_prd.cjs
node scripts/verify_export.cjs assets/workbench.html
node scripts/verify_product_menu.cjs
node scripts/verify_scopes.cjs
node scripts/verify_global_menu.cjs
node scripts/verify_elements.cjs
node scripts/verify_inline_edit.cjs
node scripts/verify_view_authoring.cjs
node scripts/verify_canvas.cjs
node scripts/verify_zoom.cjs
```

已有 jsdom 时，也可通过 `--jsdom /实际路径/node_modules/jsdom` 指定。导出验证默认只在内存中检查，不生成或下载只读 HTML。脚本中的布局数据是测试桩，视觉和实际点击仍需在浏览器中检查。
