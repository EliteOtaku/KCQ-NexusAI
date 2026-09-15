# Current Work Log

## 2026-09-13

- Objective: nexus-shell 仿 TV 壳批次实施（批1→4 顺序，过门推进）
- Changed files:
  - `packages/nexus-shell/src/**`：ChartStage 重写为直接持有 controller；新增 shell/{NexusShellContext,pointerBridge,drawingTools,drawingTemplates,mockData,storage,reactivity,icons}；组件 TopBar/DrawingToolbar/DrawingStyleFlybar/SymbolPicker/TemplatePanel/IndicatorPanel
  - `packages/nexus-shell/scripts/probe-{drawing,topbar}.mjs`、`scripts/shot.mjs`：验收探针与截图工具
  - `packages/nexus-shell/docs/action-checklist.md`：动作清单 + 引擎缺口 G-01..G-10
- Result: 批1 PASS（c4ad20a6）、批2 PARTIAL（0177e654）均已 merge nexus/main + push origin；批3/批4 SKIPPED
- Remaining risks: 见 risks.md（G-09 阻塞 type-check；G-08 渲染回归待查证；handoff 文件未跟踪）

## 2026-09-13（第二会话）

- Objective: 引擎下沉方案准备 + handoff 机制建立
- Changed files:
  - 新建 `AGENT_HANDOFF.md`、`.agent-handoff/{snapshot,workspace,decisions,backlog,risks,validation,work-log,archive}.md`、`AGENT_SESSION_PROMPTS.md`（全部未跟踪）
- Result: 闲时任务提示词就绪（引擎侧绘图交互硬化，pr/engine-drawing-hardening）；捆带范围决策 D8
- Remaining risks: handoff 文件未提交，worktree 内不可见

## 2026-09-13（第三会话·引擎硬化）

- Objective: 引擎侧绘图交互硬化（pr/engine-drawing-hardening，worktree 实施）
- Changed files:
  - 新增 `packages/core/src/engine/drawing/magnetSnapper.ts` + 单测；`coordinateUtils.ts`（resolveDrawingPointer 可选磁吸参数）；`interaction.ts`（setMagnetMode/hitTestAt/getHitCandidates/locked 过滤/Shift 多选）；`DrawingDocument.ts`（getBatchStyleKeys 通道类 fill 放行）；`drawing/index.ts` 与 `controllers/index.ts`（磁吸与锚点数表导出）；root `tsconfig.app.json`（agent-runtime 源码 paths）；`docs/design/drawing-interaction-hardening.md`；新增 5 个测试文件 + 2 个既有测试文件补用例
- Commits: e7be345d(磁吸) 084fdf58(locked) aab3c981(Shift) 59e642a7(导出) bf739633(hitTestAt) 1e044d83(fill) 2708a666(vue 类型链) d9f1f863(设计文档) → no-ff merge fb5392de 已 push origin/nexus/main
- Result: [1]..[7] 全 PASS（G-08 未 BLOCKED：查证渲染端 fill 缺省从 stroke 派生后，改用 getBatchStyleKeys 放行方案，零视觉回归）；验收门 core 2465 绿 / test:packages 全绿 / 探针 39/39 / type-check 337→56（agent 链清零，剩余 56 为基线测试存量债）
- Remaining risks: 见 risks.md（56 存量类型债；handoff 文件未跟踪）

## 2026-09-14（壳迁移·提示词 A）

- Objective: nexus-shell 磁吸与 Shift 点选切换引擎 API，删除壳侧重复实现（fork/shell-engine-magnet-migration，worktree 实施）
- Changed files:
  - `packages/core/src/engine/drawing/interaction.ts`：resolveMagnetOptions 在 e.shiftKey 时返回 undefined（Shift 锁角与磁吸互斥，迁移前置小修）；`__tests__/interaction.magnet.test.ts` 补 2 断言用例；`docs/design/drawing-interaction-hardening.md` 补 Shift 互斥条目
  - `packages/nexus-shell/src/shell/pointerBridge.ts`：删 applyMagnet（约 L303-345 原位）与 MAGNET_RADIUS_* 常量，锁角分支保留为独立 if；删 cursor 模式 Shift→Ctrl 归一化分支及 clonePointerEvent 的 shiftKey 覆写字段；橡皮擦改 dic.hitTestAt(localX, localY) 直接删除；新增 syncMagnet()（读 BridgeStateAccessors.getMagnet 同步 dic.setMagnetMode）
  - `packages/nexus-shell/src/shell/NexusShellContext.tsx`：新增 effect（bridge 挂载与 prefs.magnet 变化时调 bridge.syncMagnet()）；持久化键不变
  - `packages/nexus-shell/docs/action-checklist.md`：缺口表标注 G-01/G-03/G-04/G-06/G-07/G-08/G-09 已关闭，余 G-02/G-05/G-10
- Commits: be61007a([pr] fix core Shift 互斥) dbe83e8b([fork] feat 磁吸接线) fbc87572([fork] refactor 删归一化) 01490c1b([fork] refactor 橡皮擦 hitTestAt) ad8055c5([fork] docs 缺口表) → no-ff merge d974b00e 已 push origin/nexus/main
- Result: [0]..[3] 全 PASS（[3] 的 Flybar 填充色控件无需改动——G-08 已让全通道选中集 getBatchStyleKeys 含 fill，浮条既有 canEdit('fill') 控件随之生效）；验收门 core 2466 绿 / shell typecheck 绿 / 探针 39/39（B1-18 磁吸走引擎、B1-11 Shift 原生多选、B1-23 hitTestAt 橡皮擦）
- 备注: 用户澄清 decisions D58-D61 属 cloudtradeagent 项目、与本仓库无关（原 UNKNOWN 已消）；B1-15 锁角在探针中无断言（仅 checklist 登记），互斥语义由引擎单测覆盖
- Remaining risks: 见 risks.md（56 存量类型债；handoff 文件未跟踪待用户决定）

