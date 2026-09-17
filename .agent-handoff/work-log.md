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

## 2026-09-15（第二会话·上游 PR 合并确认 + MT5 数据源调研打包）

- Objective: 确认回传 PR #174 被上游合并；调研并打包 MT5 本地数据源任务（提示词 B）
- 确认结果: PR #174 MERGED（f730530a，上游 integrate/pr174 分支，原 SHA 零改动合入；upstream/main 未快进）；已清理本地与 origin 的 pr 分支，worktree detached 至 nexus/main
- MT5 调研（两个 Explore 代理并行 + deepseek-flash/v4-pro 双顾问评审）:
  - KCQ 侧: V1 行情协议（probe/instruments/bars）+ connecter 模式（connecters.mjs/setup-backends）+ Provider 装配模板（gotdx ~30 行）+ 写入即联动链（DataBuffer→IndicatorScheduler→重绘）+ 唯一 SSE 先例（depth/binance.ts）
  - cloudtradeagent 侧: MetaTrader5 Python IPC 本机终端、时间戳为服务器墙钟伪 UTC（实测偏移转真 UTC）、Europe/Athens EET-EEST 锚重采样吸收周日短棒、WaveTrader 16 个可移植对齐用例
  - 顾问一致结论: 架构 A+E（连接器轮询+SSE 推帧+core 消费器）；⚠️ core 无 upsert 原语（merge 保旧弃新、updateData=setData 别名）——forming 更新会被静默吞，必须先补 updateBars
- 决策: D13（新建同级连接器仓库）D14（SSE 实时链路）D15（周日短棒不剔除，重采样吸收）D16（连接器配置+probe 上报开关）D17（updateBars 前置原语）
- 交付: AGENT_SESSION_PROMPTS.md 新增提示词 B（自包含）；decisions/snapshot/backlog 同步
- Remaining risks: 提示词 B 待闲时任务执行；真机 E2E 需用户 MT5 终端配合

## 2026-09-15（第三会话·提示词 B 执行：MT5 数据源接入实施）

- Objective: 执行 AGENT_SESSION_PROMPTS.md 提示词 B（连接器 + core 实时链路 + 壳接线）
- Phase A — 连接器仓库（独立 git 历史）:
  - app/: config（env）clock（偏移实测/复测/覆盖）align（锚时区重采样纯函数）gateway（单工作线程串行 IPC、全路径 initialize、Exness/登录校验、限流心跳重连）aggregator（tick 探针分级轮询 + ChangeDetector 收线判定 + 静默退避封顶 30s）hub（每流环形缓冲 500 + 单调 seq + Last-Event-ID 重放）routes（V1 三端点 + SSE）main（CORS 放开）
  - tests/: 对齐（冬夏 4h/日线/DST 切换日/周月锚/偏移换算，语义移植自 WaveTrader）+ 检测器 + Hub + 路由（FakeGateway 无需终端）
- Phase B — core（worktree fork/mt5-source）:
  - KLineDataStore.updateBars（replace-on-conflict 末 2 根窗口、陈旧拒绝、批原子写）→ DataBuffer/KLineBuffer → ChartDataManager → Chart → ChartController 全链暴露；语义测试 8 用例先行（红线：forming 更新不被 merge 吞）
  - sourceRegistry 加 mt5（:8090 + 7x24 UTC 会话 MT5）+ sources/mt5.ts Provider；data/live/mt5BarsLive.ts（EventSource 封装 + RealtimeBarsConnector：closed 暂存随 forming 合并一次原子写、快照直写、断流冲刷）；controllers 出口补 searchInstruments/mt5 系列
- Phase C — nexus-shell:
  - 设置对话框"数据源"段（点击时才 probe——挂载探测会给 mock 路径引入 ERR_CONNECTION_REFUSED 噪声，b234 探针收尾门拦截后修正）；SymbolPicker 双模式（mt5 走 searchInstruments 防抖 + AbortSignal，recent 存品种描述）；数据接线 effect + SSE live effect（品种/周期变化重连、离开即断）
  - probe-mt5.mjs 冒烟探针（桩连接器内嵌 :8090）8/8：切源/跨源搜索/历史 60 根/SSE forming 写末根/切回断流
