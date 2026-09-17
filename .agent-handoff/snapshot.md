# Handoff Snapshot

## Current State

- Last updated: 2026-09-16（cloudtradeagent 消费方主线核验本仓批1-4+MT5 集成；
  **下一阶段定案：MT5 真机 E2E（用户）→ 上游 PR 批次整理 → 业务 overlay 搬家
  （闭源侧主导）→ agent 面板**；壳 checklist 除 stretch 项外全部收尾）
- Last agent: ZCode / GLM-5.3（多个会话：批次任务 b1/b2、b2 收尾+批3/4、
  MT5 提示词 B、MT5 收尾改名+OpenSpec；消费方主线核验与状态同步）
- Workspace root: `D:\AI\KCQ-NexusAI`（nexus/main = **e0425948**，MT5 批次 9 commits 已 no-ff merge 并 push origin；worktree fork/mt5-source 分支保留）
- Current objective: 用户真机测试 MT5（几天窗口）→ 通过后再议上游 PR；空闲任务见 backlog
- Current status: validated（全验收门绿 + merge 后主工作区 MT5 相关 18/18 复验）
- Immediate next actions:
  - **用户执行真机 E2E**：`pnpm setup`（克隆 https://github.com/EliteOtaku/KCQ-MT5-connector 到同级目录）→ `pnpm connecter mt5`（Windows + Exness 终端已登录）→ 壳设置切 MT5 → 搜索 XAUUSD → forming 实时刷新 / 日线与 4h 无周日棒 / probe 上报对齐状态
  - **上游 PR 批次整理与提交**（等 MT5 测试通过后与 MT5 批一起提，避免 review 炸弹）：
    a) 绘图交互强化批（nexus/main 历史中的 [pr] commits：磁吸下沉/locked 强制/
       Shift+click 多选/hitTestAt 公开/批量 fill 编辑——需 cherry-pick 到 pr/ 分支）；
    b) MT5 数据源批（core updateBars/mt5 Provider/SSE 消费器+连接器引用说明）；
    c) 已推分支：pr/4h-period、pr/source-registration、pr/drawing-templates
  - **业务 overlay 搬家批次（闭源侧 cloudtradeagent 主导，本仓配合）**：
    SMC 策略/期权关键位+AI 射线/量分布三 renderer plugin 从闭源 worktree
    `D:\AI\cloudtradeagent-vela\webuirontend\src\kcq\` 移植进 route-A 页；
    本仓职责=引擎 API 配合（如缺公开口子另立 [pr]）
  - **agent 面板设计**（用户战略需求）：通路①分析数据=后端 API 直读（与引擎
    解耦）；通路②图表操控=MCP 桥（cloudtradeagent 侧 kcq-mcp-server.mjs 已
    验证 4 工具全 success）+执行器映射 controller API
  - 引擎契约缺陷 [pr] 候选：removeIndicator/updateIndicatorParams 不接受 'main:*'
    实例 id；scrollToDataIndex 不存在（对象树滚动定位被阻）
    **（09-16 用户拍板：等 MT5 真机 E2E 通过后随大礼包一并提交，勿提前）**
  - 壳尾项：B2-05 十字线数据窗（stretch）；B3-02 网格/坐标轴设置；B2-06 轴菜单
    （stretch）；测试文件类型债专项（root type-check 基线 52 存量）
  - 上游 main 快进包含 #174 后：nexus/main 常规同步（预期零冲突）
- Active files:
  - 连接器仓库：`D:\AI\KCQ-MT5-connector`（app/ 10 模块 + tests 34 用例 + openspec/ 五能力规格 strict 全绿 + AGENTS.md；**已发布 https://github.com/EliteOtaku/KCQ-MT5-connector（PUBLIC，MIT），main 已推**）
  - KCQ 侧（已入 nexus/main）：core data/{buffer/kLineDataStore,live/mt5BarsLive,provider/sources/mt5}、controllers/types+index、engine/{chart,chartDataManager}；nexus-shell {NexusShellContext,SettingsDialog,SymbolPicker,storage,labels,shell.css,scripts/{probe-mt5,stub-mt5-server}}
  - 文档：docs/data-sources/mt5.zh-CN.md、docs/design/mt5-exness-alignment.md
- Blockers: 无
- Open questions:
  - 用户决定：handoff 机制文件是否继续入库跟踪（当前已 tracked，本节与 decisions/risks 等存在未提交更新）

## Recovery Summary

- MT5 批次已收编 nexus/main 并 push（e0425948）。连接器为用户名下独立仓库 **KCQ-MT5-connector**；KCQ 全部引用（connecters/setup-backends/sourceRegistry/docs）已同步新名。
- 验收门全绿：连接器 pytest 34/34；core vitest 2509/2509；nexus-shell typecheck 绿；root type-check 52=基线；三探针 39/15/49 + probe-mt5 8/8（桩连接器全链路含断流）。
- ⚠️ 事故记录：收尾时误 `rm -rf` 删除连接器旧目录（MT5-Connecter），已凭会话上下文逐文件重建并 pytest 34/34 验证等价；旧 git 历史未还原（新仓 2 commits 起新史）。另 `git reset --hard` 曾把已入库的 handoff 文件未提交更新退回旧版，已全部恢复。教训：删/移目录前先清进程占用；reset --hard 前必查工作区未提交改动。
- OpenSpec：连接器仓 openspec/ 五能力规格（REST/SSE 流/对齐/网关/品种目录）`openspec validate --all --strict` 全绿；AGENTS.md 固化约定；改行为先改规格。
- updateBars 原语（D17/D18）：KLineDataStore replace-on-conflict 末 2 根窗口合并、陈旧拒绝、批原子写；DataBuffer→ChartDataManager→Chart→ChartController 全链暴露
- 壳接线：设置"数据源"段（点击时才 probe——挂载探测会给 mock 路径引入网络噪声）；MT5 模式 SymbolPicker 走 searchInstruments；setSymbols fetcher 管线 + SSE live（品种/周期变化重连）
- 关键坑（已固化 work-log）：探针谓词 Promise 比较、TestClient 不支持无限 SSE（裸 ASGI 测法 + receive 桩必须阻塞）、SourceRouter 依赖 probe capabilities、vue-tsc 走 dist（worktree 需重建 dist 再对基线）、pandas 2.x tz-aware 毫秒取法
- Replace this current-state snapshot on update; do not append prior snapshots here.