## 2026-09-14（第二任务·Ctrl 取反 TV 语义对齐）

- Objective: 核查 TV 原生磁吸/修饰键语义并对齐（用户拍板后实施，fork/engine-ctrl-magnet-invert，worktree 实施）
- 查证结论（官方文档）：①TV Shift = 45° 倍数 8 方向角度锁（趋势线/通道），与壳侧 applyAngleLock 一致；②TV 磁吸修饰键是 Ctrl/Command 且为**取反**（off 临时开/开启临时关），非我们旧基准的"强制 strong"；③"Shift 关磁吸"非 TV 官方定义，系壳侧旧实现自身选择，保持
- Changed files: `packages/core/src/engine/drawing/interaction.ts`（resolveMagnetOptions：Ctrl/Meta 取反，off→临时 strong 开、on→临时关；移除未用的 ActiveMagnetMode 导入）；`interaction.magnet.test.ts`（取反三态用例）；`docs/design/drawing-interaction-hardening.md`（修饰键条目改写为 TV 取反语义）
- Commits: 162c7683([pr] fix) → no-ff merge f619e662 已 push origin/nexus/main
- Result: PASS——core 2468 绿（净增 2 用例）、探针 39/39（探针无"绘图工具+Ctrl"场景，零回归符合预期）；壳侧零改动
- 后续登记: 编辑路径磁吸（拖动已有锚点时吸附 OHLC，TV 支持、我们 DragHandler 增量改写不接磁吸）已入 backlog，另立 PR

## 2026-09-14（第三任务·编辑路径磁吸）

- Objective: 拖动已有图元锚点时吸附 OHLC，修饰键语义与绘制路径同源（fork/engine-drag-anchor-magnet，worktree 实施）
- 设计决策: 锚点拖拽本就绝对跟随指针（DragHandler.moveAnchor 直接覆写锚点），磁吸经 handleDragMove 新增第 4 可选参注入 resolveDrawingPointer，仅 anchorIndex 分支生效；整线拖拽是位移增量语义（全体锚点平移），无单一落点基准，不吸附——水平线/垂直线整线拖拽吸附需先定义 delta→snap 语义，登记后续；cursor 命中/框选仍绝不传磁吸（按下命中不得漂移）
- Changed files: `DragHandler.ts`（handleDragMove 可选磁吸参数，anchorIndex 分支限定）；`interaction.ts`（handleDragMove 传 resolveMagnetOptions(e)）；`__tests__/dragHandler.magnet.test.ts`（新增：锚点吸附/无磁吸基线/整线免疫）；`interaction.magnet.test.ts`（adapter 支持注入图元 + 编辑路径磁吸/Shift 互斥用例）；`docs/design/drawing-interaction-hardening.md`（接入点章节更新）
- Commits: 56025ea9([pr] feat) → no-ff merge 2caf16e0 已 push origin/nexus/main
- Result: PASS——core 2473 绿（218 文件，净增 5）、探针 39/39（B1-01 整线拖拽不受影响符合设计）

## 2026-09-14（第四会话·批2 收尾 + 批3/批4）

- Objective: 消费 cloudtradeagent 主线交接简报，完成批2 剩余 + 批3 + 批4（shell/b2-b4，worktree 实施）
- Changed files:
  - 新增组件：LegendBar（图例栏）、ChartContextMenu、WatchlistPanel、SettingsDialog、ObjectTreePanel、PanelSection、ShortcutsOverlay；新增 shell/periods.ts（周期目录单源）
  - 修改：ChartStage（关 canvas 图例 + 右键钩子）、pointerBridge（contextmenu 钩子化）、NexusShellContext（setMagnet/drawings 暴露/symbolPickerRequest/shortcutsVisible/键盘路由/主题持久化）、SymbolPicker（唤起请求订阅 + closePicker 统一消费）、TopBar（设置入口）、IndicatorPanel（寻址修正）、mockData（tick）、storage（nexus.theme/nexus.panel）、labels、shell.css
  - 探针：新增 probe-b234.mjs（49 断言）；probe-topbar B2-03 改 DOM 图例断言；probe-drawing B1-27 选择器稳定化（--templates）
- Commits: 220a6ef9(图例栏) 7023ed32(右键菜单) a6b6fe65(B3 面板) 5ff261f6(面板折叠+主题持久化) 6cda1b38(键盘) 70d4833b(图例匹配修正+寻址加固+探针) → no-ff merge f25207ed 已 push origin/nexus/main
- Result: 全门绿——probe-b234 49/49 + probe-drawing 39/39 + probe-topbar 15/15 + typecheck；checklist B2/B3/B4 全部闭环（B2-05 stretch 未做、B3-02 网格/坐标轴部分）
- 实施中发现（关键）:
  - 简报两处失实：indicators 公开信号丢弃 source 字段（改按 id 'mode:' 前缀过滤）；scrollToDataIndex 在 core 不存在（对象树定位=选中高亮）
  - 引擎契约缺陷：removeIndicator/updateIndicatorParams 不接受 addIndicator 返回的 'main:*' 实例 id（IndicatorPanel 旧路径一直坏着），壳侧按 definitionId 寻址绕开，归一化登记 [pr] 候选
  - 引擎图例行顺序在删除/重加后不稳定 → 图例行必须按 name↔definitionId 匹配，禁止按序拉链
  - legendTemplateContext.currentBar 仅十字线时非空（无十字线回退 legend.bar）
- Remaining risks: 见 risks.md（handoff 文件未跟踪待用户决定；类型债；引擎契约归一待 [pr]）
