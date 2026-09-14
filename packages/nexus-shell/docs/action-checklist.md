# NexusAI Shell 动作清单（验收标准）

以 TV 日常用户动作逐条列出壳应支持的行为；实现与验收逐条打勾。
状态取值：`未做` / `通过` / `部分`（附原因）/ `放弃`（附原因）。

## 批1 — 绘图工作流闭环

| # | 动作 | 状态 | 备注 |
|---|------|------|------|
| B1-01 | 光标工具：点选图元、拖拽整体移动、拖拽锚点单点移动 | 通过 | 探针断言锚点价格随拖拽变化；锚点级单点拖拽引擎原生 |
| B1-02 | 画趋势线（两次点击），画完自动回光标并保持选中 | 通过 | 探针 |
| B1-03 | 画水平线/垂直线（单击即成） | 通过 | 探针 |
| B1-04 | 画射线/矩形/箭头/通道（2-3 锚点） | 部分 | 探针覆盖平行通道（3 锚点）与水平/垂直类；射线/矩形/箭头同路径未逐一断言 |
| B1-05 | 画斐波那契回撤 | 通过 | 探针 |
| B1-06 | 选中即浮出属性条：改色/线宽/线型 | 通过 | 探针（改色断言；线宽/线型同 updateBatch 路径） |
| B1-07 | 属性条：填充色+透明度（通道/矩形类） | 部分 | fillOpacity 探针通过；**填充色不可独立设置**——引擎默认样式无 fill 键且 updateBatch 交集守卫拒新增（G-08） |
| B1-08 | 属性条：删除按钮 | 通过 | 与 B1-13 同路径 |
| B1-09 | 属性条：锁定切换（写 locked 字段） | 通过 | 探针；引擎不强制 locked（G-04） |
| B1-10 | Ctrl 点选多选 → 浮条显示"已选 N" → 批量改样式/删除 | 通过 | 探针 |
| B1-11 | Shift 点选多选（等价 Ctrl 语义） | 通过 | 探针；壳层事件归一化实现 |
| B1-12 | 框选工具：拖框批量选中 | 通过 | 引擎 box-select 原生；随 B1-10 语义由引擎测试覆盖，探针未单列 |
| B1-13 | Delete/Backspace 删除选中 | 通过 | 探针 |
| B1-14 | Esc：绘制中取消锚点；否则清空选中 | 通过 | 探针 |
| B1-15 | Shift 按住画线锁 45° 角 | 部分 | 壳层坐标约束已实现（预览+落点同路径）；角度数值断言难做，未探针覆盖 |
| B1-16 | Ctrl/Cmd 拖拽图元=复制后拖副本 | 通过 | 探针（原位重建副本式）；Ctrl+点击已选图元不再触发"取消选中"，与 TV 有细微差异 |
| B1-17 | 磁吸三态 off/weak/strong 循环切换按钮 | 通过 | 探针（含持久化） |
| B1-18 | 磁吸 weak/strong 下锚点吸附 OHLC；Ctrl 临时强吸 | 通过 | 探针断言锚点收敛到 bar.high；Ctrl 临时强吸走同一 applyMagnet 分支 |
| B1-19 | stay-in-drawing-mode 开关：画完保持工具 | 通过 | 探针 |
| B1-20 | 工具收藏星标：flyout 内星标 → 收藏区置顶显示 | 通过 | 探针（localStorage）；收藏区渲染随状态 |
| B1-21 | 分组 flyout：线条/通道/形状注释，组按钮显示上次使用工具 | 通过 | 探针（flyout 展开渲染）；组记忆持久化于 prefs.groupLastTool |
| B1-22 | 测量工具：拖拽显示价格差/百分比/K 线数 | 通过 | 探针 |
| B1-23 | 橡皮擦：点击图元直接删除 | 通过 | 探针 |
| B1-24 | 模板：选中图元 → 保存为模板（命名对话框） | 通过 | 探针 |
| B1-25 | 模板：浮条下拉套用到选中 | 部分 | 保存/套用共用 applyTemplateToSelection 路径（探针经自动套用断言）；浮条下拉 UI 未单列探针 |
| B1-26 | 模板：下次绘制自动套用该类最近模板（可关） | 通过 | 探针 |
| B1-27 | 模板管理：右栏面板列出/应用/重命名/删除 | 通过 | 探针 |
| B1-28 | 左工具条缩放/全屏/指标入口按钮 | 部分 | 缩放探针通过；全屏与指标入口未做（批2/3 范围） |

**批1 验收证据**：`packages/nexus-shell/scripts/probe-drawing.mjs` 39/39 通过（playwright 真实交互断言）；`pnpm --filter nexus-shell typecheck` 绿；截图 `temp/shots/b1-baseline.png`、`temp/shots/b1-probe-final.png`。

**批2 验收证据**：`packages/nexus-shell/scripts/probe-topbar.mjs` 12/12 通过；批1 探针回归 39/39；typecheck 绿；截图 `temp/shots/b2-topbar.png`。

## 批2 — 顶栏与图表本体