- Phase D — 文档 + 登记与验收: docs/data-sources/mt5.zh-CN.md + docs/design/mt5-exness-alignment.md + connecters/setup-backends 登记
- 实施中发现（关键坑，全部已修复并记录）:
  - 探针谓词坑：`page.locator().count() > 0` 是 Promise 与 0 比较（恒 false），必须 async/await
  - starlette TestClient/httpx ASGITransport 均不支持无限 SSE 流消费：测试用裸 ASGI send/receive 收首帧；receive 桩必须阻塞（立即返回会饿死事件循环）
  - SourceRouter 依赖 probe 响应的 capabilities 字段筛选流转候选——连接器 probe 必须带能力声明
  - pandas 2.x：tz-aware 索引取毫秒须 tz_localize(None)→astype ns；ms 精度索引的 astype int64 返回 ms 非 ns
  - 服务器偏移实测字段名错配（TickProbe.time_seconds 而非 time）会让实测静默失败回落 0
  - vue-tsc 走 package exports→dist：worktree 陈旧 dist 会造成 type-check 假阳性（+5），先 `pnpm --filter core build` 重建再对基线

## 2026-09-15（第四会话·MT5 批次收尾：改名 + OpenSpec + merge push）

- Objective: 用户指示——先提交；连接器归用户名下、命名 KCQ-MT5-connector；用 OpenSpec 建立连接器规范文档；上游 PR 等用户测试
- 改名: KCQ 侧全部引用同步（connecters.mjs/setup-backends.mjs/sourceRegistry/docs/core 注释），commit 1de4a6eb（曾漏 [fork] 前缀，已 amend+rebase 修正后重做 merge）
- 连接器仓: 目录定名 D:\AI\KCQ-MT5-connector；README/pyproject/server title 同步；remote=EliteOtaku/KCQ-MT5-connector（GitHub 未建仓未 push）
- OpenSpec: openspec init（CLI 1.8，spec-driven schema，tools=zcode）+ config.yaml 项目上下文 + 五能力规格（v1-market-data-rest/realtime-bars-stream/exness-alignment/terminal-gateway/symbol-catalog）strict 校验 5/5 全绿 + AGENTS.md（约定/命令/domain invariants）
- ⚠️ 事故与恢复（详见 risks.md）：① mv 连接器目录因残留 pytest 进程占用失败后误发 rm -rf——凭会话上下文逐文件全量重建，pytest 34/34 验证与删除前等价（新仓 commits: 2d599fc feat + docs OpenSpec commit）；旧 git 历史未还原。② 主工作区 `git reset --hard`（重做 merge 时）把已入库的 handoff 文件未提交更新退回旧版——已全量恢复（snapshot/decisions D12-D18/risks/backlog/work-log/PROMPTS/HANDOFF）
- merge/push: nexus/main = e0425948（9 commits no-ff merge，含改名修正链），已 push origin；merge 后主工作区 MT5 相关测试 18/18 复验通过
- Remaining: 真机 E2E 待用户；连接器建仓 push 待用户；上游 PR 待用户测试后再议

## 2026-09-16（cloudtradeagent 消费方主线核验 + 下一阶段规划同步）

- 消费方主线（cloudtradeagent worktree /?view=kcq）核验本仓：批1-4 状态与
  checklist 一致（b1 扎实 39/39、b2 收尾项/批3/批4 由后续会话完成——legend
  DOM 接管/右键菜单/watchlist/对象树/键盘全落地，与主线简报方案吻合）；
  MT5 集成（nexus/main=e0425948）与连接器仓确认在位。
