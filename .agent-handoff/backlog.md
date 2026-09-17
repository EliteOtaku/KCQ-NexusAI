# Task Backlog

- [x] 批2 收尾 + 批3/批4（2026-09-14 完成，f25207ed 已合入 nexus/main：B2-03/04/06、B3-01/02/03、B4-01..05 全过门；B2-05 十字线数据窗 stretch 未做，B3-02 网格/坐标轴未做）
- [x] 上游 PR #174 已被上游合并（2026-09-15，f730530a，integrate/pr174 分支；upstream/main 快进后 fork 侧常规同步即可）
- [x] MT5 本地数据源接入（2026-09-15 提示词 B 执行完成并已 merge push nexus/main=e0425948）：连接器独立仓 D:\AI\KCQ-MT5-connector（pytest 34/34 + OpenSpec 五规格 strict 全绿）+ core updateBars/mt5 Provider/SSE 消费器（vitest 2509 绿）+ nexus-shell 接线（typecheck 绿 + 三探针 39/15/49 + probe-mt5 8/8）
- [ ] MT5 真机 E2E（用户执行）：Windows + Exness 终端已登录 → 连接器放同级目录 → `pnpm connecter mt5` → 壳切 MT5 源 → forming 实时刷新 / 日线与 4h 无周日棒 / probe 上报对齐状态
- [x] 连接器 GitHub 建仓并推送（2026-09-15，https://github.com/EliteOtaku/KCQ-MT5-connector，PUBLIC，main 已推）；`pnpm setup` 克隆链路已可用
- [ ] 用户测试通过后再议：MT5 相关 core 改动是否回传上游 PR
- [ ] 上游 main 快进包含 #174 后：nexus/main 常规同步（预期无内容冲突，历史已共享）
- [ ] 引擎指标寻址归一（[pr] 候选，2026-09-14 发现）：removeIndicator/updateIndicatorParams 不接受 addIndicator 返回的 'main:*' 实例 id，只按 displayName 寻址——壳侧已按 definitionId 绕开，引擎层应兼容双寻址（09-16 拍板：随 MT5 后大礼包一并提交）
- [ ] 引擎补 scrollToDataIndex 公开 API（对象树滚动定位用；cloudtradeagent 简报误引为已有；09-16 拍板随大礼包一并提交）
- [ ] 整线拖拽吸附（2026-09-14 登记，编辑路径磁吸后续）：水平线/垂直线整线拖拽时价格/时间吸附——delta→snap 语义需先定义（吸到指针所在 Bar 的 OHLC？），且需查证 TV 实际行为；另立 [pr]
- [ ] 测试文件类型债专项：root type-check 剩余 52 错（基线存量，stateComposer.test 36 + 零星），建议独立 [pr] 分支清理
- [ ] B2-05 十字线数据窗（stretch，未做）
- [ ] G-05 FVG 绘图：需扩展引擎 DrawingKind 封闭联合 + 定义 + 渲染，独立 PR（规模大，先与仓库 owner 对接）
- [ ] G-02 测量工具若要引擎化：参照 range-selection 的引擎模式（startRangeSelection 等）另立 PR；当前壳层实现已够用
- [ ] 用户决定：本 handoff 机制文件（AGENT_HANDOFF.md/.agent-handoff/）保持入库跟踪（曾于 aaa9100b 意外收编入公开 fork，risks.md 有记录）
- [ ] 业务 overlay 搬家批次（2026-09-16 规划，闭源侧 cloudtradeagent 主导）：SMC 策略/期权关键位+AI 射线/量分布三 renderer plugin 从闭源 worktree（webui/frontend/src/kcq/，headless 版已在跑）移植进 route-A 页；本仓配合引擎 API（缺公开口子另立 [pr]）；搬完旧 TV charting_library 退役
- [ ] 上游 PR 批次整理（等 MT5 真机测试后提交）：a) 绘图交互强化批（nexus/main 历史 [pr] commits cherry-pick 到 pr/ 分支：磁吸下沉/locked/Shift+click 多选/hitTestAt/批量 fill）b) MT5 数据源批 c) 已推分支 pr/4h-period、pr/source-registration、pr/drawing-templates
- [ ] AI 射线标签右对齐（闭源侧 overlay，用户已提；小活）