| # | 动作 | 状态 | 备注 |
|---|------|------|------|
| B2-01 | 品种搜索器：下拉+关键字过滤+最近使用 | 通过 | probe-topbar.mjs（mock 目录 6 品种；recents 持久化 nexus.shell.recent-symbols） |
| B2-02 | 周期切换：分组下拉 | 通过 | probe-topbar.mjs（分钟/小时/日周月三组；切换重注数据） |
| B2-03 | 图例区：品种/周期/OHLC 行 | 通过 | 壳 DOM 图例栏接管（挂载时关引擎 canvas 图例）；行1 品种·周期·OHLC·量，十字线联动/无十字线显示最新 Bar；probe-topbar + probe-b234 |
| B2-04 | 图例指标行 + 指标眼睛/设置/删除 | 通过 | 主图行（值行按 name↔definitionId 匹配）+ 副图行自建；眼睛=remove+stash 可恢复、设置=catalog 参数内联编辑 updateIndicatorParams、删除=removeIndicator；probe-b234 |
| B2-05 | 十字线数据窗 | 未做 | stretch |
| B2-06 | 图表右键菜单（背景/绘图对象） | 通过 | hitTestAt 命中→样式/锁定/删除；背景→主题/周期/添加指标（二级菜单）；轴菜单 stretch |

## 批3 — 周边面板

| # | 动作 | 状态 | 备注 |
|---|------|------|------|
| B3-01 | Watchlist 右栏：目录列表/点选切品种 | 通过 | mock 目录 6 品种 + 当前高亮；probe-b234 |
| B3-02 | 图表设置对话框：主题/网格/坐标轴 | 部分 | 主题分段切换（持久化 nexus.theme）+ 磁吸/stay/自动套用偏好；网格/坐标轴设置未做 |
| B3-03 | 对象树：图元列表/定位/删/显隐/锁 | 通过 | 行点击定位=选中高亮+浮条（简报所引 scrollToDataIndex 在 core 不存在，滚动定位待引擎补 API）；显隐/锁/删行内操作；probe-b234 |

## 批4 — 键盘与持久化

| # | 动作 | 状态 | 备注 |
|---|------|------|------|
| B4-01 | 字母键呼出品种搜索 | 通过 | 单字母（无修饰键）唤起并带入首字母；输入框聚焦让路；probe-b234 |
| B4-02 | 数字键切周期 | 通过 | 1-9 按周期目录顺序直切；probe-b234 |
| B4-03 | ? 呼出快捷键表 | 通过 | 静态清单浮层，Esc/遮罩关闭；probe-b234 |
| B4-04 | 方向键微调选中图元（nudge） | 通过 | ↑/↓ 按品种 tick（0.2/0.01/0.001）微调价格；probe-b234 |
| B4-05 | nexus.* localStorage 持久化（收藏/模板/最近品种/面板/主题） | 通过 | 面板折叠 nexus.panel + 主题 nexus.theme 补齐；右栏分区带稳定类名 |

## 引擎缺口（历史登记；已关闭项在"壳侧对策"列标注）

| ID | 缺口 | 壳侧对策 |
|----|------|----------|
| G-01 | 引擎无磁吸/吸附实现（简报称"引擎已有磁吸"不属实） | ✅ 已关闭：引擎原生磁吸（fb5392de，档位语义见 docs/design/drawing-interaction-hardening.md）；壳侧已切换 setMagnetMode 并删除 applyMagnet（fork/shell-engine-magnet-migration） |
| G-02 | 无测量工具 | 壳层 overlay 实现 |
| G-03 | 无橡皮擦工具；HitTester 未公开 | ✅ 已关闭：hitTestAt 公开命中查询（fb5392de）；橡皮擦改 hitTestAt 直接删除（fork/shell-engine-magnet-migration） |
| G-04 | `locked` 字段交互层不强制（可继续拖拽） | ✅ 已关闭：locked 三重强制引擎落地（fb5392de） |
| G-05 | 无 FVG 工具且 DrawingKind 为封闭联合 | 记录；FVG 需引擎扩展 |
| G-06 | Shift 点选多选不支持（仅 Ctrl） | ✅ 已关闭：引擎原生 Shift 多选（fb5392de）；壳侧 Shift→Ctrl 归一化已删（fork/shell-engine-magnet-migration） |
| G-07 | getAnchorCountForTool 未从公共出口导出 | ✅ 已关闭：锚点数表自 drawing 模块与 controllers facade 导出（fb5392de） |
| G-08 | 通道/矩形类默认样式无 fill 色键（填充色由 stroke 派生），updateBatch 字段交集守卫拒绝新增 fill 键 | ✅ 已关闭：全通道类选中集 getBatchStyleKeys 无条件含 fill（fb5392de）；浮条填充色控件随之可用 |
| G-09 | nexus/main 根 `pnpm type-check`（vue-tsc）在 packages/vue/src/features/agent/use-agent-workspace.ts 存量报错（agent-contracts 缺 5 个导出 + 2 处隐式 any），与本分支无关 | ✅ 已关闭：root tsconfig.app.json paths 映射 agent-runtime 源码（fb5392de） |
| G-10 | KLineChart.vue 内嵌整套 Vue 工具条（TopToolbar/LeftToolbar/DrawingStyleToolbar/WatchlistPanel），react 包 WC 适配器无 controller 通道——宿主无法经 WC 获得引擎控制权 | nexus-shell 改为直接持有 createChartController（本批架构决策） |
