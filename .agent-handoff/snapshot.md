# Handoff Snapshot

## Current State

- Last updated: 2026-09-18（TV 对齐批次拍板完毕，提示词 C 已就绪待闲时执行）
- Last agent: ZCode / GLM-5.3（多会话接力：MT5 批次实施与收尾、数据源管理统一化、
  上游 PR #197、端口混乱修复、TV 对齐评估与拍板）
- Workspace root: `D:\AI\KCQ-NexusAI`（nexus/main = **d437ef25**，已 push origin；
  上游 PR **#197**（363045841/KLineChartQuant，分支 EliteOtaku:pr/mt5-source）待上游 review；
  连接器仓库 KCQ-MT5-connector main = 5c796de 已推 GitHub）
- Current objective: **执行 AGENT_SESSION_PROMPTS.md 提示词 C（TradingView 界面参考采集）**
- Current status: validated（MT5 真机链路已通：连接器 :8090 在线、用户已在 :5175 看到聚合源管理含 MT5）
- Immediate next actions:
  1. **执行提示词 C**（本文件尾部"提示词 C 上下文要点"节 + AGENT_SESSION_PROMPTS.md 提示词 C 全文）。
     产出 `temp/tv-reference/`（截图 + notes.md + gap-analysis.md），完成后停下等用户复核。
  2. 用户复核参考库后 → 写提示词 D（T1 实施）。
  3. MT5 真机 E2E 由用户持续进行（连接器启动命令已改为 `pnpm connector mt5`，正拼；旧拼法保留兼容）。
  4. 上游 PR #197 等待 review；若上游 main 再前进，rebase 或 merge upstream/main 到 pr/mt5-source。
- Active files:
  - 提示词 C 全文：`AGENT_SESSION_PROMPTS.md`（提示词 C 节）
  - 参考库产出目录：`temp/tv-reference/`（gitignore 内，不存在则创建）
  - T1 范围定义：`.agent-handoff/backlog.md` "TV 对齐批次"条目
- Blockers: 无
- Open questions:
  - 无阻塞项；多布局（三分屏）与右缘光标扩展的需求细节在提示词 D 前与用户确认即可

## 提示词 C 上下文要点（执行者必读）

- **端口约定**：5173=cloudtradeagent WebUI（勿动）、5175=KCQ Vue preview（strictPort）、
  5273=nexus-shell dev、8090=MT5-Connecter。历史教训：KCQ preview 旧进程曾占 5173 数日造成
  "MT5 不可见"假象——本任务**不需要**起任何 dev server（只采集 TV 参考，不改代码）。
- **TV 采集红线**（用户拍板）：不登录（免费未登录态）、人工速度浏览、页面数 <30、
  界面切中文（zh，与 KCQ 中文 UI 对齐）、不抓行情数据接口、不复制 CSS/SVG/图标资产——
  产出的是布局结构认知与功能清单，不是资产拷贝。
- **采集范围**（详见提示词 C）：顶栏、绘图工具栏（含展开态）、图表属性对话框逐 tab、
  右键菜单、对象树、数据窗口、告警面板、回放控制条、周期条、搜索/比较弹层、布局入口。
  免费版不可见域（3+ 格布局等）如实标注 UNAVAILABLE。
- **T1 实施范围（提示词 D 用，本任务不实施）**：顶栏形态重做 + 图表属性大设置
  （含对数/百分比/自动缩放）+ 撤销重做（先绘图域）+ 底部周期条 + **右缘空白扩展**
  （光标越过最新 K 线 + 外推时间/价格信息，用户明确短板）+ **多布局上限三分屏**
  （每格独立品种）。

## Recovery Summary

- 上游 PR #197：updateBars 实时原语 + MT5 数据源 + probe message 透传；分支基于 upstream/main
  e4b6fdfe（import 已 .js 后缀化——后续 PR 分支改动必须沿用 .js 后缀风格）；全量 core 2519 绿。
- 连接器仓库 `D:\AI\KCQ-MT5-connector`：OpenSpec 五规格 + AGENTS.md + MIT；probe message
  现承载对齐摘要（在线）/诊断原因（离线），前端聚合源管理直接展示。
- 数据源管理：Vue 聚合源管理与 nexus-shell SourceManagerDialog 同构（状态/开关/地址/设为当前）；
  壳 dataSource 已泛化为任意 sourceId。
- 端口事故教训与全部实现坑（探针 Promise 谓词、SSE 测试裸 ASGI、SourceRouter 依赖
  probe capabilities、vue-tsc 走 dist 等）见 work-log 2026-09-15~18 各节。
- 09-16 会话（消费方核验）遗留的规划仍有效：业务 overlay 搬家（闭源侧主导）、agent 面板
  设计（分析数据=后端 API 直读 + 图表操控=MCP 桥）、引擎契约缺陷 [pr] 候选
  （removeIndicator 'main:*' 寻址 / scrollToDataIndex）——见 backlog。
- Replace this current-state snapshot on update; do not append prior snapshots here.
