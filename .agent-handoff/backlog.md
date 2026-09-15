# Task Backlog

- [x] 批2 收尾 + 批3/批4（2026-09-14 完成，f25207ed 已合入 nexus/main：B2-03/04/06、B3-01/02/03、B4-01..05 全过门；B2-05 十字线数据窗 stretch 未做，B3-02 网格/坐标轴未做）
- [ ] 引擎指标寻址归一（[pr] 候选，2026-09-14 发现）：removeIndicator/updateIndicatorParams 不接受 addIndicator 返回的 'main:*' 实例 id，只按 displayName 寻址——壳侧已按 definitionId 绕开，引擎层应兼容双寻址
- [ ] 引擎补 scrollToDataIndex 公开 API（对象树滚动定位用；cloudtradeagent 简报误引为已有）
- [ ] 整线拖拽吸附（2026-09-14 登记，编辑路径磁吸后续）：水平线/垂直线整线拖拽时价格/时间吸附——delta→snap 语义需先定义（吸到指针所在 Bar 的 OHLC？），且需查证 TV 实际行为；另立 [pr]
- [ ] 测试文件类型债专项：root type-check 剩余 56 错（基线存量，stateComposer.test 36 + 零星），建议独立 [pr] 分支清理
- [ ] B2-05 十字线数据窗（stretch，未做）
- [ ] G-05 FVG 绘图：需扩展引擎 DrawingKind 封闭联合 + 定义 + 渲染，独立 PR（规模大，先与仓库 owner 对接）
- [ ] G-02 测量工具若要引擎化：参照 range-selection 的引擎模式（startRangeSelection 等）另立 PR；当前壳层实现已够用
- [ ] 用户决定：本 handoff 机制文件（AGENT_HANDOFF.md/.agent-handoff/）是否以 [fork] chore 提交入库（当前为未跟踪文件）
