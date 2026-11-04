# PRD 与三栏交互原型工作台

给 Codex 使用的 `pm-prototype-workbench` Skill：新建交互原型、迭代已有工作文件，或保留原 HTML 的交互转换为三栏工作台。工作版双击启动入口即可填写并自动保存；完成后手动导出单个只读 HTML 交付。

- 左侧：需求说明里的全局描述、上线后数据需求、埋点说明，以及产品下的全局说明与页面。
- 中间：纯文字正文或业务原型。可按 100%、90%、80%、70%、60%、50%、自适应查看。
- 右侧：完整展开的研发说明，彩框／编号／正文双向定位；单次选位置、原位编辑。

工作台整体随窗口自适应：宽屏三栏，中屏收起目录，小屏通过顶部「目录」「说明」展开侧栏。原型区占满剩余窗口，各栏独立滚动；窄屏的保存与导出放在「更多」中。选位置后自动展开说明编辑区，收放面板及调整窗口保留原型输入和草稿。

缺失内容留空；用户已明确提供并要求写入的内容直接落位，原有文字保留。不会自动补写业务规则或下载只读预览。只读导出禁止修改说明，保留业务交互。

## 安装与使用

将解压后的整个 `pm-prototype-workbench` 文件夹放入 Codex Skills 目录。也可克隆公有仓库：

```sh
git clone https://github.com/jiangxiaolin1995/pm-prototype-workbench.git "$HOME/.codex/skills/pm-prototype-workbench"
```

目标目录已存在时，先保留现有改动，不直接覆盖；本机已安装版无需重复安装。

```text
使用 $pm-prototype-workbench，按这些已确认需求做交互原型。
使用 $pm-prototype-workbench，修改这个工作 HTML，保留我已写的内容。
使用 $pm-prototype-workbench，把这个 HTML 转为三栏工作台，保留原来的交互。
```

独立做原型不要求先建完整 SOP 项目。由 `pm-product-sop` 调用时，接收同一推进记录和本次范围，返回产物、修改页面、验证结果与未决项，由 SOP 接续记录。

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

日常编辑请双击 HTML 旁边的 **「…-打开工作台.app」**（macOS），直接打开这份文件并启用自动保存，无需选择文件；下次打开同一入口接着写。顶部显示「自动保存已开启／已自动保存」，内容写回旁边同一份 HTML。保存程序只监听本机地址，没有页面时会在 30 分钟后停止；再次双击自动重启或复用，无需维护端口。

当前 Mac 需要 Python 3。新建脚本默认配套启动入口；已有 HTML 执行：

```sh
python3 scripts/prepare_workbench.py "/项目/工作文件.html"
```

也可直接用 Python 3 启动 `scripts/serve_workbench.py --launch "/项目/工作文件.html"`。移动工作目录时保留 HTML、启动入口和隐藏的 `.workbench` 文件夹；启动入口通过相对路径找到对应文件。只读交付只发送导出的 HTML。

日常交付和打开使用初始化结果的 `editEntry`，已绑定正确 HTML，不需要寻找或选择文件。模板已移除「连接 HTML」「启用自动保存」和文件选择器；保存说明立即写入，输入及草稿短暂防抖后自动写入。收到磁盘读回确认后，顶部才显示「已自动保存」。

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

- [Skill 入口](SKILL.md)：三条路线、职责、授权和 SOP 交接。
- [交互约定](references/workbench-contract.md)：已确认的三栏、标注、比例、保存与交付行为。
- [模板地图](references/template-map.md)：模型、业务适配器和维护源。
- [已有 HTML 转换](references/existing-html.md)：保留源交互、数据、资源和复杂根。
- [PRD 纯文字正文](references/prd-template.md)、[元素选择](references/element-targeting.md)、[存储](references/storage.md)、[验证](references/verification.md)：按任务读取。
