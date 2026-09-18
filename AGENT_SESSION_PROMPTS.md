# Agent Session Prompts

> 闲时任务提示词。每条提示词自包含：执行代理无需会话历史即可运行。
> 通用前置：先读 `AGENT_HANDOFF.md` → `.agent-handoff/snapshot.md` → `.agent-handoff/risks.md` → `.agent-handoff/backlog.md`。

---

## 提示词 A：nexus-shell 磁吸迁移到引擎 API（fork 壳侧收编）

> **状态：已执行（2026-09-14）**。fb5392de 已合入 nexus/main 并经 PR #174 回传上游（f730530a）。

```text
0. 身份与目标
你是 KCQ-NexusAI 仓库的壳侧实施代理。仓库 D:\AI\KCQ-NexusAI（fork 自 363045841/klinechart，MIT；上游 push 已禁用，一切改动只在 fork 仓内）。
任务：引擎绘图交互硬化已合入 nexus/main（fb5392de），把 fork 壳（packages/nexus-shell）的磁吸与 Shift 点选从壳层实现切换到引擎 API，删除壳侧重复实现。含一个前置的引擎小修（见 [0]）。

开工必读（只读）：
- AGENT_HANDOFF.md 与 .agent-handoff/{snapshot,decisions,risks}.md
- docs/design/drawing-interaction-hardening.md（磁吸档位语义/接入点 SSOT——迁移不得改变任何一条语义）
- packages/nexus-shell/src/shell/pointerBridge.ts（applyMagnet 约 L303-345、Shift→Ctrl 归一化约 L159-162）
- packages/core/src/engine/drawing/interaction.ts（setMagnetMode/resolveMagnetOptions/hitTestAt）
- packages/nexus-shell/docs/action-checklist.md（B1-11/15/17/18 为本次回归基准）

1. 铁律
R1 分支纪律：基于 nexus/main 建分支（建议 fork/shell-engine-magnet-migration 或复用 worktree D:\AI\KCQ-NexusAI-batches 新建）；壳侧 commit 用 [fork] 前缀，引擎小修用 [pr] 前缀（先例：fb5392de）；主工作区保持干净，在 worktree 干活。
R2 语义零漂移：迁移前后探针断言的磁吸/锁角/多选行为必须一致；不得"顺手优化"半径、候选顺序、X 吸附、Ctrl 升级任何一条（决策 D9）。
R3 工程规约（仓库 AGENTS.md）：拒绝治标不治本；每项改动配套测试；引擎改动附设计文档（磁吸设计文档已存在，如改语义需更新它）；注释中文、文件头+函数注释。
R4 45 分钟止损：单项卡死 → 记根因+已试方案 → 标 BLOCKED 跳下一项。
R5 用户未明确要求时不 commit/push；本任务的 commit 授权仅限任务完成并过验收门后执行。

2. 背景（已查证事实，勿重复调研）
- 引擎已落地（fb5392de，2026-09-13 验证）：
  - DrawingInteractionController.setMagnetMode('off'|'weak'|'strong') / getMagnetMode()：磁吸仅在绘图模式 onPointerDown（锚点落点）与 onPointerMove（预览）生效；Ctrl/Meta 按住临时覆盖为 strong（含 off 档）。
  - Shift+click 在 cursor 模式原生等价 Ctrl 多选（toggle + 空白不清空）。
  - hitTestAt(x, y)：公开命中查询，容器局部坐标，与点选同口径（locked 排除、pane 偏移换算）。
  - getBatchStyleKeys 对"全通道类选中集"返回 'fill' 键（updateBatch 可写填充色）。
  - locked 图元不可点选/框选/拖拽。
- 壳侧现状（pointerBridge.ts）：磁吸经 clonePointerEvent 改写坐标转发；光标模式 Shift→Ctrl 事件归一化；二者均可在删引擎未覆盖的互斥语义后移除。
- ⚠️ 互斥语义缺口（迁移必修，见 risks.md）：引擎 resolveMagnetOptions 未检查 shiftKey。壳侧现状是"Shift 锁角分支完全跳过磁吸"（onPointerDown/onPointerMove 中 shiftKey+多锚点工具 → applyAngleLock，不走 applyMagnet）。若只删壳侧 applyMagnet 而不补引擎，"磁吸开 + Shift 锁角画线"场景会被双重改写（锁角坐标再被吸附），行为漂移。

3. 范围（按序实施，一项一 commit）
[0] 引擎小修（[pr] fix(core)，先行）：resolveMagnetOptions 在 e.shiftKey 为真时返回 undefined——恢复"Shift 锁角与磁吸互斥"语义。补 interaction.magnet.test.ts 用例（shiftKey 下不吸附）。core 测试全绿后合入本分支。
[1] 壳侧接线（[fork] feat）：磁吸偏好变化与桥初始化时调用 dic.setMagnetMode(mode)（壳的 BridgeStateAccessors.getMagnet 保留读取，改用于同步引擎档位；持久化键不变）。删除 applyMagnet、其两处调用分支与 MAGNET_RADIUS_* 常量；Ctrl/Meta 临时升级逻辑不再需要（引擎内置）。
[2] 删 Shift→Ctrl 归一化（[fork] refactor）：pointerBridge 中 cursor 模式的 shiftKey→ctrlKey clonePointerEvent 分支删除，引擎原生支持。
[3]（可选，时间允许）橡皮擦改用 dic.hitTestAt(localX, localY) 直接删除（替代"点选→读选中→删"三步）；DrawingStyleFlybar 补填充色控件（B1-07 收尾，通道类选中集现在 getBatchStyleKeys 含 fill）。

4. 明确不做
- 不做锁角/测量/拖拽复制的引擎化（角度锁仍走壳侧 clonePointerEvent 改写，本任务不动）。
- 不改磁吸语义任何参数（半径/候选/X 吸附/Ctrl 升级）。
- 不动 packages/ai-runtime（废弃包）。

5. 验收门（全绿才算完成）
- pnpm --filter @363045841yyt/klinechart-core test 全绿（[0] 改引擎）
- pnpm --filter nexus-shell typecheck 绿
- worktree 起 nexus-shell dev（端口 5273），node packages/nexus-shell/scripts/probe-drawing.mjs 必须 39/39——重点 B1-17/B1-18（磁吸，此时走引擎实现）、B1-11（Shift 多选，走引擎原生）、B1-15（锁角不受磁吸干扰）
- 若探针出现磁吸相关失败：先对比 docs/design/drawing-interaction-hardening.md 的语义表定位是引擎实现偏差还是壳迁移接线错误，禁止放宽断言容差

6. 收尾
- 过验收门后：merge 回 nexus/main（主工作区）+ push origin；commit 信息用 .opencode/skills/commit/SKILL.md 规范。
- 更新 .agent-handoff/：snapshot（状态与下一步）、backlog（勾掉壳迁移项）、validation（追加各门结果）、work-log（追加当日节）、action-checklist.md 引擎缺口表更新 G-01/G-06 状态为"引擎原生"。
- 汇报格式：[0]..[3] 各项 PASS/BLOCKED/SKIPPED + 一句话结论；验收门逐项结果；删除的壳侧代码位置；BLOCKED 项根因与已试方案。

反空转条款：把本提示词视为明确的执行请求。不要回答"无需响应"。先复述你认为的当前步骤，指出下一个具体动作，然后开始执行。上下文不足时从 AGENT_HANDOFF.md 与 .agent-handoff/ 必读文件恢复后再动手。
```

