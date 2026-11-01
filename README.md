# PRD 与三栏交互原型工作台

给 Codex 使用的 `pm-prototype-workbench` Skill：新建交互原型、迭代已有工作文件，或保留原 HTML 的交互转换为三栏工作台。最终交付一个可离线打开的 HTML。

- 左侧：需求说明里的全局描述、上线后数据需求、埋点说明，以及产品下的全局说明与页面。
- 中间：纯文字正文或业务原型。可按 100%、90%、80%、70%、60%、50%、自适应查看。
- 右侧：完整展开的研发说明，彩框／编号／正文双向定位；单次选位置、原位编辑。

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

浏览器暂存不等于文件保存。用户可手动保存可编辑副本、导出 PRD 或只读 HTML；未处理说明草稿、失效位置和内容冲突会阻止交付导出。可编辑副本仍可保存，带上草稿与冲突内容。

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
