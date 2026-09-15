# Handoff Snapshot

## Current State

- Last updated: 2026-09-14（批2 收尾 + 批3/批4 会话）
- Last agent: ZCode / GLM-5.3（cloudtradeagent 主线交接的批2 收尾 + 批3/批4 实施）
- Workspace root: `D:\AI\KCQ-NexusAI`（nexus/main = f25207ed，已 push；实施在 worktree `D:\AI\KCQ-NexusAI-batches` 的 shell/b2-b4 分支）
- Current objective: 批2 剩余 + 批3 + 批4 全部落地（B2-03/04/06、B3-01/02/03、B4-01..05）；B2-05 十字线数据窗仍为 stretch 未做
- Current status: validated（probe-b234 49/49 + probe-drawing 39/39 + probe-topbar 15/15 + shell typecheck 绿）
- Immediate next actions:
  - 引擎契约缺陷 [pr] 候选（已入 backlog）：removeIndicator/updateIndicatorParams 不接受 addIndicator 返回的 'main:*' 实例 id（按 displayName 寻址）；scrollToDataIndex 不存在（简报误引）
  - 整线拖拽吸附（delta→snap 语义待定义 + 查证 TV）
  - 测试文件类型债专项（root type-check 56 错基线存量）
- Active files:
  - `packages/nexus-shell/src/components/LegendBar.tsx`（图例栏：name↔definitionId 匹配、眼睛 stash、参数编辑器）
  - `packages/nexus-shell/src/shell/NexusShellContext.tsx`（键盘路由 + symbolPickerRequest/shortcutsVisible + setMagnet + drawings 暴露）
  - `packages/nexus-shell/docs/action-checklist.md`（B1 全过 / B2 除 stretch 全过 / B3 全过 / B4 全过）
- Blockers: 无
- Open questions:
  - 用户决定：handoff 机制文件是否以 [fork] chore 提交入库（仍为未跟踪；worktree 实施时需回主工作区查阅）

## Recovery Summary

- 本批 7 commit（220a6ef9..70d4833b）no-ff merge f25207ed push origin/nexus/main；新增 8 组件 + periods.ts + probe-b234.mjs（49 断言）
- 图例：canvas 图例关闭（updateRendererConfig），LegendBar 行1 = 品种/周期/OHLC/量（currentBar 十字线联动、无十字线回退 legend.bar），指标行按 name↔definitionId 匹配（引擎行序不稳定，禁止按序拉链）
- 引擎契约注意：indicators 公开信号丢弃 source 字段（mode 实例按 id 'mode:' 前缀过滤）；removeIndicator/updateIndicatorParams 主图按 definitionId 寻址（壳侧已绕，归一化待 [pr]）；currentBar 仅十字线时非空
- 键盘：字母→搜索（请求经 context nonce）、1-9→周期、?→快捷表、↑/↓→tick nudge（MockSymbol.tick 0.2/0.01/0.001）；持久化 nexus.panel/nexus.theme 补齐
- Replace this current-state snapshot on update; do not append prior snapshots here.