---

## 提示词 B：MT5 本地数据源接入（连接器 + core 实时链路 + 壳接线）

> **状态：已执行（2026-09-15）**。连接器为用户名下独立仓库 **KCQ-MT5-connector**（`D:\AI\KCQ-MT5-connector`，OpenSpec 五规格 strict 全绿）；KCQ 侧 9 commits 已 merge push nexus/main=e0425948。执行差异与新增决策见 decisions.md D18、work-log 2026-09-15 各节；真机 E2E 与连接器 GitHub 建仓待用户，上游 PR 待用户测试后再议。

```text
0. 身份与目标
你是 KCQ-NexusAI 仓库（D:\AI\KCQ-NexusAI）的数据源实施代理。任务：实现从本地 MT5 终端（Exness）读取 K 线并在图表实时绘制，含 Exness 特有的周日短棒/4h 收线时间对齐能力。三部分：
(A) 新建同级独立仓库连接器——Python 连接器（MetaTrader5 + FastAPI），实现本仓 V1 行情协议 + SSE 实时帧；
(B) core 接入——mt5 Provider 注册 + KLineDataStore.updateBars 原语 + SSE 实时消费器；
(C) nexus-shell 接线——数据源切换（Mock/MT5）+ MT5 品种搜索选择 + live 自动接线。
设计与调研已完成并固化为决策 D13-D17（.agent-handoff/decisions.md），本提示词直接执行，不要重新调研大方向。

开工必读：
- AGENT_HANDOFF.md → .agent-handoff/{snapshot,decisions,risks}.md（决策 D13-D17 是本任务的架构 SSOT）
- docs/market-data-v1.openapi.yaml（V1 行情协议契约：probe/instruments/search/bars）
- packages/core/src/data/provider/sources/gotdx.ts（Provider 装配模板，~30 行）
- packages/core/src/data/depth/binance.ts + depthConnector.ts（SSE 消费先例：EventSource 自动重连/keepalive/接线模式）
- packages/core/src/data/buffer/kLineDataStore.ts（merge 保旧弃新陷阱 + updateBars 落点）
- scripts/connecters.mjs + scripts/setup-backends.mjs（connecter 登记方式）
- 参考实现（闭源仓库，只读参考行为语义，禁止复制代码，见铁律 R0）：
  D:\AI\cloudtradeagent-vela\scripts\_lib\mt5_source.py（MT5 读取/偏移实测/对齐重采样，核心算法在文件尾部 resample_align 区块）
  D:\AI\cloudtradeagent-vela\docs\plan_tf_alignment.md（对齐决策依据：A2=Europe/Athens EET/EEST 锚）
  D:\AI\WaveTrader\tests\test_mt5_alignment.py（16 个对齐测试用例，纯函数、可直接移植语义）

1. 已查证事实（勿重复调研）
[MT5 侧]
- MetaTrader5 Python 包经 IPC 读本机已登录终端（Windows 同机），无任何推送回调，只有轮询式调用：copy_rates_from_pos（index 0=forming bar、1=最后收线）、copy_ticks_from、symbol_info_tick。
- initialize 必须传终端全路径（如 C:\Program Files\MetaTrader 5 EXNESS\terminal64.exe），不裸调否则可能连错终端；启动后校验 terminal_info().company/account_info().server 含 "exness"。
- MT5 返回的 K 线时间戳是"服务器墙钟按 UTC epoch 解释"的伪 UTC，必须实测服务器 UTC 偏移（tick 时间 vs 本机时钟模 24h 归一到 ±12h，env 可覆盖）转真 UTC。
- 4h/1d/周/月 = 从 H1/D1 按锚时区重采样：先锚时区归日（normalize），4h 再 hour//4*4 分桶；锚=传统品种 Europe/Athens（EET/EEST 自动 DST）、加密品种 UTC。周日短棒在该重采样中自然并入周一首根，无需特判。
- copy_rates_range 的 from/to 也在服务器时间轴上：请求窗口要 +offset 反向换算并留 ≥48h 前置余量。
- 实时性只能靠轮询；参考实现实测 forming bar 1.5s 轮询已流畅。
[core 侧]
- V1 协议 HTTP 端点：GET /api/v1/market-data/sources/{sourceId}/probe、POST /instruments/search、POST /bars；响应 {data:...} envelope。
- 数据源三件套：data/provider/sourceRegistry.ts（元数据注册表，加 mt5 条目 :8090）、data/provider/sources/mt5.ts（createMarketDataProvider + httpTransport 装配）、data/index.ts 与 controllers/index.ts re-export。注册后自动获得聚合搜索/SourceRouter 能力流转/Agent 工具可见。
- KLINE_PERIODS 已含 '4h'；AssetClass 已含 'forex'/'crypto'。
- ⚠️ 阻塞项（决策 D17）：kLineDataStore.merge() 对重复时间戳保旧弃新、controller.updateData 是 setData 别名（全量替换）、appendData 无去重 concat——forming bar 更新直接推会被静默吞掉。必须先实现 KLineDataStore.updateBars（replace-on-conflict，仅允许末尾窗口，拒绝陈旧帧）→ DataBuffer → chartDataManager → controller.updateBars 全链暴露，并先写语义测试（替换/追加/陈旧拒绝）再接 SSE。
- 写入即联动：往活动 DataBuffer 写 → data signal → chartDataManager.handleBufferDataEvent → IndicatorScheduler 重算 → scheduleDraw。
- SSE 消费先例：data/depth/binance.ts（EventSource 原生重连/':' keepalive）+ depth/depthConnector.ts（source→controller 接线模式），新代码照此风格。
- nexus-shell 现为纯 mock（symbol/period 变化 → applyCustomData 一次性注入）；MT5 模式改走 setSymbols([{...spec, source:'mt5'}]) fetcher 管线（左翻分页自动补历史）；聚合搜索用 searchInstruments（registry 已有跨源搜索）。
- ⚠️ 会话要求：品种必须带 sessionId 且对应会话在 sourceRegistry.marketSessions 注册（provider 装配器按此解析时区）。

2. 用户决策（已拍板，不得擅改）
- 连接器为独立新仓库（Python 3.12 + FastAPI + MetaTrader5 + pandas + pytest），不做 core 进程内 Provider、不进 cloudtradeagent；归属用户名下（EliteOtaku），命名 KCQ-MT5-connector。
- 实时 = 连接器单采样循环轮询 MT5 → SSE 单连接推帧 → core EventSource 消费器；不做 WebSocket、不做浏览器轮询、EA socket 桥仅登记为演进项。
- 周日短棒全链不剔除：日内原生保留（偏移校正即正确表示），4h/1d/周/月重采样自然吸收。
- Exness 对齐开关 = 连接器 env（ALIGN_TZ=auto|gmt2|gmt3|off，auto=检测到 Exness 才对齐）+ probe 响应上报 aligned/anchorTz/serverOffsetMinutes；UI 开关后续再说。
- 指标寻址坑（既有）：引擎 removeIndicator/updateIndicatorParams 只按 definitionId 寻址，不接受 'main:*' 实例 id。

3. 铁律
- R0 开源边界：cloudtradeagent/WaveTrader 为闭源仓库——禁止复制其任何代码进连接器或本仓，只允许参考行为语义与测试用例语义重写实现。连接器先 git init 不定 license、GitHub URL 留占位（用户后续决定）。
- R1 分支：core/shell 改动在 worktree D:\AI\KCQ-NexusAI-batches 开分支 fork/mt5-source（基于 nexus/main）；连接器独立仓库独立 git 历史。
- R2 测试先行：updateBars 语义测试先写先绿，再接 SSE；对齐用例移植自 WaveTrader 语义（冬夏 4h 边界/DST 切换日/周日短棒并入/周月锚/env 覆盖），pytest 纯函数无需 MT5 即可跑。
- R3 45 分钟止损：单项卡死 → 记根因+已试方案 → 标 BLOCKED 跳下一项。
- R4 commit：KCQ 侧 [fork] 前缀 conventional；连接器仓库内 conventional（无前缀）。
- R5 全程不 push；完成后汇报，push 由用户决定。

4. 范围（按序实施，一项一 commit）
[Phase A] 连接器仓库：
  app/gateway.py（唯一 IPC 持有者：initialize 全路径、Exness 校验、login 校验、5s 心跳、单工作线程串行队列、绝不 re-initialize 风暴）
  app/clock.py（偏移实测/复测/覆盖）
  app/align.py（锚时区 + resample_align 纯函数 + 周月重采样）
  app/aggregator.py（分级轮询：活跃品种 1s tick 探针→变化才 copy_rates_from_pos 取 2 根、后台品种 5-10s、静默计数判休市退避封顶 30s；ChangeDetector：(symbol,tf,openTime)+OHLCV 内容去重、无变化不发帧、收线判定=openTime 变化并发 closed(旧根终值)+forming(新根)，容忍终端缓存滞后）
  app/hub.py（StreamHub：订阅表、环形缓冲 ~500 帧、单调 seq、帧 snapshot/forming/closed/status、Last-Event-ID 重放、15s ':' keepalive、X-Accel-Buffering: no）
  app/routes.py（REST V1 三端点 + GET /api/v1/market-data/sources/mt5/stream?symbol&period——每连接固定订阅，切品种=重连）
  app/config.py（env：ALIGN_TZ/EXNESS_ONLY/EXNESS_SERVER_UTC_OFFSET/MT5_TERMINAL_PATH/端口 8090）
  tests/（对齐用例移植 + 帧协议/去重/收线判定测试）
  本仓登记：connecters.mjs + setup-backends.mjs
[Phase B] core：
  sourceRegistry 加 mt5（含 marketSessions 注册 'MT5' 7x24 UTC 会话）；sources/mt5.ts（capabilities 仅 bars，periods=1min/5min/15min/30min/60min/4h/daily/weekly/monthly，不声明 timeshare/depth）；两处 re-export；
  KLineDataStore.updateBars（先写语义测试）→ DataBuffer → chartDataManager → controller 暴露；
  data/live/mt5BarsLive.ts（Mt5LiveSource EventSource 封装 + RealtimeBarsConnector 帧驱动：closed 暂存随 forming 合并一次原子写、snapshot 整批写并作废暂存、断流冲刷暂存）
[Phase C] nexus-shell：
  设置对话框加"数据源"段（Mock/MT5，切换时才 probe，失败回退 Mock 并提示——勿在挂载时探测，会污染 mock 路径的页面错误门）；
  MT5 模式 SymbolPicker 走 searchInstruments；选中 → setSymbols([{...spec, source:'mt5'}])；
  source==='mt5' 时 live 自动接线（symbol/period 变化重连，离开即断流）→ controller.updateBars
[Phase D] 验证 + 文档：
  docs/data-sources/mt5.zh-CN.md（部署前提/对齐语义/env 表）；设计决策记 docs/design/mt5-exness-alignment.md

5. 明确不做
timeshare/depth 能力；quarterly/yearly 周期；EA socket 桥（登记演进）；tick 级自建 bar 聚合；KLineChart.vue 残留 mcp props 清理（另批）。

6. 验收门
- 连接器 pytest 全绿（对齐用例无需 MT5 终端）
- core vitest 全绿（既有 2491 + 新增 updateBars/provider/live 测试）
- pnpm --filter nexus-shell typecheck 绿；三探针回归（mock 路径）39/15/49 不受影响
- updateBars 语义测试证明 forming bar 更新不被 merge 吞掉（关键回归防线）
- 真机 E2E 需用户配合（Windows + Exness MT5 终端已登录）：pnpm connecter mt5 → 壳切 MT5 源 → 绘制/forming 实时刷新/日线与 4h 无周日棒 → 列入汇报由用户执行

7. 收尾
- 更新 .agent-handoff/（snapshot/backlog/work-log/validation，action-checklist 如涉及）与决策执行差异。
- 汇报格式：Phase A/B/C 各项 PASS/BLOCKED/SKIPPED + 一句话结论；验收门逐项结果；真机 E2E 待办清单；BLOCKED 项根因与已试方案。

反空转条款：把本提示词视为明确的执行请求。不要回答"无需响应"。先复述你认为的当前步骤，指出下一个具体动作，然后开始执行。上下文不足时从 AGENT_HANDOFF.md 与 .agent-handoff/ 必读文件恢复后再动手。
```

