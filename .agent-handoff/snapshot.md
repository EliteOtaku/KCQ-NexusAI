# Handoff Snapshot

## Current State

- Last updated: 2026-09-18（提示词 D 已就绪——T1 实施，等待闲时/新对话执行）
- Last agent: ZCode / GLM-5.3（多会话接力：MT5 批次、数据源统一、上游 PR #197、TV 参考采集 C、
  用户复核补图 9 张、提示词 D 撰写）
- Workspace root: `D:\AI\KCQ-NexusAI`（nexus/main = **12ca1dab** 已 push——已同步 upstream/main 188e6ce1，含上游 #202 drawing-drag-policy（locked 语义修订为"可选中不可拖"、通道拖拽策略重构、Babel8/Vite8.3/biome 工具链）；
  探针已全适配（39/15/50）；**PR #197 已被上游合并**（integrate/pr197→main，含增强 4003be0c）；
  连接器仓库 KCQ-MT5-connector main = 5c796de；上游三个 issue #205/#206/#207 开发组将逐步改进）
- Current objective: **T1 转向开发组实施——需求单已产出（temp/tv-reference/T1-requirements.md）交用户转交；提示词 D 挂起**（开发组未覆盖的壳侧剩余部分仍可按 D 执行）
- Current status: 提示词 C 完成 + 用户复核完成（补图 9 张）；2026-09-18 晚计划转向：开发组可接需求单，即将推送新代码到主分支
- Current status: 提示词 C 完成 + 用户复核完成（用户补图 9 张闭环：空白/图元右键菜单 [4a][4b]、
  fib 属性对话框 [4c]、模板下拉展开与删除 [3h][3i]、滚动钮 [9d][9d2]、A/L 轴钮 [9e]）——
  参考库基准闭环；用户拍板"模板管理统一范式可照搬"（H 批实施约束）
- Immediate next actions:
  1. **等开发组推送主分支后：nexus/main 同步 upstream/main**（backlog 既有条目），逐条比对
     gap-analysis A-F 域重估 T1 剩余范围；需求单（T1-requirements.md）已交开发组，
     其未覆盖部分再决定是否恢复提示词 D（全文仍在本文件所引 AGENT_SESSION_PROMPTS.md）。
  2. （挂起）提示词 D 若需自主实施壳侧剩余部分可直接启用。
  2. D 完成复核后写 **H 批提示词**（图元属性对话框/params schema 编辑/模板统一范式组件——
     gap-analysis H 域 + backlog H 批条目已含全部基准与范围建议）。
  3. MT5 真机 E2E 用户持续进行（`pnpm connector mt5`）；上游 PR #197 等 review。
- Active files:
  - 提示词 D 全文：`AGENT_SESSION_PROMPTS.md`（提示词 D 节）
  - UI 基准库：`temp/tv-reference/`（notes.md 控件级基准 + gap-analysis.md 范围 SSOT + 40 张截图；gitignore 内不入库）
  - 探针命令与基线：`.agent-handoff/validation.md`（probe-drawing 39 / probe-topbar 15 / probe-b234 49 / probe-mt5 10）
- Blockers: 无
- Open questions:
  - 无阻塞项；三分屏每格数据源接线若与现有 shell 状态模型冲突，按"每格独立品种/周期为准、
    实现方式由执行者依 StateKernel 模式设计"处理（已写入提示词 D）

## T1 范围速览（细节以提示词 D 与 gap-analysis A-F 域为准）

- 纯壳层：顶栏形态重做（K线类型/告警/回放仅占位钮不接线）、大设置 tab 式（商品代码/状态行/坐标和线条/版面，
  保留数据源管理与磁吸/stay/自动套用）、底部时间范围快捷条（1天~全部 9 档联动）、右缘两钮、三分屏布局菜单
  （s/2h/2v/3h/3v/2-1/1-2，每格独立品种/周期）
- 需引擎扩展：①priceScale log/percent/auto ②viewport trailing 空白 + timeAxis 未来刻度外推 + 命中延伸
  ③drawing 撤销重做命令栈（DrawingDocument 既有原语之上做 command 包装，禁改原语语义）
- 拍板交互形态：A/L 轴钮 hover 浮现（对数不能埋深）、滚动到最近K线钮（» + Alt+Shift+→）、
  撤重做按钮禁用态 + Ctrl+Z / Ctrl+Y
- 不做：告警/回放/K线类型接线（T2+）、H 批全部（图元属性/params/模板统一范式实施）、数据窗口、前往到、
  时区 UI、交易/发表/事件/Logo/保存管理布局；packages/vue 等其他包零改动

## Recovery Summary

- 上游 PR #197：updateBars 实时原语 + MT5 数据源 + probe message 透传；分支基于 upstream/main
  e4b6fdfe（import 已 .js 后缀化——仅上游 PR 分支沿用；nexus/main 内部以所在文件现状为准）；全量 core 2519 绿。
- KCQ 现状基准：TopBar 60 行简版 / SettingsDialog 121 行壳偏好 / DrawingToolbar 18 工具 / periods 8 档 /
  图元右键菜单 3+3 项；文案集中在 shell/labels.ts；引擎 alerts/replay/chartTypes 未接壳。
- 端口约定：5173=cloudtradeagent WebUI（勿动）、5175=KCQ Vue preview、5273=nexus-shell dev、8090=MT5。
- 交互根因备忘（若需再上 TV 采集）：gopro 推广浮层用 MutationObserver 自动移除后合成事件全面可用；
  匿名绘图功能整体锁定（升级墙）、右键不可达——详见 notes.md 执行差异节与附 A 锁定域清单。
- 09-16 遗留规划仍有效：业务 overlay 搬家（闭源侧）、agent 面板设计、引擎契约缺陷 [pr] 候选
  （removeIndicator 'main:*' 寻址 / scrollToDataIndex）——见 backlog。
- Replace this current-state snapshot on update; do not append prior snapshots here.
