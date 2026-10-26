# 模板改造地图

`assets/workbench.html` 来自用户确认的三栏工作台。渠道管理与评论审核的两需求四页仅用于展示运行方式，不限定新原型的业务或页数。

模板内的预置说明、需求范围和边界文案也只是机制演示。新建或转换时移除这些示例，只使用用户提供的文字或保留源文件已有说明；没有内容时 `model.notes` 为空数组，右侧显示空状态。不要根据页面代码自动补写规则。仅新建且从未有说明的文件将说明计数从 1 开始；迭代已有工作台继续保留原编号和计数器。

## 模型与页面入口

| 入口 | 作用 | 改成新业务时 |
| --- | --- | --- |
| `#prototype-data` | 内嵌项目元数据与完整初始模型 | `projectTitle`、版本、`model.data`、各页 `views`、`notes` 和 `counters` 同步更新 |
| `navigation`、`pageScope`、`pageIdentity` | 产品、端与页面的稳定映射 | 元数据随文件导出；按下方结构配置，不从旧浏览器状态覆盖、不以名称作状态键 |
| `model.globalContent`、`model.workspaceView`、`#global-menu`、`renderGlobalContent` | 首项全局内容及独立工具视图 | 工作文件直接填写，默认空、自动暂存；只读导出纯文本查看；不塞入 `pages`，不改 `activePage`，回到业务恢复原状态；导出携带正文，只读以文件为准 |
| `model.globalNotes`、`renderGlobalNotes` | 兼容原工作台级文字 | 非空 `prototype`、`notes` 在首项全局内容页中独立显示；旧 `directory` 保留为兼容数据，不渲染、不合并；旧模型缺项补空，导出保留完整模型 |
| `productGroups`、`model.activeProduct`、`model.productGlobalContent`、`renderProductContent` | 产品全局正文和左侧二级菜单 | 产品 ID 为存储键；每个产品先显示全局菜单再列实际页面；不增加中间页面 Tab，保留右侧研发说明 |
| `menus`、`model.menuGlobalContent` | 兼容上版菜单正文 | 旧需求/产品/端组合 ID 不变；非空正文在所属产品全局页按原归属分别显示、编辑和导出，不自动合并 |
| `pickingTarget`、`togglePicking`、`#pick-note` | 显式、单次选位置 | 工作文件一直可用，不设模式切换；一次选择后自动取消，下一次需重新点按钮，Esc 只取消拾取；只读移除入口 |
| `selectableElement`、`selectionRecord`、`resolveElement`、`elementAnchorKnown` | 选择任意可见元素并持久定位 | 使用 [元素选择约定](element-targeting.md)，精确选择点击元素；自动位置与旧手动锚点兼容；校验不得执行业务事件 |
| `elementAvailable`、`noteIsVisible`、`noteEntryAnchor`、`hiddenNoteGroups` | 可见性与真实父级入口映射 | 按场景和记录 ID 归到可见入口；内部数量用 `data-note-entry`，关联 IDs 用 `data-note-children`；无真实父级时不生成标识 |
| `requirements` | 左侧需求名、编号、范围、边界 | 使用真实需求；保留稳定 ID |
| `pages` | 页面名、所属需求、状态标签 | 页面键必须与 `views`、说明的 `page` 一致 |
| `validModel`、`validNotes` | 缓存载荷校验 | 示例 `channels/comments/words/categories` 是业务专属，换业务必须更新校验 |
| `filteredRows`、`scene`、`changeScene` | 查询、当前状态、状态切换 | 与实际页面数据和可用状态对应 |
| `renderPrototype`、各 `*HTML` / `bind*` | 中间原型和业务事件 | 替换示例渲染及事件分派；保留外壳、标注、导出机制 |
| `anchorKnown` | 校验说明位置是否仍存在 | 固定锚点与行记录锚点都更新；不可简单改为永远通过 |
| `contextSnapshot`、`locateNote`、`activateNote` | 捕获场景，联动标号与右侧说明 | 当前目标已显示时直接高亮；只有目标未显示才恢复场景。不可覆盖当前输入或执行业务按钮 |
| `highlightVisibleNote`、`highlightRegion` | 当前区域点击联动 | 未选位置时逐层寻找最近的已标注锚点；保持原控件和业务事件，仅更新高亮并滚动右侧说明 |
| `shell`、`renderDirectory`、`renderSidebar`、`#current-context` | 三栏外壳、归属提示和说明区 | 左侧产品为一级，全局说明与页面为二级，页面注明需求与端；中间固定显示当前归属，右侧同步；需求/页面数量由配置计算 |
| `editorHTML`、`refreshNoteInPlace`、`saveNote` | 新增说明与已有说明原位编辑 | 新增用 `#editor-slot`；已有说明的唯一 `#note-form` 在该条 `#note-ID` 内替换正文，输入框位于定位区域之外。保存/取消保留该条位置与中间业务 DOM，不滚到顶端；草稿沿用 `model.drafts[page].noteId` |
| `noteStyle`、`drawAnnotationOverlays`、`paintPins` | 颜色、区域边框和数字角标 | 按稳定说明 ID 配色；使用不占布局、不拦截业务操作的覆盖层；滚动及裁切边界跟随实际目标 |
| `toggleAnnotationFrames`、`#toggle-annotation-frames`、`revealedFrameId` | 右上角显示开关与临时定位框 | 默认开启；关闭先隐藏全部框，定位后仅显示当前选中框；不重建业务 DOM，不修改说明，导出保留开关 |
| `exportReady`、`exportHTML` | 导出前校验与只读文件序列化 | 保留 `readOnly: true`，使用实际当前模型，清空导出草稿 |