---

## 提示词 C：TradingView 界面参考采集（TV 对齐批次 Phase 0）

> **状态：已执行（2026-09-18）**。产出 `temp/tv-reference/`（notes.md + gap-analysis.md + 33 张截图），
> 验收门 4/4 过，用户复核通过（补图 9 张闭环）。执行差异（IAB 替代 Edge、cn 子站、事件派发交互模式）与
> 受限项清单见 `.agent-handoff/snapshot.md` "提示词 C 执行结果"节与 work-log 2026-09-18 第三会话节。

```text
0. 身份与目标
你是 KCQ-NexusAI 仓库（D:\AI\KCQ-NexusAI）的界面参考采集代理。
第一步：使用 /agent-handoff 技能读取仓库交接文档（AGENT_HANDOFF.md → .agent-handoff/snapshot.md →
risks.md → backlog.md），充分理解仓库背景、端口约定与本任务红线后再动手。
任务：用 Edge 浏览器访问 TradingView 网页版（免费未登录态，界面切中文），系统性采集图表界面的
参考物料，产出三样东西：
(A) 截图库 temp/tv-reference/（整页 + 关键局部特写）；
(B) 结构笔记 temp/tv-reference/notes.md（每界面的面板组成、按钮/菜单项文字清单、布局层次）；
(C) 差距比对清单 temp/tv-reference/gap-analysis.md（TV 元素 ↔ KCQ 现状 ↔ 归属批次 T1/T2/T3/T4/不做）。
产出供用户复核后，作为提示词 D（T1 实施）的工作清单与视觉基准。

1. 已查证事实（勿重复调研）
- TV 桌面版是 Electron 套壳，网页版 tradingview.com 与桌面版 UI 同源，看网站即看 app。
- 图表页直链：https://www.tradingview.com/chart/（免费未登录可用；站点支持 ?lang=zh 或界面内切中文）。
- 图表本体是 canvas（DOM 提取拿不到内部实现）——不需要；要复刻的是 chrome（工具栏/面板/对话框/菜单），均为 DOM。
- 免费未登录可见：图表页全套 chrome、绘图工具全集（左侧栏展开态）、图表属性对话框、右键菜单、
  对象树、数据窗口、基础回放、1-2 格布局。受限：3+ 格布局、高级告警管理、screener 部分——
  这些域在笔记里如实标注 UNAVAILABLE，不猜。
- 本仓现状（比对基准）：nexus-shell（React 壳）已有顶栏简版/绘图工具 16 种/对象树/图例栏/
  自选/设置对话框/数据源管理；引擎已有 features/alerts、features/replay、chartTypes
  （Renko/RangeBars/PnF）未接壳。KCQ 自己的界面参考：起 dev server 即可看
  （5273=nexus-shell、5175=packages/vue preview，见 .agent-handoff/snapshot.md 端口约定）。
- 浏览器能力：用 browser-use 技能（Edge 通道）逐步导航/截图/提取 DOM；临时脚本可放
  temp/tv-reference/ 内，用完即删。

2. 用户红线（已拍板，违反即失败）
- R1 不登录任何账号（全程未登录态）；不用用户已登录的浏览器 profile。
- R2 人工速度：每页停留浏览后再操作，总页面数 <30，不并发、不批量爬取；不触控行情数据接口。
- R3 不复制资产：禁止保存/拷贝 TV 的 CSS、SVG 图标、图片、字体与成段文案；截图仅作本地
  参考不入库（temp/ 已 gitignore）；产出物只有结构认知与功能文字清单。
- R4 不改任何 KCQ 业务代码；不 commit/push（temp/ 产出不入库）。
- R5 45 分钟止损：单个界面卡死（弹窗/验证码/加载失败）→ 记录后跳下一个，最后统一汇报。

3. 范围（界面清单，逐项产出 截图 + notes 结构笔记）
[1] 顶栏：品种搜索框（含徽章结构）、周期快捷、K线类型下拉、指标入口、告警/回放/撤重做/
    布局/截图/设置按钮的组织方式
[2] 左侧绘图工具栏：收起态 + 展开态全部工具分组与工具名文字清单（这是 T4+ 工具扩展的基准）
[3] 图表属性对话框（右键→设置 或齿轮）：逐 tab 打开截图并记录每 tab 的设置项文字清单
[4] 图表右键菜单：完整菜单项与子菜单层次
[5] 对象树/对象管理器：入口、列表结构、每对象的操作项
[6] 数据窗口（Data Window）：入口、十字线联动时的信息组织
[7] 告警面板/创建告警弹层：免费版可见部分；受限则标注 UNAVAILABLE
[8] 回放（Bar Replay）：控制条形态、按钮与速度控制
[9] 底部周期条与时间轴工具
[10] 品种比较/新增商品弹层
[11] 布局切换入口（免费版 1-2 格可见，3+ 标注 UNAVAILABLE）
[12] （加分项）Watchlist 详情、图标lib 组织——免费可见就采
每个界面在 notes.md 记：入口路径、面板组成、控件清单（文字）、布局层次、交互要点（悬停/右键/快捷键提示）。

4. gap-analysis.md 格式
逐 TV 元素一行：TV 能力 | KCQ 现状（有/简版/无，指明文件或探针依据） | 归属（T1/T2/T3/T4+/不做/需引擎扩展）。
现状基准以 nexus-shell 实际代码与 .agent-handoff/snapshot.md 的 T1 范围为准，可起 5273/5175 对照截图（可选）。

5. 明确不做
不实施任何 T1+ 代码；不抓取行情/历史数据；不登录；不动 KCQ 业务代码与依赖；不 push 任何分支。

6. 验收门
- temp/tv-reference/ 含 ≥10 个界面的截图（整页+关键局部）且图像可读
- notes.md 覆盖范围清单全部 12 项（受限项标注 UNAVAILABLE + 原因）
- gap-analysis.md 覆盖 T1 全部范围域（顶栏/图表属性/撤重做/周期条/右缘空白）且每行有归属结论
- 全程未登录、未修改任何业务代码、未产生 git 提交

7. 收尾
- 使用 /agent-handoff 技能更新交接文档：snapshot 切换为"参考库已产出，等待用户复核 → 提示词 D"，
  记录采集页面数、遗漏域、UNAVAILABLE 清单；work-log 追加当日节；运行 maintain_handoff.py --compact-if-needed。
- 汇报格式：采集界面数 / 截图与笔记清单 / UNAVAILABLE 域 / 止损跳过项 / gap-analysis 关键结论（T1 归属统计）。

反空转条款：把本提示词视为明确的执行请求。不要回答"无需响应"。先复述你认为的当前步骤，
指出下一个具体动作，然后开始执行。上下文不足时先用 /agent-handoff 技能读取交接文档恢复。
```

