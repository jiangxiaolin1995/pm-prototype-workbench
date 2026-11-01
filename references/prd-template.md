# PRD 纯文字需求说明

新建、升级或转换工作台时阅读。本约定只定义文档工具，不授权补写业务规则。

## 左侧结构

```text
需求说明
  全局描述
  上线后数据需求
  埋点说明
产品名称
  本产品全局说明
  业务页面…
```

三个需求入口属于整个工作台，不按产品或需求复制。正文中由用户自行注明适用的产品、端与页面。产品目录及原型页面继续保留，右侧仍是研发说明；文档页只提示适用范围，业务页显示原编号说明。文档不占业务页数和说明编号，不修改业务路由或页面 ID。

## 只填文字

- **全局描述**：填写需求背景、目标、范围及共用描述，具体内容由用户决定。
- **上线后数据需求**：填写上线后希望观察的数据、统计范围和观察时间。不是上线排期，不代写指标口径、目标值或发布计划。
- **埋点说明**：有埋点时填写事件、触发时机等已确认文字；没有可以留空。入口默认存在，不增加开关或必填校验。

每页默认直接显示一个大文本框，至少 420px，输入自动暂存，粘贴长文、重开、改变宽度后完整增高。只显示纯文本并保留换行；格式符号和 HTML 标签按原文显示，不渲染 Markdown、表格或图片。没有标题/列表/表格工具，没有附件上传、章节增删、预览确认、版本或负责人表单。

新正文一律为空，全局描述不设置 placeholder 或默认正文。其他提示放在 placeholder；不从页面代码生成业务规则、数据要求或埋点。用户明确要求代写时才在指定范围内写。页面右侧依旧一个正文框，通过「选位置写说明」选择可见业务 HTML 元素，见 [元素选择约定](element-targeting.md)。

## 模型与迁移

- `model.globalContent`：全局描述，沿用原字段和缓存。
- `model.dataRequirements`：上线后数据需求，默认空字符串。
- `model.trackingContent`：埋点说明，默认空字符串。
- `model.workspaceView`：`global` / `data` / `tracking` / `product` / `prototype`。`activePage` 始终是原业务页，不混入文档 ID。
- `model.requirementTextScroll` 保存 data、tracking 正文滚动；全局描述沿用 globalScroll。

`normalizeRequirementTexts` 只补缺字段；全局描述只取用户原有的 `globalContent`，不能自动汇总旧 PRD 或填入示例。旧 `prdDocuments` 的正文、章节和附件保留在原模型内，不自动塞进全局描述。原 tracking 沿用一次性迁移进入埋点说明；旧上线安排不转成数据需求。

`plainDocumentsMigrated` 标记旧迁移；`globalDescriptionUserOnly` 标记全局描述已改为仅保留用户内容。升级时若已迁移正文仍与旧自动拼接片段完全一致，移出这一片段，原值存入 `globalDescriptionMigrationArchive`；前面已有的用户文字保留，片段被编辑过则不清除。只处理一次，之后新输入的文字正常保存，不能每次打开都清空。可编辑副本与只读载荷继续携带原始内容和归档数据。

旧 `workspaceView: requirement` 进入全局描述。旧产品正文、globalNotes、菜单文字、说明与草稿、业务状态和缓存身份均保留。

主要入口：`requirementTexts`、`normalizeRequirementTexts`、`renderRequirementDirectory`、`renderRequirementContent`、`switchRequirementDocument`。`#global-menu` 继续指向 `#global-content-panel`；两个新增入口用 `[data-prd-document]`，正文复用 `#requirement-panel`。切换时保留业务表单、弹窗、说明草稿和各页滚动。只读启动以文件正文为准，不能让查看缓存覆盖。

## 手动保存与导出

- **保存可编辑副本**：保存三份文字、产品正文、说明及草稿和业务状态，readOnly 为 false；新的快照键隔离副本缓存，不因未保存草稿阻止备份。
- **导出只读 HTML**：沿用说明草稿和失效位置校验。正文仅可查看复制，不能修改；业务原型继续可交互、缩放和定位。原工作文件继续可编辑。
- **导出 PRD**：输出 Markdown 文件，包含全局描述、上线后数据需求、埋点说明、产品正文及页面编号说明；编辑界面仍只收文字。

所有下载都由用户手动触发。默认只交付可编辑工作 HTML，不主动导出、下载或附送只读成品。

## 验证

运行 `node scripts/verify_prd.cjs --jsdom /已安装路径/node_modules/jsdom`，检查三个固定入口、纯文本与转义、独立保存、不自动填入旧章节、旧自动填入内容清理及用户正文保留、原上线安排不误分为数据需求、原始附件保留、表单/草稿恢复，以及实际工作副本、只读和 PRD 导出。下载在内存拦截。

再运行受影响的产品目录、元素选择、原位编辑和导出回归。真实浏览器检查大文本框、长文完整展开、窄屏、菜单切换、弹窗内元素选择与后续原交互、只读文字和业务交互。验证后提供工作 HTML 链接。