模板使用内联原生 JS。它不是仅靠填一个 JSON 就能生成任意业务的低代码系统；Codex 需要按需求改造业务渲染与模型，维护三栏、标注和只读导出约定。

## 布局适配

桌面 `.workspace` 使用同一个 `--workbench-side-width` 定义左右栏，`.stage` 扣除合理边距后占满中间栏，不设固定最大宽度。`sizeCanvasViewport` 用中间栏高度减去标题、工具条、页脚、内外边距和边框，设置预览视口高度；纵向排列时给预览区域分配一屏内的可用高度。不要保留 `max-width:1150px` 或 `max-height:70vh` 等限制。固定宽度设备放在 `.prototype` 内，保持设备中心与中间列中心一致；不要用 `left` 或 `translateX` 的固定偏移补偿不等宽侧栏。

模板以 960px 为纵向排列断点。定制断点时同时检查 `.workspace`、`.directory` 的 `grid-column`、`body/#app` 高度、`.preview-pane` 滚动及 `.sidebar` 边框。旧的 `grid-column:1/-1` 不能残留在新的三栏区间内，否则目录占满首行后，原型会落进原本的目录列。媒体规则要成组修改，避免叠加一条新列宽后留下旧布局状态。

通过 `pages[pageId].canvas = {width: 390, height: 844}` 指定原型设计尺寸（CSS 像素）。数字来自设计稿或已有 HTML；390 × 844 只是 H5 示例。未配置时，模板桌面示例使用 960px 宽、内容自然高度；长网页可只配置 `width`。固定设备必须同时配置宽高，不能按宿主窗口剩余高度改设备尺寸。`applyCanvasLayout` 给 `#prototype` 设置宽高，`#prototype-viewport` 以 `overflow:auto` 提供双向滚动并限制可见高度；`.stage` 不压缩，宽画布从左侧开始，放得下时居中。不要用 `max-width:100%`、flex 收缩、分别计算的 scaleX/scaleY 或窗口高度上限挤压设备。

窗口尺寸只改变外壳和可见区域。模板业务样式使用命名容器 `prototype-canvas` 的 `@container` 查询，让字段、字体及弹窗按画布宽度布局，不随浏览器窄屏规则一起缩小。接入已有 HTML 时将业务媒体规则改为画布容器规则，或保留具有固定设计视口的内联 iframe 并完整接入标注、暂存和导出；禁止只给外层固定宽度而仍让内部 `@media` 跟随宿主窗口。工具条固定提供 100%、98%、87%、76%、65%、50% 和适应窗口；只对中间画布使用统一比例。

`view().canvasZoom` 记录 `"1"`、`"0.98"`、`"0.87"`、`"0.76"`、`"0.65"`、`"0.5"` 或 `"fit"`；旧缓存缺失或值非法时采用 `"fit"`；已经保存的有效比例保持原选择，旧 `"0.75"` 衔接为新的 `"0.76"`，不更换缓存键或清空其他内容。`applyCanvasZoom` 使用画布根元素的 CSS `zoom`，设计 width/height 不变；浏览器按缩放后的尺寸计算外层滚动范围，业务事件继续由真实 DOM 处理。改变比例只更新画布样式、比例控制及标注，不重新渲染业务和说明编辑器。只读导出保留该控制，它属于查看工具。