---

## 提示词 D：T1 实施——TV 对齐图表工作台（引擎扩展 + 壳重做）

> 前置状态：提示词 C 参考库已产出并经用户复核（用户补图 9 张闭环右键菜单/图元属性/模板/A/L 钮/滚动钮）。
> 范围 SSOT = `temp/tv-reference/gap-analysis.md` A-F 域（H 批图元属性/模板不在本任务）。

```text
0. 身份与目标
你是 KCQ-NexusAI 仓库（D:\AI\KCQ-NexusAI）的 T1 实施代理。
第一步（强制）：使用 /agent-handoff 技能读取仓库交接文档（AGENT_HANDOFF.md → .agent-handoff/snapshot.md →
risks.md → backlog.md → validation.md → work-log.md 2026-09-18 各节），理解批次脉络、端口约定、探针基线
与本任务范围来源后再动手；UI 细节疑问一律先查 temp/tv-reference/notes.md 对应小节。
任务：实施 TV 对齐批次 T1——图表工作台五块重做（顶栏形态/图表属性大设置/底部时间范围条/右缘空白/多布局三分屏）
+ 撤销重做 + 四项引擎扩展。布局结构、交互逻辑、控件文字清单可对照 TV 复刻；CSS/SVG/图标/字体/成段文案
禁止拷贝（视觉用 KCQ foundation/tokens 自实现）。完成后用 /agent-handoff 技能更新交接文档再收尾。

1. 已查证事实（勿重复调研）
[参考库（UI 唯一基准）]
- temp/tv-reference/notes.md：控件级文字基准——[1]顶栏 19 控件及稳定 id、[2]8 组绘图 flyout 全工具名、
  [3]设置 7 tab 逐项清单+[3h][3i]模板统一范式、[9]周期菜单 32 档分组/类型菜单 21 种/底部条/[9d]滚动钮/
  [9e]A/L 轴钮、[11]布局菜单 1-9 格、附 A 匿名锁定域（勿在此浪费自动化/实现尝试）
- temp/tv-reference/gap-analysis.md：A-F 域 = 本任务范围 SSOT，逐行标注"纯壳层 / 需引擎扩展 / 不做"
- 关键视觉基准截图：01-chart-full-cn（整页）、01-topbar、03b~03g（设置各 tab）、03h/03i（模板下拉+删除）、
  09d/09d2（⊕+»浮动钮）、09e（A/L 轴钮）、11（布局菜单）
[引擎现状]
- StateKernel 单一状态源：子状态模块 readonly signals + actions（参照 engine/state/viewportState.ts 与
  stateKernel.ts 的模式；新子状态模块照此写，writableSignal 不出 actions）
- viewport：barSpacing/rightOffset/visibleRange 已有；无 log/percent 坐标变换、无 trailing 空白外推、无撤销栈
- DrawingDocument 已有原子原语（updateBatch/commitDrawingDrags/removeBatch/replaceDrawings/anchors 语义）——
  撤销栈做成其上的 command 包装层，禁止改动既有原语语义
- features/alerts、features/replay、chartTypes(Renko/RangeBars/PnF) 已有未接壳——T2+，本任务不接线
- 引擎/壳内部 import 风格以所在文件现状为准（.js 后缀仅上游 PR 分支要求）
[壳现状]
- TopBar 60 行（brand+SymbolPicker+period select+⚙+主题）；SettingsDialog 121 行（数据源/主题/磁吸/stay/自动套用）
- drawingTools.ts 18 工具、periods.ts 8 档 PERIOD_GROUPS、labels.ts 集中文案（组件禁止散落字符串）
- ChartContextMenu（图元 3 项/空白 3 项）、ObjectTreePanel/LegendBar/IndicatorPanel/WatchlistPanel/
  TemplatePanel/SourceManagerDialog/DrawingStyleFlybar；壳偏好持久化 storage.ts（nexus.shell.prefs）
- 颜色必须走 core foundation/tokens 输出的 CSS 变量；错误码引用 core errors.ts 具名常量
[验证基线（命令与期望值以 .agent-handoff/validation.md 为准）]
- core vitest 2519 绿；nexus-shell typecheck 绿；root type-check 基线 52 错（存量测试债，新增必须为 0）
- 三探针（nexus-shell dev 5273 下）：probe-drawing 39/39、probe-topbar 15/15、probe-b234 49/49；
  probe-mt5 10/10（mock 路径，连接器未跑也须过）
- 端口：5273=nexus-shell dev；5175=vue preview；5173=cloudtradeagent WebUI 勿动；8090=MT5 连接器

2. 用户决策（已拍板，不得擅改）
- 范围 = gap-analysis A-F 六域；H 批（图元属性对话框/params 编辑/模板统一范式实施）与 T2+（告警/回放/
  K线类型接线/数据窗口/前往到）明确不在本任务
- 坐标模式：log/percent/auto 三态，必须提供**双入口**——设置对话框"坐标和线条"下拉 + 价格轴 hover A/L
  快捷钮（[9e]；用户点名对数坐标不能埋深）
- 右缘空白：光标/绘图命中可越最新 K 线 + 时间轴外推未来刻度 + 「滚动到最近的K线」按钮（[9d]：» 图标、
  hover 右缘浮现、Tooltip 含 Alt+Shift+→、点击右缘对齐最新 K 线）
- 多布局：上限三分屏，布局菜单子集 = s/2h/2v/3h/3v/2-1/1-2（[11]），每格独立品种+周期；不做 TV 式
  保存布局/管理布局/云同步
- 顶栏形态：品种按钮+徽章、周期按钮+分组菜单（替代 select）、撤重做按钮含禁用态、布局按钮、设置入口；
  K线类型/告警/回放/指标模板按钮仅渲染占位（disabled+tooltip"T2+"），不接线
- 撤销重做：先绘图域（create/update(params 外的样式与锚点)/delete/拖拽聚合为一条历史），Ctrl+Z 与
  Ctrl+Y/Ctrl+Shift+Z + 顶栏按钮禁用态联动
- 底部时间范围快捷条：1天/5天/1个月/3个月/6个月/YTD/1年/5年/全部，范围→(周期,根数) 自动解析联动
- 大设置保留 KCQ 既有能力入口：数据源管理/磁吸/保持绘图/自动套用/主题，与新增 tab 并存不互斥

3. 铁律
- R1 分支：主工作区保持干净；在 worktree D:\AI\KCQ-NexusAI-batches 建分支 fork/t1-tv-alignment
  （基于 nexus/main）；commit 用 [fork] 前缀 conventional（生成规范走 .opencode/skills/commit/SKILL.md）；
  一项一 commit，禁止巨型提交（单 commit 目标 <800 行改动）
- R2 阶段门：按 4 的阶段顺序推进，每阶段结束必须过"该阶段验收"（typecheck+相关测试+相关探针）再进下一阶段；
  阶段间 push 一律推临时分支 fork/t1-tv-alignment（本提示词的分支即是），nexus/main 只在全部阶段过门后 merge——
  主分支的 CI 通知只应出现最终绿态（决策 D19）
- R3 引擎设计文档先行：docs/design/t1-priceScale-modes.md、t1-viewport-trailing.md、t1-drawing-undo-redo.md
  （语义表+边界条件先写后码；AGENTS.md 硬性要求）
- R4 语义零漂移：磁吸/锁角/Shift 多选/橡皮擦等既有探针断言不得放宽；本任务不应触碰
  docs/design/drawing-interaction-hardening.md 的语义
- R5 测试策略：引擎扩展先写语义测试再实现（log/percent 刻度换算与标签、trailing 外推、undo 边界与拖拽聚合）；
  禁止脆弱 MOCK（AGENTS.md）
- R6 45 分钟止损：单项卡死 → 记根因+已试方案 → 标 BLOCKED 跳下一项，最后统一汇报
- R7 提交授权：仅当全部阶段过验收门后 merge 回 nexus/main 并 push origin；中途不 push 不动上游

4. 范围（按阶段实施）
[阶段 0] 准备：worktree+分支；起 5273 对照参考截图建立视觉基线认知；三份设计文档（R3）；
  SettingsDialog tab 框架重构脚手架
[阶段 1] 引擎 priceScale 三模式（log/percent/auto）：坐标刻度换算+标签格式+图例值联动；配套测试
[阶段 2] 引擎 viewport trailing 空白：右缘空白偏移上限+timeAxis 未来刻度外推+十字线/绘图命中延伸；配套测试
[阶段 3] 引擎 drawing 撤销重做命令栈：create/update/delete/拖拽聚合入栈、栈上限、跨图元批量一条历史；配套测试
[阶段 4] 壳顶栏重做（[1]/01-topbar 基准）：品种按钮+徽章、周期按钮+分组菜单、布局按钮+三分屏菜单（菜单先上，
  多格渲染在阶段 8）、撤重做按钮（禁用态联动阶段 3 栈）、K线类型/告警/回放占位钮
[阶段 5] 壳图表属性大设置（[3] 基准）：tab 式（商品代码=K线样式配色/状态行=图例显隐/坐标和线条=模式下拉/
  版面=背景网格十字线），保留数据源管理与磁吸/stay/自动套用；取消/确认语义（确认才落 engine actions）
[阶段 6] 壳底部时间范围快捷条（[9] 基准）：范围→(周期,根数) 解析、与引擎 visibleRange 联动、当前激活态
[阶段 7] 壳右缘交互（[9d][9e] 基准）：滚动到最近K线钮（hover 浮现+Alt+Shift+→）+ A/L 轴钮（A 依 auto 态、L 依 log 态高亮）
[阶段 8] 壳多布局三分屏（[11] 菜单子集）：多 ChartStage 实例、每格独立品种/周期/数据源接线、布局菜单激活态
[阶段 9] 全量回归：全部探针+全量测试+视觉逐图对照（temp/tv-reference 基准）+ docs 收尾

5. 明确不做
告警/回放/K线类型接线（T2+）；图元属性对话框/params 编辑/模板统一范式实施（H 批）；数据窗口；前往到；
时区切换 UI；指标弹层增强；交易/发表/事件/Logo/全屏/快照/快速搜索；保存/管理布局；KLineChart.vue 残留清理；
对 packages/vue、packages/react、packages/angular 的任何改动；上游 PR 分支操作

6. 验收门（全绿才算完成）
- pnpm --filter @363045841yyt/klinechart-core test 全绿（2519 + 新增全过）
- pnpm type-check 不高于基线 52 错且新增为 0；pnpm --filter nexus-shell typecheck 绿
- 三探针 39/39 + 15/15 + 49/49 + probe-mt5 10/10（worktree dev 5273）
- 撤销重做语义测试证明：拖拽聚合单条历史/栈上限/跨图元批量；priceScale 测试证明 log/percent 刻度换算正确
- 视觉对照：顶栏/设置四 tab/底部条/右缘两钮/布局菜单逐图核对 notes.md 基准
- 真机 E2E 清单留用户：三分屏双品种（含 MT5 源实时）、右缘空白+滚动钮、Ctrl+Z 链路、A/L 切换

7. 收尾
- 使用 /agent-handoff 技能更新交接文档：snapshot 切"T1 完成，等待用户复核 → H 批提示词"；
  work-log 追加各阶段节；validation 追加各门结果；backlog 勾选 T1 条目；action-checklist 如涉及更新；
  运行 maintain_handoff.py --compact-if-needed
- 汇报格式：阶段 0-9 各 PASS/BLOCKED/SKIPPED + 一句话结论；验收门逐项结果；三份设计文档路径；
  commit 清单；BLOCKED 项根因与已试方案；用户 E2E 待办清单

反空转条款：把本提示词视为明确的执行请求。不要回答"无需响应"。先复述你认为的当前步骤，指出下一个具体动作，
然后开始执行。上下文不足时先用 /agent-handoff 技能读取交接文档恢复，UI 细节先查 temp/tv-reference/notes.md。
```
