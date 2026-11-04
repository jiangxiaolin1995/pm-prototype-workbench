# 模板与业务接入

行为要求见 [工作台约定](workbench-contract.md)，本文说明维护源与代码接入。旧工作文件可能仍使用内联业务函数，迭代时读其实际实现，不批量换成新模板。

## 维护源与组装

- `assets/workbench.html`：可直接打开的干净工作台，一个空页面，缺失正文与说明为空。
- `scripts/workbench_source.py`：把项目配置、业务 JS 和 CSS 内联成同一个 HTML。
- `examples/channel-review/`、`examples/h5/`：分别维护 `project.json`、`business.js`、`business.css`；不进入默认初始化。
- `scripts/build_example.py`：用当前模板生成示例；回归通过 `fixture.cjs` 实时组装。
- `examples/h5-workbench.html`：由这些源生成的便携示例，禁止单独手改。模板变更后重新生成。

新建：

```sh
python3 <skill-dir>/scripts/init_prototype.py --title "项目" --product "产品" --platform "H5" --output "/项目/output/prototypes/项目.html"
```

带入已实现的业务：

```sh
python3 <skill-dir>/scripts/init_prototype.py --title "项目" --config "/项目/project.json" --adapter "/项目/business.js" --style "/项目/business.css" --output "/项目/output/prototypes/项目.html"
```

初始化拒绝覆盖已有文件。配置中明确提供的正文、说明与草稿保留；最终 HTML 不依赖这些维护文件。只是创建骨架时，仍需实现本次需求才可交付。

## 文件配置

`#prototype-data` 包含文件配置与可暂存模型：

| 字段 | 内容 |
| --- | --- |
| requirements | `{id,name,code,scope,boundary}` 数组，范围文字只用已确认内容 |
| pages | 稳定 page ID → `{req,name,intro,states,canvas?}`；states 是场景 ID → 名称 |
| navigation | products、platforms、pageScopes；归属来自文件，不从旧缓存替换 |
| model.data | 可序列化业务数据，由适配器校验，无渠道／审核字段要求 |
| model.views | 每页输入、筛选、展开等状态；工具滚动和 canvasZoom 也按页保存 |
| model.notes / drafts / counters.note | 说明的 ID、页面、需求、场景、锚点、上下文、正文；草稿按页面保存 |
| model.globalContent / dataRequirements / trackingContent | 三份纯文字，见 [PRD 模型](prd-template.md) |
| model.productGlobalContent | 按稳定产品 ID 存储文字 |
| model.workspaceView / activePage | 文档视图与业务页分开，进入正文保留业务页 |

页面 ID 全局唯一，与 views、pageScopes、说明的 page 对应。同产品跨需求、跨端复用产品 ID；同名页面仍用不同 ID。页面映射不会自动隔离任意原 HTML 的全局变量，业务数据联动按已确认规则处理。未知端标为未标明，不从“首页”猜测 App/H5。

## 业务适配器

在 `BUSINESS_ADAPTER_START/END` 插槽中定义 `const business`。适配器位于工作台闭包内，可使用 `seed`、`model`、`data()`、`view()`、`page()`、`$`、`$$`、`esc`、`clone`、`anchor`、`icon`、`persist()`、`renderAll()`、`toast()`；不接管目录、说明编辑器或导出。

| 方法 | 接入约定 |
| --- | --- |
| render() | 依模型返回 HTML，必须纯渲染，不发请求、不改数据、不触发事件；位置校验会离线调用 |
| bind() | 可选，渲染后绑定原交互。输入写入 data/views 并 persist，需要业务重绘时才 renderAll |
| scene() | 返回当前页 states 中的场景 ID |
| root(scope=document) | 在给定 Document/DocumentFragment 中返回当前可见业务根；打开弹窗时返回弹窗 |
| changeScene(id) | 变必要场景状态，外壳负责保存与重绘；保留当前表单 |
| context() | 返回定位所需的可序列化上下文，不返回 DOM／事件对象 |
| reveal(note) | 未显示目标时恢复必要上下文，不提交业务；已可见时外壳不会调用 |
| validate(model) | 可选，只校验自己的 data/views；外壳校验通用状态和说明结构 |
| entry(note) | 可选，返回能打开该目标的真实入口锚点，用于内部说明数量 |
| known(note) | 可选，校验手工锚点和稳定记录；自动元素描述仍通过纯渲染快照定位 |
| reset() / escape() / sceneLabel(id) | 可选，处理业务的重置、弹窗退出、状态名称 |

默认适配器返回空 `#list-pane`，可用 `pages[id].html` 放静态业务内容；动态业务实现自己的 render/bind。参考 H5 适配器的输入、收藏、详情，但不把示例规则当成新需求。

外壳给当前根加 `wb-business-root`，只在拾取时使装饰子元素参与命中。稳定记录和复杂根见 [元素选择](element-targeting.md)。iframe/Shadow DOM 需逐个接事件与路径，不能只换 root 就宣称内部全部可选。

