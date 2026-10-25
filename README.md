# 三栏交互原型工作台

给 Codex 使用的 `pm-prototype-workbench` Skill。可以新建本地 HTML 交互原型，也可以把已有 HTML 转成三栏工作台，保留原有页面和交互。

- **左侧**：整个工作台的「全局内容」，以及按产品组织的二级菜单。每个产品都有「本产品全局说明」和各业务页面，页面注明端与需求归属。
- **中间**：可交互的业务原型。点击「选位置写说明」后选择一个可见元素，选择结束即恢复原有交互。
- **右侧**：完整展开的研发说明，和页面上的彩色编号、边框同步高亮。已有说明在原位置编辑，长文本自动展开。

工作 HTML 可以继续标注；手动导出的只读 HTML 可以体验原型、切换页面和定位说明，但不能修改说明。默认不自动下载只读预览，不主动补写业务规则或研发说明。

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

生成的工作 HTML 内联必要资源，可以本地直接打开，不需要后端、构建工具或 CDN。浏览器暂存不等于保存到文件；给研发交付时，使用页面右上角的「导出只读 HTML」。

`assets/workbench.html` 是用于说明机制的示例模板，包含渠道和审核的演示业务。新建实际原型时，应根据用户需求替换示例内容；没有提供说明时应留空。转换已有 HTML 时保留源页面，不用示例替换原业务。

## 文件

| 路径 | 用途 |
| --- | --- |
| [SKILL.md](SKILL.md) | Codex 执行约定与验证要求 |
| [agents/openai.yaml](agents/openai.yaml) | Skill 名称、提示词和调用配置 |
| [assets/workbench.html](assets/workbench.html) | 单文件交互模板 |
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
node scripts/verify_export.cjs assets/workbench.html
node scripts/verify_product_menu.cjs
node scripts/verify_scopes.cjs
node scripts/verify_global_menu.cjs
node scripts/verify_elements.cjs
node scripts/verify_inline_edit.cjs
node scripts/verify_view_authoring.cjs
```

已有 jsdom 时，也可通过 `--jsdom /实际路径/node_modules/jsdom` 指定。导出验证默认只在内存中检查，不生成或下载只读 HTML。脚本中的布局数据是测试桩，视觉和实际点击仍需在浏览器中检查。