默认适应窗口取可用宽度／设计宽度、可用高度／设计高度的最小值，不再与 1 取最小值，大屏允许放大超过 100%。可用空间从真实预览视口的 clientWidth/clientHeight 减去内边距计算；自然高度用未缩放的 offsetHeight，不能把已经缩放的窗口矩形当成设计高度。先计算外壳可用高度，再计算统一比例，根据窗口与布局 ResizeObserver 变化重算；用帧调度合并更新，避免缩放与容器高度互相依赖。百分比选项为固定比例，100% / 98% / 87% / 76% / 65% / 50% 在小屏继续滚动，只有适应窗口自动变化。宽高同时放得下且至少一维接近可用边界即可；手机比例不同于中间栏时允许左右留白，不能拉伸设备或只把背景放大却把默认画布固定在 100%。

标注计算先把 `getBoundingClientRect()` 得到的窗口坐标减去画布左上角，再除以当前缩放比例，转换回画布内的 CSS 坐标；框线、角标和裁剪边界统一使用此坐标系。覆盖层随同画布缩放一次。精确拾取继续使用原事件目标，不能用未换算的屏幕坐标定位，不能给框和角标再单独乘一次比例。外层滚动位置随比例调整并按页保存。至少实测 50% 和 76% 下弹窗输入、单次拾取、原位编辑、隐藏框后点击编号及右侧联动。

外层画布滚动与业务内部列表滚动分开。`view().canvasScrollLeft/canvasScrollTop` 按页面保存外层位置；切页、全局正文往返和导出后恢复。外层 scroll 触发标注重绘，元素和覆盖层保持同一坐标系，不通过缩放截图替代交互。旧缓存没有这两个字段时从 0 开始，不能重置原输入、草稿或缓存身份。全局正文页继续使用自己的列滚动，不套设备尺寸。

实际浏览器至少检查 2560 × 1600、1440 × 900、1366 × 600、960px 断点两侧、390 × 844 和 320 × 568。读取设备与画布的 `getBoundingClientRect()`，确认默认适配可在大屏超过 100%，预览区宽高跟随可用空间，画布宽高使用同一比例。切换 100% 后确认设计宽高和字体在各窗口下不变；放得下时桌面画布水平中心与视口中心相差不超过 1px，放不下时能横纵滚动到四边。检查目录／原型／说明顺序、底部按钮、内部列表、弹窗输入及滚动后的标号和右侧联动。`verify_canvas.cjs` 只验证状态及导出，CSS 文本或 jsdom 不能证明真实几何；临时改变视口后恢复默认尺寸。

## 产品、端与页面归属

左侧固定首项为「全局内容」，其后按产品组织二级菜单。需求和端是页面归属信息，不再为同一产品重复建立多个一级组。页面原有的弹窗、空结果等状态仍在中间的业务状态工具中，不是目录页面。

```text
全局内容
A 产品
  本产品全局说明
  渠道列表        CMS · 渠道标签调整
  标签配置        CMS · 渠道标签调整
  首页            前台 · 首页调整
B 产品
  本产品全局说明
  渠道列表        CMS · 渠道标签调整
```

这是结构示例，不是默认加入用户文件的产品或需求。“首页”是页面名；端名沿用用户提供的 App、H5、Web、CMS 或前台等称呼，不能自行推断。左侧产品与页面默认展开，不增加中间页面 Tab、第四栏或右侧页签。

`#prototype-data` 中的 `navigation` 与 `model` 并列：

```json
{
  "products": {"a": {"name": "A 产品"}, "b": {"name": "B 产品"}},
  "platforms": {"cms": {"name": "CMS"}, "front": {"name": "前台"}},
  "pageScopes": {
    "a-cms-channels": {"product": "a", "platform": "cms"},
    "b-cms-channels": {"product": "b", "platform": "cms"},
    "a-front-home": {"product": "a", "platform": "front"}
  }
}
```

