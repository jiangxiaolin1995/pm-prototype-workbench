# PRD 与三栏交互原型工作台

`pm-prototype-workbench` 可以按需求新建原型、按截图还原页面、迭代工作文件，也可以把已有 HTML 的交互带入三栏工作台。打开 Codex 给出的本机编辑链接即可填写，内容自动保存进工作 HTML。完成后可手动导出单个只读 HTML 交付。

- 左侧：需求说明里的全局描述、上线后数据需求、埋点说明，以及产品下的全局说明和「产品 → 端 → 页面」目录。同一产品的 App端、CMS端等分别成组，端名按用户说明或已有配置显示。
- 中间：纯文字正文或业务原型。可按 100%、90%、80%、70%、60%、50%、自适应查看。
- 右侧：完整展开的研发说明，彩框／编号／正文双向定位；单次选位置、原位编辑。

工作台整体随窗口自适应：宽屏三栏，中屏收起目录，小屏通过顶部「目录」「说明」展开侧栏。原型区占满剩余窗口，各栏独立滚动；窄屏的保存与导出放在「更多」中。选位置后自动展开说明编辑区，收放面板及调整窗口保留原型输入和草稿。

右侧说明栏左边的分隔线可以左右拖动：向左扩大 PRD，向右扩大原型；拖到右边缘收起，双击恢复默认宽度。选中分隔线后也可用左右方向键调整。当前浏览器记住宽度，小屏会限制在窗口内；收起「目录」「说明」后，原型使用整个可用区域。

全局、产品、数据和埋点正文页的「填写参考」默认展开；只有右侧研发说明的「填写参考」默认折叠，需要时手动展开。参考帮助组织背景、范围、流程、规则、异常和验收条件；开合不改正文或草稿。上线依赖、待确认项和变更按需写入全局描述。参考与正文分开，正文仍默认空白，提示不会进入只读展示或导出的 PRD 文字。

研发说明默认留空，由用户填写。只有明确要求 Codex 编写研发说明，或提供指定放入说明的文字时，才按要求写入；描述交互、生成 PRD、完善原型和截图还原都不会自动生成右侧说明或需求范围文字。已有正文、说明和草稿保留，填写参考只作提示。不会自动补写业务规则或下载只读预览。只读导出禁止修改说明，保留业务交互。

## 安装与使用

将解压后的整个 `pm-prototype-workbench` 文件夹放入 Codex Skills 目录（通常为 `~/.codex/skills/`）。也可从仓库页面复制 Clone 地址，将完整仓库克隆到该目录。

目标目录已存在时，先保留现有改动，不直接覆盖；本机已安装版无需重复安装。

```text
使用 $pm-prototype-workbench，按这些已确认需求做交互原型。
使用 $pm-prototype-workbench，按这张截图还原。
使用 $pm-prototype-workbench，修改这个工作 HTML，保留我已写的内容。
使用 $pm-prototype-workbench，把这个 HTML 转为三栏工作台，保留原来的交互。
```

独立做原型不要求先建完整 SOP 项目。由 `pm-product-sop` 调用时，接收同一推进记录和本次范围，返回产物、修改页面、验证结果与未决项，由 SOP 接续记录。

直接发截图即可开始。中间按原图还原文字、图标、图片、控件和布局，这些元素都可以单独选中写说明。有明确的业务动作时一起告诉 Codex，例如“点选集打开第二张图”；截图里看不出来的交互不会补写。先同尺寸实截，再按页头、卡片、列表等区域比较、局部修正并回查整页。交付直接打开真实 HTML 工作台，附分区对照、差异图和残余差异；不会只给图片报告代替还原网页。[截图还原流程](references/screenshot-to-html.md)

## 干净骨架与业务示例

`assets/workbench.html` 是通用维护源，默认只有文字入口及空业务页，不含渠道／审核的业务模型和事件。

```sh
python3 scripts/init_prototype.py --title "项目" --product "产品" --platform "H5" --output "/项目/output/prototypes/项目.html"
```