- snapshot Immediate next actions 扩为完整下一阶段规划：MT5 真机 E2E（用户）→
  上游 PR 批次（绘图交互强化+MT5+已推三分支）→ 业务 overlay 搬家（闭源主导）→
  agent 面板；壳尾项单列。
- 交接文档由消费方主线按 /agent-handoff 刷新并入库（本 commit）；fork 开发转向
  「真机验证 + PR 整理 + 配合业务搬家」阶段。

## 2026-09-15（第五会话·数据源管理统一化：MT5 收编进聚合源管理）

- Objective: 用户建议——MT5 接口和设置放进"聚合源管理"统一管理（用户提供了 Vue 图表设置/聚合源管理截图）
- 查证结论: 聚合源管理（Vue AggregationSourceDialog + useAggregationSources）完全注册表驱动（marketDataProviderRegistry.getAll()）——MT5 已注册，自动出现在列表（用户截图系 merge 前旧代码）；Vue demo 选品种链路（toSymbolSpec → source: item.sourceId → setSymbols fetcher 管线）对 MT5 全链可用，零改动
- nexus-shell 统一化（主工作量）:
  - 新增 SourceManagerDialog（React 版聚合源管理）：registry 驱动列全部源（mock 沉底）、并发拨测（5s 超时 + 地址变更防抖重拨）、聚合搜索开关（setConfig enabled）、地址与端口折叠编辑（setConfig baseUrl，与默认同则清覆盖）、"设为当前"（probe 门控，成功自动关框）；当前源高亮描边
  - SettingsDialog "数据源"段改为 当前源展示 + "管理数据源"入口（子对话框叠加）
  - NexusShellContext：ShellDataSource 泛化为 string（'mock' 或任意 sourceId）；selectDataSource 改 registry.get(next).probe() 通用门控；mt5Instrument → sourceInstrument；storage 键 recent-mt5-instruments → recent-source-instruments；数据接线 effect 泛化（非 mock 且有品种 → setSymbols(source=dataSource)），SSE live 仍仅 mt5
  - SymbolPicker：isMt5 → isNetworkSource，搜索限定当前源（sourceIds=[dataSource]）
- 连接器/Vue 补强: 连接器 probe 正常态 message 填对齐摘要（「对齐 Europe/Athens · 偏移 +3h（实测/配置/默认）」，离线时为诊断原因）；Vue useAggregationSources.probeAggregationResult 透传 message、AggregationSourceDialog 状态行拼接展示（在线=对齐摘要、离线=原因截断 40 字）——通用机制，其他源 message 为空无影响
- 验证: nexus-shell typecheck 绿；root type-check 52=基线（先重建主工作区 core dist）；probe-mt5 更新为管理对话框路径 10/10；三探针 39/15/49；连接器 pytest 34/34
- 未提交：等待用户确认后 commit/push（本轮改动在主工作区工作树）

## 2026-09-18（端口混乱排查：MT5 不可见根因与端口约定）

- 现象: 用户访问 5173/?view=kcq 强制刷新后仍看不到 MT5
- 根因: 5173 被 **KCQ preview 旧 dev 进程**（merge 前启动）占用——用户访问 5173 的任意 query（含 ?view=kcq）都命中该旧进程服务的 preview 首页（旧模块缓存），MT5 不可见；cloudtradeagent WebUI 的 vite 写死 port 5173，后启动只能挪走。webui 前端实际没有 view=kcq 视图（App.tsx 只认 view=options）
- 处置: 杀旧进程；preview/vite.config.ts 固定 server.port=5175 + strictPort（5173 还给 WebUI）；5175 实测聚合源列表 = BaoStock/FinShare/GOTDX/TradingView/MT5 (Exness)/Mock ✓（连接器未跑时 MT5 显示"离线·原因"）
- 端口约定: **5173=cloudtradeagent WebUI / 5175=KCQ Vue preview（strictPort）/ 5273=nexus-shell / 8090=MT5-Connecter**