这些 page ID 还需与 `pages`、`views`、说明的 `page` 和业务适配入口一致；它们是新文件的示例，不用于强制重命名已有 ID。已有单产品工作台只补 `pageScopes`，维持原 `artifactId`、快照键、页面 ID 和说明编号。同一产品与端在多个需求出现时复用其身份；各需求页面实例仍用唯一 page ID，避免草稿串页。

- `pageScope(id)` 从稳定 ID 取得显示名，`productGroups` 按产品 ID 汇集各需求与端的页面，`renderDirectory` 在左侧渲染一级产品组和二级全局/页面按钮。同名页面可以并存，不能用显示名作为存储键。
- 中间 `#current-context` 展示产品、端及需求/页面路径，并在原型滚动时保持可见；右侧 `#scope-name` 同步归属。分组名和页面名都必须可读，长名称换行，键盘导航名称包含完整归属。
- 标注继续只要求用户填写一句正文。产品和端由页面映射推导，不复制进每条说明再分别维护；改显示名不能让旧说明失去关联。
- 页面输入、草稿、滚动按稳定 page ID 保存。**映射只描述归属，不会自动隔离任意原 HTML 的业务数据**；合并不同产品时检查全局变量、数据模型和缓存键，不因“都叫 CMS”而复用状态。仅保留原业务已确认的数据联动。
- 工作台全局文字仍属于整个工作台；产品全局正文只属于对应产品。不要因切换而清空、覆盖或静默改变旧正文的适用范围。
- `navigation` 属于文件配置，不从缓存模型恢复；导出完整序列化。旧文件没有映射时仍可打开，临时以项目名分组并显示「端未标明」，不丢原状态；下一次明确归属后补映射。

## 紧凑顶部和查看时标注

`.preview-header` 将产品、端、标题与需求路径左右排列，沿用固定归属条的 sticky 行为。页面入口全部放回左侧，不渲染 `#page-tabs`。`.preview-toolbar` 将业务状态 `#scene-tabs` 与定位、拾取、重置工具放在一行，空间不足时换行。不在标题和右侧重复放全局正文输入框，不增加重复路径或常驻教学。

`#pick-note` 在工作文件的业务视图始终可见；只保留「查看原型」状态标识，不保留 `mode` / `setMode` 及查看/写说明切换。`pickingTarget` 是一次性拾取开关，成功选择、再次点按钮或 Esc 后关闭。`editorHTML` 仅在已经选中位置或恢复草稿时显示；已有说明的编辑、删除和重新定位直接在原条目提供，编辑草稿原位恢复。`saveNote` 对新说明和原位编辑都只刷新说明、目录与编号，不重建业务 DOM。

`growEditors` 只调整标记为 `data-auto-grow` 的工具文本框。每次输入、恢复及窗口宽度变化，按真实 `scrollHeight` 和边框计算高度，保留最小高度，不设置最大高度和内部滚动。新建/原位编辑默认至少 200px，工作台和产品全局正文默认至少 420px。长正文跟随中间整列滚动，不以高大的 sticky 输入块挡住原型；已有业务输入控件不自动改大小。

## 产品一级与页面二级菜单

`productGroups` 由每页的 `productId` 汇总，跨端或跨需求的同一产品只建立一组。`model.productGlobalContent[productId]` 保存该产品的纯文本，默认空；`productGlobalScroll[productId]` 保存正文滚动。`activeProduct` 保存当前全局正文所属产品，`workspaceView` 为 `product` 时展示它；`activePage` 仍保存真实业务页，进入产品正文不把文档 ID 塞进业务状态。改显示名不改产品 ID。

`#directory-items` 的首项 `#global-menu` 是整个工作台共用正文。其后 `.product-group` 的 `.product-children` 中，第一个按钮 `[data-product-global]` 是「本产品全局说明」，随后是该产品所有 `[data-page]` 页面。子项标明端及需求，支持普通键盘 Tab/Enter/空格，切换后保留导航焦点并更新 `aria-current`。中间不再用页面 Tab；原业务状态 `#scene-tabs` 保留。

`switchProduct` 进入 `#product-global-panel`，工作文件显示 `#product-global-input`，输入自动暂存、完整增高；只读显示 `#product-global-text`。它不占业务页数或说明编号，不显示选位置或业务状态工具。右侧继续使用「研发说明」标题和原三栏样式，正文页只提示当前适用范围；进入业务页恢复原编号说明列表、定位和工作页编辑功能。

