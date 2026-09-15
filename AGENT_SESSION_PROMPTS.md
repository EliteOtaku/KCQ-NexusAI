# Agent Session Prompts

> 闲时任务提示词。每条提示词自包含：执行代理无需会话历史即可运行。
> 通用前置：先读 `AGENT_HANDOFF.md` → `.agent-handoff/snapshot.md` → `.agent-handoff/risks.md` → `.agent-handoff/backlog.md`。

---

## 提示词 A：nexus-shell 磁吸迁移到引擎 API（fork 壳侧收编）

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