## 通用代码入口

| 入口 | 责任 |
| --- | --- |
| renderDirectory / pageScope / pageIdentity | 目录与中、右侧一致归属 |
| renderGlobalContent / renderProductContent / renderRequirementContent | 纯文字正文 |
| switchPage / stashPosition | 页面、草稿与滚动恢复 |
| togglePicking / selectionRecord / resolveElement | 单次拾取和稳定元素路径 |
| renderSidebar / refreshNoteInPlace / saveNote | 原位编辑，不重建业务 DOM |
| drawAnnotationOverlays / highlightRegion / locateNote | 彩框、编号、说明双向定位 |
| installResponsiveWorkspace / syncWorkspacePanels / openWorkspaceNotes | 工作台断点、目录／说明侧栏与编辑联动，不重建业务 |
| probeAnchor | 在模型副本、离线 DOM 中检验位置，恢复原模型引用 |
| reconcile / renderCacheReview / persist | [文件与暂存合并](storage.md) |
| writeHTMLSnapshot / exportReady / exportMarkdown | 原始外壳加当前模型，真实导出 |
| installHTMLPersistence / connectHTMLFile / flushHTMLSave | 授权后写入原工作 HTML、读回确认、失败与外部修改保护；不更换文件身份 |

## 布局适配

`assets/workbench.html` 内的 `#workspace-style` 和 `WORKSPACE_LAYOUT_START/END` 维护整体布局；初始化、示例组装和只读导出共用这套代码，无需额外资源。桌面左右栏同用 `--workbench-side-width`，`.workspace` 占满窗口剩余高度，`.stage` 填满中间可用宽高，各栏独立滚动，不用 max-width、70vh 或固定偏移挤压业务区。

断点按工作台窗口宽度计算：≥1280px 默认三栏；900–1279px 默认收起目录、保留说明；<900px 默认收起两侧，目录和说明以互斥侧栏展开。顶部「目录」「说明」随时可开关，<1200px 把保存／导出和边框开关放入「更多」。这些是工具层布局，不改变业务画布设计尺寸，也不把三栏上下堆成长页。

侧栏切换和 resize 只调整布局、重算内部缩放及文字框高度，不调用业务 render/bind 或 renderAll。选中元素后展开说明编辑区，重新定位先收起覆盖原型的侧栏；小屏点击说明定位时先关闭覆盖层再判断业务目标可见性，避免把仅被工具层 inert 的目标误判为需要恢复业务场景。点击业务区已有编号时展开对应说明。普通业务点击只做原有被动高亮，不主动打开遮挡面板。侧栏支持关闭、遮罩和 Escape，Tab 焦点在展开侧栏中循环；切换目录项后收起目录，内容与草稿保留。只读文件保留查看面板能力，移除填写入口。

`pages[id].canvas={width,height?}` 是设计尺寸，来自原稿／HTML；390×844 只是 H5 示例。未配置时为 960px 自然高度。`sizeCanvasViewport` 先定外层可用高度，`applyCanvasZoom` 只给内部画布设置等比 CSS zoom。自适应取宽、高比例的最小值，可超过 1；固定比例不随窗口变化，空间不足由外层双向滚动。缩放不重建 DOM，不缩放外层工具和正文。

自然高度必须在同一次同步布局中先按 100% 测量，再应用最终比例；不能用上一次缩放后的 offsetHeight 继续反馈计算。CSS zoom 会改变文字与边框的像素舍入，可能造成比例来回跳。尺寸修正仅在本次布局内有限次缩小，绘制前完成；页面静止后应稳定，真实内容增高或窗口变化仍重新适配。不要以断开所有尺寸监听或反复重建原型解决闪动。

业务响应式按画布宽度工作，使用 `prototype-canvas` 容器查询或完整接入的设计视口 iframe，不随外壳窄屏规则压扁手机内容。旧 98/87/76/75/65% 分别衔接 100/90/80/80/70%；有效选择继续保留。内部列表与外层画布分别滚动。

标注窗口矩形减去画布原点后除以比例，转回设计坐标；框和角标随画布只缩放一次。尺寸、边界、居中和定位检查见 [验证](verification.md)，几何桩不能替代真实浏览器。

## 本地编辑入口

`prepare_workbench.py` 在实际 HTML 旁生成绑定入口，不改正文；`serve_workbench.py` 为单个文件提供本机保存。HTML 的 `localSaveConfig / beginHTMLSave / flushHTMLSave` 分别识别绑定配置、解释直接打开时的授权、提交保存。`writeHTMLSnapshot` 移除注入的 `workbench-local-save`，保证只读交付独立。

初始化与示例构建输出的 `editEntry` 是默认给用户打开的编辑入口；`file` 仅标识已绑定的工作 HTML。禁止用裸 HTML 链接代替自动保存入口，禁止增加手动选文件授权入口。
