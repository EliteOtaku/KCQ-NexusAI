# Workspace Map

## Repository Structure

- `packages/core`: 图表引擎（`@363045841yyt/klinechart-core`），绘图子系统在 `src/engine/drawing/`
- `packages/vue`: Vue 适配器 + 内嵌工具条的 KLineChart.vue（`@363045841yyt/klinechart`）
- `packages/react`: React→WebComponent 适配器（仅透传 semanticConfig，无 controller 通道）
- `packages/nexus-shell`: fork-only React 仿 TV 壳（永不发布），直接持有 createChartController
- `packages/agent-runtime`: 当前 Agent 运行时（ai-runtime 已废弃不维护）
- `scripts/shot.mjs`: playwright-core + 系统 Chrome 截图/探针公共启动器
- `D:\AI\KCQ-NexusAI-batches`: 批次 worktree（shell/bN-* 分支干活，过门后合回主工作区 nexus/main）

## Main Entry Points

- `packages/core/src/controllers/createChartController.ts`: 引擎唯一挂载工厂（自建 DOM 脚手架）
- `packages/core/src/controllers/types.ts`: ChartController / DrawingChartAdapter 契约
- `packages/nexus-shell/src/shell/NexusShellContext.tsx`: 壳级状态枢纽

## Test Entry Points

- `pnpm test:unit`: 根测试（不含 packages）
- `pnpm --filter @363045841yyt/klinechart-core test`: 引擎单测（vitest run）
- `pnpm test:packages`: 全 workspace 包测试
- `pnpm type-check`: vue-tsc --build（当前被 G-09 阻塞，见 risks）
- 探针（需先 `pnpm --filter nexus-shell dev`，端口 5273）：
  - `node packages/nexus-shell/scripts/probe-drawing.mjs`（39 断言）
  - `node packages/nexus-shell/scripts/probe-topbar.mjs`（12 断言）

## Docs And Specs

- `packages/nexus-shell/docs/action-checklist.md`: TV 动作清单 + 引擎缺口 G-01..G-10
- `docs/design/`: 核心引擎改动的设计决策文档（AGENTS.md 强制要求）
- `docs/rendering-pipeline.md`: 渲染管线 SSOT
- 活规格：http://127.0.0.1:8888/（泄露版 TV，只看不改）

## Durable Project Context

- 分支纪律：fork 壳改动 `[fork]` 前缀；可上游化的通用修复走 `pr/*` 分支 `[pr]` 前缀（先例：pr/4h-period、pr/drawing-templates）；两者都最终合入 nexus/main，不 push 上游
- mock 数据自持：壳用确定性种子生成器（`packages/nexus-shell/src/shell/mockData.ts`）；'mock' 市场会话必须在挂载时经 `marketSessions` 注册，否则抛 "Market session is not registered"
- Node ^20.19 || >=22.12，pnpm 11.x；TZ 敏感测试设 `TZ=Asia/Shanghai`

## Project Conventions

- 注释中文、文件头注释、函数注释；单行用 `//`
- 错误码从 `packages/core/src/errors.ts` 具名常量引用，append-only
- 颜色收归 `packages/core/src/foundation/tokens`；壳内颜色走 `packages/nexus-shell/src/styles/tokens.css`
- 禁硬编码字符串（文案进 labels/常量）；禁脆弱 MOCK；禁无意义回退逻辑
- 提交信息用 commit-message-generator 技能（`.opencode/skills/commit/SKILL.md`）；仅用户明确要求时才 commit