切换前分别保存业务、工作台全局和产品正文的滚动。页面 UI、草稿和说明仍按原 page ID 保存；跨产品说明不能串页。同一产品正文跨其端与需求共用，具体业务数据和页面状态仍沿用原隔离规则。

只读启动用文件内 `productGlobalContent` 覆盖查看缓存中的正文。旧缓存缺字段时补空；旧 `workspaceView: menu` 映射到原业务页所属产品的全局页。旧 `menuGlobalContent` 不合并到新的产品正文、不删除，非空条目在所属产品正文下方按「原需求 · 原端」分别显示，使用原键继续保存并导出。旧的 `menus` 元数据只用于兼容这些已有内容，不作为新导航入口。

## 首项全局内容

`model.globalContent` 保存一份由用户填写的完整正文，默认 `""`。`model.workspaceView` 取 `global`、`product` 或 `prototype`，只描述工作台视图，`activePage` 始终保存真实业务页面 ID；旧缓存缺字段时补空正文和 `prototype`，不重置已有数据。`#global-menu` 放在所有需求之前，进入后中间 `#global-content-panel` 展示正文，右侧只显示全局适用范围；隐藏页面状态、选位置和编号工具，不为这份正文生成编号。`globalNotes.prototype` 和 `globalNotes.notes` 独立保留，非空时在此正文下方显示带原归属的已有内容，直接填写并继续完整导出，不复制到各产品；左侧标题下不再渲染 `directory` 文本框，该旧字段作为兼容数据保留。

工作文件直接显示 `#global-content-input`，输入即暂存；只有 `readOnly` 导出文件显示完整可复制的 `#global-content-text`。切入全局前保存业务视图进度，切回原页恢复输入、弹窗、说明草稿和滚动位置。全局内容连同视图状态写入导出载荷；只读启动从文件恢复正文，不能让查看者旧缓存覆盖。导出时仍检查所有业务页的未保存说明草稿。

## 说明和位置

```json
{
  "id": 23,
  "requirement": "orders",
  "page": "order-list",
  "scene": "form",
  "anchor": "order-name",
  "location": "订单表单 / 订单名称",
  "context": null,
  "body": "用户提供的说明正文"
}
```

正文是唯一用户输入的说明字段。`location` 等是根据点选位置自动记录的元数据，不增加用户填写表单。原有 `data-anchor` 与 `data-location` 继续有效；没有这些属性的元素也必须可选择，由 `selectionRecord` 自动生成位置描述。表格行的锚点含稳定记录 ID，不能含可变行序号或标签正文。详细机制见 [element-targeting.md](element-targeting.md)。

中间标号和右侧 `.note-link` 都使用 `data-note-locate="说明ID"`，通过同一个定位入口联动原型 `.selected-target`、说明 `.note-selected` 和定位菜单。标号使用可聚焦控件；右侧文字用键盘可达的定位区域，编辑／删除控件放在区域之外。查看与导出只读时均支持定位；工作文件直接提供单次新建说明和原条目编辑管理。只读导出禁止说明写入。当前场景直接更新高亮类，避免重建业务 DOM 或右侧正文破坏表单输入和文字选择。

已有说明点击「编辑」后，正文原地变为一个多行输入框和保存/取消按钮；不同时显示顶部编辑器。编号保留定位能力，但不能用 `.note-link` 包住表单。`refreshNoteInPlace` 按原说明的可视位置补偿右侧滚动，只刷新说明、目录计数和定位选项，不调用 `renderPrototype`。保存保持原 ID、顺序、场景与锚点；取消恢复已保存正文，跨页及重开后的编辑草稿也在原条目恢复。

区域边框使用 `[data-note-frame="说明ID"]`，中间角标、边框和右侧说明使用相同的 `--note-color`。颜色由稳定 ID 决定，不按当前列表索引或有限调色板取模循环；重复定位同一个区域的不同说明保留各自编号和颜色。新增说明不改变已有说明颜色。边框使用独立覆盖层而不改业务控件边框；覆盖层整体 `pointer-events: none`，数字角标和四条狭窄框线热区 `[data-note-frame-hit="说明ID"]` 接收点击。框线通过 `activateNote` 定位并阻止误触底下业务；内部点击由业务 DOM 的捕获监听同步高亮，不取消默认行为、不阻止业务监听器、不重建表单。

