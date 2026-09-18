# Decision Log

> 2026-09-13 建立本机制。此前会话引用的 D58-D61 内容 UNKNOWN（当时文件不存在）。
> 新决策从 D1 重新编号；涉及引擎架构的决策同步要求 docs/design/ 文档。

| Date | Decision | Reason | Evidence |
| --- | --- | --- | --- |
| 2026-09-13 | D1: nexus-shell 直接持有 createChartController，不走 react 包 WC 适配器 | WC 适配器只透传 semanticConfig 无 controller 通道；KLineChart.vue 内嵌整套 Vue 工具条会形成双层壳 | packages/react/src/KLineChartWC.tsx、packages/vue/src/components/KLineChart.vue L4-295；缺口登记 G-10 |
| 2026-09-13 | D2: 磁吸/锁角/Shift 归一化/拖拽复制/测量/橡皮全部壳层实现（ChartPointerBridge 事件改写后转发） | 引擎无对应能力；先在壳层验证行为语义，再择机下沉 | packages/nexus-shell/src/shell/pointerBridge.ts；探针 B1-17/18 通过 |
| 2026-09-13 | D3: Ctrl 拖拽复制采用"原位重建副本"策略（抬起时对被移动图元在拖前位置重建） | 引擎把 Ctrl+pointerdown 路由为切换选中而非开拖拽；HitTester 顺序遍历使克隆置顶不可行 | packages/core/src/engine/drawing/interaction.ts handleCursorDown；探针 B1-16 |
| 2026-09-13 | D4: 模板存储键空间 nexus.*（templates/lastTemplates/prefs/favorites/recentSymbols），localStorage 实现 | fork 规约；与 Vue 版 klinechart.drawing-templates 键隔离 | packages/nexus-shell/src/shell/storage.ts |
| 2026-09-13 | D5: 图标走 unplugin-icons raw SVG 编译 + React 包装（非 jsx 编译） | jsx 编译需 @svgr/core（工作区未引入），raw 零新增依赖 | packages/nexus-shell/vite.config.ts、src/shell/icons.tsx |
| 2026-09-13 | D6: 验收门用 playwright 探针（真实交互+引擎状态断言）替代目测截图 | 本环境无法可靠目检图片；断言可重复、可回归 | scripts/shot.mjs、probe-drawing.mjs 39/39、probe-topbar.mjs 12/12 |
| 2026-09-13 | D7: 批3/批4 SKIPPED 收工 | 质量优先于进度（任务简报明示"宁可批4 SKIPPED，批1 必须扎实"） | packages/nexus-shell/docs/action-checklist.md 批次结论 |
| 2026-09-13 | D8: 引擎下沉任务捆带范围 = G-01(磁吸)主目标 + G-04(locked) + G-06(Shift) + G-07(导出) + G-03部分(hitTestAt) + G-08(fill默认,stretch) + G-09(vue类型链,独立commit) | 全部落在 engine/drawing 同子系统或直接解除验收门阻塞；G-02/G-05 规模大单独 PR | 用户指示"能一起修的尽量放在一起"；本仓库缺口查证记录 |
| 2026-09-13 | D9: 磁吸引擎版与壳侧逐点一致（含 X 无条件吸 Bar 中心、Ctrl/Meta 覆盖 off 档为 strong），磁吸档位放 DrawingInteractionController 实例而非 StateKernel | 行为基准=壳侧探针验证实现，任何"语义优化"都会造成壳迁移行为漂移；磁吸是会话级交互配置，进 kernel 会引入 settings 侵入 | pointerBridge.applyMagnet；docs/design/drawing-interaction-hardening.md |
| 2026-09-13 | D10: G-08 不补默认 fill，改为 getBatchStyleKeys 对全通道类集合放行 fill 键 | 渲染端 fill 缺省从 stroke 派生（跟随语义）；补默认 fill 会让"改描边色后填充色不再跟随"成为视觉语义回归。通道类填充能力由 kind 固有，显式设置后才固化 | drawing/index.ts applyFillStyle；DrawingDocument.getBatchStyleKeys；fb5392de |
| 2026-09-13 | D11: G-09 修法 = root tsconfig.app.json paths 把 agent-runtime 主入口与 /contracts/ui 映射到源码（与 vite alias 同意图） | vue-tsc 不走 vite alias，落回 package exports→dist（开发 clone 永不构建）；构建 dist 作为前置会复杂化所有开发流程 | packages/vue/vite.config.ts L49；tsconfig.app.json；337→56 |
| 2026-09-15 | D12: 上游 174dcc2a 创建流重构的壳适配 = 移除 DrawingInteractionCallbacks 依赖，stay/模板自动套用改为监听 drawings 信号增量 | 上游 addDrawingAndSelect 已原子"创建+选中"，壳不再补写选中；跟随上游架构减少长期分叉 | aaa9100b（integr/upstream-sync）；packages/nexus-shell/src/shell/NexusShellContext.tsx 新建图元副作用块 |
| 2026-09-15 | D13: MT5 数据源形态 = 新建同级独立仓库连接器（Python + MetaTrader5 包 IPC 本机终端 + FastAPI 实现 V1 协议 probe/bars/instruments）+ core 侧 sources/mt5.ts Provider（仿 gotdx ~30 行） | MT5 仅能经 Python 包 IPC 本机终端读取（Node 无法直连）；V1 协议现成（docs/market-data-v1.openapi.yaml）；注册后自动获得聚合搜索/Router 流转/Agent 工具 | 用户拍板；data/provider/sources/gotdx.ts 模板；scripts/connecters.mjs |
| 2026-09-15 | D14: MT5 实时链路 = 连接器单采样循环轮询 MT5 → SSE 单连接推帧（snapshot/forming/closed/status）→ core EventSource 消费器写活动 DataBuffer | MT5 Python 包无推送回调，轮询不可避免；SSE 单向场景优于 WS 且仓内已有先例（depth/binance.ts）；浏览器轮询延迟与开销都差 | deepseek-flash + deepseek-v4-pro 双顾问一致结论；用户拍板 SSE 方向 |
| 2026-09-15 | D15: Exness 周日短棒不剔除——日内（1m-1h）原生序列偏移校正后保留，4h/1d/周/月经锚时区（传统 Europe/Athens EET-EEST、加密 UTC）重采样自然并入周一首根 | 剔除会丢失周日日内走势段；重采样使显示/指标计算/存储三层数据同源一致；"日内重采样自更细数据"与原生等价无额外收益（未来 tick 自建才引入） | 用户拍板；参考实现 resample_align；WaveTrader 16 用例 |
| 2026-09-15 | D16: Exness 对齐开关 = 连接器 env 配置（ALIGN_TZ=auto 默认检测 Exness 才对齐、EXNESS_SERVER_UTC_OFFSET 覆盖实测）+ probe 响应上报对齐状态与实测偏移；图表 UI 开关后续再加 | 配置层开关零侵入；probe 上报让宿主可见对齐状态 | 用户拍板 |
| 2026-09-15 | D17: 实时链路前置原语 = KLineDataStore 新增 updateBars（replace-on-conflict 末尾窗口合并），先补原语再接 SSE | 现状 merge() 对重复时间戳保旧弃新、updateData 是 setData 别名（全量替换）——forming bar 更新会被静默吞掉（双顾问独立核实同一定位） | kLineDataStore.ts mergeSortedData；createChartController.ts；deepseek 两级评审 |
| 2026-09-15 | D18: 提示词 B 执行层决策——① updateBars 可修订窗口固定末 2 根（REALTIME_REVISABLE_TAIL_BARS 常量）② SSE 帧协议 snapshot/forming/closed/status + 每流单调 seq（Last-Event-ID 按流重放）③ 连接器放开 CORS（本地跨源）④ 壳设置切源改为点击时探测（挂载即 probe 会给 mock 路径引入 ERR_CONNECTION_REFUSED 噪声，探针收尾门拦截）⑤ 连接器 probe 响应必须带 capabilities（SourceRouter 流转筛选依据）⑥ 连接器为用户名下独立仓库 KCQ-MT5-connector（EliteOtaku），OpenSpec 规格驱动 | ① 收线后终端缓存滞后修订落在末 1-2 根；④⑤ 为探针/冒烟实测暴露的真实约束；⑥ 用户拍板归属与命名 | probe-mt5.mjs 8/8；kLineDataStore.test.ts；app/routes.py + main.py；b234 探针修正记录；openspec validate strict 5/5 |
| 2026-09-19 | D19: 多轮 CI 修复一律在临时分支推进（fork/fix-* 或 worktree 分支），每轮 push 该分支验证，全绿后才 merge 回 nexus/main；nexus/main 的 push 通知只应出现最终绿态 | 本次 #202 合并连续 4 轮红通知轰炸用户邮箱（lock/attw/unshare 三层叠加）；中间态红是诊断推进的正常代价，但不应污染主分支通知流；library-ci 对 nexus/main 每个 push 都触发 | library-ci run 35371317589→35377416621 修复链；用户确认"可以" |
