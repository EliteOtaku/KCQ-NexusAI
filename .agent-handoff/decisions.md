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
