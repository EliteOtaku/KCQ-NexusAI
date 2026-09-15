# Validation History

| Date | Command/Check | Result | Notes |
| --- | --- | --- | --- |
| 2026-09-13 | `pnpm --filter nexus-shell typecheck` | passed | 批1/批2 终态均绿 |
| 2026-09-13 | `node packages/nexus-shell/scripts/probe-drawing.mjs` | passed | 39/39，连续两次运行稳定（批2 后回归仍 39/39） |
| 2026-09-13 | `node packages/nexus-shell/scripts/probe-topbar.mjs` | passed | 12/12 |
| 2026-09-13 | `pnpm test:packages` | passed | vue 112 + react 2 全绿（worktree shell/b1-drawing） |
| 2026-09-13 | `pnpm type-check` | failed | G-09 存量报错，nexus/main 干净工作区同样复现，非壳分支引入 |
| 2026-09-13 | 引擎磁吸聚焦诊断（temp/diag8/diag9.mjs） | passed | strong 吸附命中 bar.high（3815.4 vs 3816.85，y↔price 往返约 1.5 单位损耗属引擎坐标精度，断言容差 3） |
| 2026-09-13 | 8888 活规格可达性 | passed | HTTP 200（截图归档 temp/shots/tv-spec-8888.png） |
| 2026-09-13 | 引擎硬化：`pnpm --filter @363045841yyt/klinechart-core test`（worktree pr/engine-drawing-hardening） | passed | 217 文件 / 2465 测试全绿（含新增 magnetSnapper 13 + interaction.magnet 7 + interaction.locked 3 + hitTestAt 2 + toolConfig.exports 2 + DrawingDocument fill 1 + selection Shift 2） |
| 2026-09-13 | 引擎硬化：`pnpm test:packages`（worktree） | passed | core/vue/react/angular/agent-runtime/ai-runtime/ui-schema 全绿，无 failed |
| 2026-09-13 | 引擎硬化：`pnpm type-check`（worktree） | partial | 337→56：features/agent 27 文件类型链清零（G-09 解除，含 use-agent-workspace L79/L92 隐式 any）；剩余 56 为基线同样存在的测试文件存量债（stateComposer 36 等，与 agent/drawing 改动无关），建议专项清理 |
| 2026-09-13 | 引擎硬化：`node packages/nexus-shell/scripts/probe-drawing.mjs`（worktree dev 5273） | passed | 39/39——引擎改动对壳行为零回归（磁吸仍走壳侧实现，正是本门目的） |
| 2026-09-14 | 壳迁移：`pnpm --filter @363045841yyt/klinechart-core test`（worktree fork/shell-engine-magnet-migration，[0] 后） | passed | 217 文件 / 2466 测试全绿（新增 interaction.magnet Shift 互斥用例：Shift 不吸附 + Shift+Ctrl 抑制升级） |
| 2026-09-14 | 壳迁移：`pnpm --filter nexus-shell typecheck`（[1]/[2]/[3] 各提交后） | passed | tsc --noEmit 每次均绿 |
| 2026-09-14 | 壳迁移：`node packages/nexus-shell/scripts/probe-drawing.mjs`（worktree dev 5273） | passed | 39/39——磁吸已走引擎 setMagnetMode（B1-18 吸附 bar.high 容差内）、B1-11 Shift 多选走引擎原生、B1-23 橡皮擦走 hitTestAt、无页面错误 |
| 2026-09-14 | Ctrl 取反：`pnpm --filter @363045841yyt/klinechart-core test`（worktree fork/engine-ctrl-magnet-invert） | passed | 217 文件 / 2468 测试全绿（取反三态用例：off+Ctrl 临时 strong 吸附、weak/strong+Ctrl 不吸附） |
| 2026-09-14 | Ctrl 取反：`node packages/nexus-shell/scripts/probe-drawing.mjs`（worktree dev 5273） | passed | 39/39——探针无"绘图工具+Ctrl"场景，零回归符合预期 |
| 2026-09-14 | 编辑路径磁吸：`pnpm --filter @363045841yyt/klinechart-core test`（worktree fork/engine-drag-anchor-magnet） | passed | 218 文件 / 2473 测试全绿（净增 5：dragHandler.magnet 3 + interaction 编辑路径 2） |
| 2026-09-14 | 编辑路径磁吸：`node packages/nexus-shell/scripts/probe-drawing.mjs`（worktree dev 5273） | passed | 39/39——B1-01 整线拖拽不受影响（设计如此），无页面错误 |
| 2026-09-14 | 批2收尾+批3/4：`pnpm --filter nexus-shell typecheck`（shell/b2-b4 各提交后） | passed | 每项提交后均绿 |
| 2026-09-14 | 批2收尾+批3/4：`node packages/nexus-shell/scripts/probe-b234.mjs`（新增，worktree dev 5273） | passed | 49/49——B2-03/04 图例栏（眼睛 stash 恢复/参数写回/删除）、B2-06 双菜单、B3-01/02/03、B4-01..05 全覆盖 |
| 2026-09-14 | 批2收尾+批3/4：`node packages/nexus-shell/scripts/probe-drawing.mjs` | passed | 39/39 回归（B1-27 选择器改 --templates 稳定类） |
| 2026-09-14 | 批2收尾+批3/4：`node packages/nexus-shell/scripts/probe-topbar.mjs` | passed | 15/15（B2-03 改 DOM 图例断言 + 最近使用分组加 waitFor） |
| 2026-09-14 | 批2收尾+批3/4：截图归档 temp/shots/b234-legend.png、b234-panels.png | done | 图例栏与面板/键盘终态 |
| 2026-09-15 | MT5: `uv run pytest`（连接器仓 KCQ-MT5-connector） | passed | 34/34——对齐（冬夏/DST/周月锚/偏移）+ ChangeDetector + StreamHub + 路由（FakeGateway），无需终端；目录重建后复验同结果 |
| 2026-09-15 | MT5: `pnpm --filter @363045841yyt/klinechart-core test`（worktree fork/mt5-source） | passed | 222 文件 / 2509 测试全绿（基线 2491 + updateBars 8 + mt5 provider 3 + live 7） |
| 2026-09-15 | MT5: `pnpm --filter nexus-shell typecheck`（shell 接线后） | passed | tsc --noEmit 绿 |
| 2026-09-15 | MT5: `pnpm type-check`（worktree） | passed | 52 错 = 主工作区基线；曾现 +5 假错误系 worktree core dist 陈旧（vue-tsc 走 exports→dist），重建 dist 后归位 |
| 2026-09-15 | MT5: `node packages/nexus-shell/scripts/probe-{drawing,topbar,b234}.mjs`（worktree dev 5273） | passed | 39/39 + 15/15 + 49/49——mock 路径零回归（挂载即 probe 曾致 b234 收尾门 3×ERR_CONNECTION_REFUSED，改为点击时探测后修复） |
| 2026-09-15 | MT5: `node packages/nexus-shell/scripts/probe-mt5.mjs`（新增，桩连接器 :8090） | passed | 8/8——切源（probe 门控+持久化）/跨源搜索/fetcher 历史 60 根/SSE forming 写末根（close 2600.5）/切回 Mock 断流/无页面错误 |
| 2026-09-15 | MT5: updateBars 语义防线（kLineDataStore.test.ts） | passed | 8/8——forming 同 ts 替换（不被 merge 保旧弃新吞掉）、末 2 根窗口外陈旧拒绝且不发信号、closed+forming 单信号原子写 |
| 2026-09-15 | MT5: `npx @fission-ai/openspec validate --all --strict`（连接器仓） | passed | 5/5 规格 strict 全绿（REST 协议/SSE 流/Exness 对齐/终端网关/品种目录） |
| 2026-09-15 | MT5: merge 后主工作区复验（nexus/main=e0425948） | passed | mt5.test + mt5Live.test + kLineDataStore.test 共 18/18 绿 |