顶部开关使用 `role="switch"` 和 `aria-checked`，隐藏类为 `#prototype.annotation-frames-hidden`。关闭时清空 `revealedFrameId` 并隐藏全部框和框线热区；框内被动联动也关闭。点击数字、右侧说明或定位菜单后，将 `revealedFrameId` 设为对应说明 ID，仅 `.annotation-frame.focused.peek` 恢复显示，其他框和热区继续隐藏，开关保持关闭。临时显示的框线仍可点击；切换说明替换临时框，切换全局开关清空临时框。当前场景定位不得重建业务 DOM；跨场景定位成功后同样记录该 ID。临时定位状态不保存到模型、缓存或导出载荷。

父级入口的数字标识复用覆盖层：实心数字是原说明编号，空心数字是内部说明数量。`noteEntryAnchor` 返回当前可见的直接入口锚点；先打开弹窗后，更深的说明转到内部选择器入口。数量动态计算，不写入说明数组，不占用编号；点击通过 `activateNote` 定位该组首条说明，原业务按钮保持可点击。

## 项目身份与缓存

初始化脚本为新原型生成新的 `artifactId`、工作快照 ID、时间和项目名，工作网页 `readOnly` 为 false。不要重复初始化已有原型来修改内容，以免看不到原浏览器草稿。

查看文件的 `snapshotId` 每次导出重新生成，`projectTitle` 和完整模型随文件保存。作者和查看者使用不同缓存命名空间。文件本身包含说明及全局文字，localStorage 不承担交付职责。查看文件以文件内文字为准，不能用旧查看缓存覆盖全局文字。

原示例兼容 v0.1/v0.2 缓存的分支是历史适配代码；新业务可以保留不触发的分支，或在确认不需要这些迁移时去掉。不能将别的项目缓存迁入新原型。

## 验证脚本范围

遵循 SKILL.md 的默认交付方式：保留手动导出按钮，但任务完成时不主动下载或附送只读预览。验证脚本默认不传 `--output`，在隔离环境捕获导出结果、拦截下载；只有确需浏览器验收时才写临时验证文件，不写用户下载目录、不作为成品交付。

`verify_export.cjs` 对当前外壳接口验证：`#prototype-data`、`[data-page]`、`#prototype`、`[data-anchor]`、`[data-note-locate]`、`[data-note-frame]`、`#toggle-annotation-frames`、`.note-link`、`#note-form`、`#note-body`、`#export-html`、`#locate-note`、`#readonly-badge`、`[data-product-global]`、`#product-global-input`、`[data-global-slot]`、`[data-global-note]`、`#pick-note`、`[data-note-entry]`、`[data-note-children]`。有 `navigation` 时校验导出映射一致。保留这些接口便于复用检查。标号、边框和说明都必须绑定稳定说明 ID，不靠文字匹配。

`verify_scopes.cjs` 专门验证模板的多产品多端外壳，以隔离副本构造 A/B 产品同名页面和相同锚点，验证草稿、输入、说明、旧缓存及导出。`--output` 可保存验证副本供浏览器检查；其中保留了模板的演示业务，不是新产品需求，不作为用户业务原型交付。

`verify_global_menu.cjs` 验证首项全局菜单、直接填写独立正文、切回未保存业务表单与说明草稿、旧缓存以及实际只读导出；可用 `--output` 保存含验证文字的导出副本。页面数量不包括全局工具页，说明编号和已有全局字段不得受影响。

业务记录结构变化时，脚本仍验证导出的数据与工作模型一致，但不会自动知道业务规则是否正确。实际新增/保存/筛选/错误状态等，需要对该需求单独检查。必要时在浏览器为新增记录写一条说明、导出重开并定位，确认动态锚点有效。

`verify_view_authoring.cjs` 验证查看模式单次拾取、普通操作恢复、重新开启、Esc、全局直接填写和只读导出；所有导出仅在内存检查。真实浏览器检查 `.preview-header` 两侧位置、工具同排或正常换行，不能用 CSS 字符串断言替代视觉检查。

`verify_product_menu.cjs` 验证产品一级与页面二级菜单、中间无页面 Tab、产品正文隔离、同产品跨端共用、原右侧说明、页面草稿/滚动、旧菜单正文兼容、产品改名和实际只读导出。