实际业务通过 `--config project.json --adapter business.js --style business.css` 接入；配置中的明确正文保留。初始化不覆盖已有文件。配置结构与接入方法见 [模板地图](references/template-map.md)。

渠道／审核与 H5 各自维护在 `examples/channel-review/` 和 `examples/h5/`，只供参考／回归，业务规则不进入默认新建。它们与实际原型使用同一个通用外壳：

```sh
python3 scripts/build_example.py h5 --output "/临时目录/H5工作台.html"
python3 scripts/build_example.py channel-review --output "/临时目录/渠道审核工作台.html"
```

[便携 H5 示例](examples/h5-workbench.html) 是上述源生成的文件，不单独手改。

## 文件与浏览器暂存

同一工作文件迭代后，新的运行时对照文件基线合并更新与浏览器编辑，保留双方独立修改。双方改了同一项时，顶部显示两份内容供核对；选择后仍保留候选归档。旧缓存无基线时，不盲目覆盖文件。详见 [存储与恢复](references/storage.md)。

**编辑时点本机链接，交付时发只读 HTML。** 新建或继续编辑时，Codex 会启动或复用 Python 3 保存程序，并给出绑定当前文件的链接。默认不生成 `.app` 或 `.command`。右侧输入的文字先自动存为草稿，点「保存」后成为正式说明。顶部显示「已自动保存」时，内容已经写回工作 HTML。

在同一台电脑上，服务运行时可用同一个链接在不同浏览器继续写。关闭页面且闲置 30 分钟后，保存程序会退出。电脑重启或链接失效时，告诉 Codex「继续编辑上次的 PRD」，它会重新打开原文件并给出当前链接。

Codex 为已有工作文件取得编辑链接时使用：

```sh
python3 scripts/prepare_workbench.py "/项目/工作文件.html"
```

脚本返回 `editEntry`（本机编辑链接）和 `file`（工作 HTML 路径）。移动项目时可一并保留隐藏的 `.workbench` 目录，其中含本地备份。旧项目可以直接对原 HTML 使用上述命令。

直接双击 HTML 是离线兼容方式，只能备份到当前浏览器，顶部会明确显示「未写入 HTML」，不会弹文件选择器或冒充已落盘。它不作为默认编辑入口。保存程序断开或发生版本冲突时，保留当前输入并显示失败。

正文、说明及未完成草稿均自动保存，不自动把所写规则变为业务实现，也不自动下载只读 HTML。最终由用户点击「导出只读 HTML」，所得文件不带本地保存连接，保留原型交互且禁止填写说明。

## 验证

HTML 本身无需依赖。验证脚本使用 Python 3、Node.js 与 jsdom；优先使用已有模块，可传 `--jsdom /实际路径/node_modules/jsdom`。开发环境可安装：

```sh
npm install --no-save --package-lock=false --ignore-scripts jsdom@29.1.1
```

直接检查实际产物：

```sh
node scripts/verify_workbench.cjs "/实际产物.html"
node scripts/verify_workbench.cjs "/实际产物.html" --scenario "/业务场景.json"
```

通用验证读取目标文件，运行其真实标注／导出处理器，导出只在内存检查。报告列出跳过项与局限，不把模板回归冒充产物验收。原型含未保存草稿时保留并检查导出阻断。

模板回归与业务场景格式见 [验证约定](references/verification.md)。脚本几何桩不能代替真实浏览器；业务规则、跨根选择和真实后端需相应证据。

## 维护文档

- [Skill 入口](SKILL.md) 汇总各条工作路线、职责、授权和 SOP 交接。
- [交互约定](references/workbench-contract.md)：已确认的三栏、标注、比例、保存与交付行为。
- [模板地图](references/template-map.md)：模型、业务适配器和维护源。
- [已有 HTML 转换](references/existing-html.md)：保留源交互、数据、资源和复杂根。
- [PRD 纯文字正文](references/prd-template.md)、[元素选择](references/element-targeting.md)、[存储](references/storage.md)、[验证](references/verification.md)：按任务读取。
