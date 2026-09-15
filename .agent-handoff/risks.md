# Risks, Blockers, And Unknowns

## Current Blockers

- 无。

## Current Risks

- root `pnpm type-check` 仍有 52-56 个错误：全部为基线同样存在的**测试文件存量类型债**（tsconfig.vitest 项目；stateComposer.test 36 个 + drawing/core/react 测试零星隐式 any/强转 + react WC 子路径 dist 解析），非 agent 链、非历批引入。建议专项 [pr] 清理，修一半不如整体登记。
- 引擎磁吸语义基准固化在 docs/design/drawing-interaction-hardening.md：weak 8px 吸 high/low、strong 15px 吸 OHLC、X 吸 Bar 中心（与 Y 命中无关）、Ctrl/Meta **取反**（off→临时 strong 开、on→临时关，对齐 TV 官方 Magnet Mode 文档，2026-09-14 修正）、Shift 一律不吸附（2026-09-14 起，与宿主锁角互斥；单锚点工具按 Shift 亦不吸附——相对旧壳行为为有意收口，探针无此场景断言）。任何参数改动都需先改该文档。
- resolveDrawingPointer 是 cursor 命中/标签/绘图落点共用路径：磁吸已按可选参数接入（不传即不吸附），后续任何新调用方必须评估是否属于绘图落点路径再决定传参。
- MT5 连接器与 KCQ 主仓为两个独立仓库：真机问题需先分辨归属（对齐/轮询/帧协议在连接器仓，消费接线在 KCQ 仓）；连接器 GitHub 未建仓前 `pnpm setup` 克隆不可用，需手动放置同级目录。
- 壳侧仍保留的 TV 习惯实现：Shift 锁角 45°（applyAngleLock，依赖 lastAnchorClient 会话状态）、测量工具、Ctrl 拖拽复制。锁角与引擎磁吸的互斥现在靠引擎 Shift 判定保证——若未来把锁角也引擎化或改用其他修饰键，需同步复核 resolveMagnetOptions。
- ⚠️ 会话操作事故记录（2026-09-15，已恢复）：① 误 `rm -rf` 删除连接器旧目录（进程占用导致 mv 失败后误发删除）——凭会话上下文全量重建并 pytest 34/34 验证等价，旧 git 历史未还原；② `git reset --hard` 把已入库的 handoff 文件未提交更新退回旧版——已全量恢复。教训固化：删/移仓库目录前必须确认无进程占用且逐字核对命令；reset --hard 前必须检查工作区未提交改动（本仓 handoff 文件已被跟踪，不是"未跟踪就安全"）。

## Unknowns / Confirmations Needed

- 无。原"decisions D58-D61 内容 UNKNOWN"已由用户澄清：属 cloudtradeagent 项目（与当前仓库无关），无需追溯。`D:\AI\cloudtradeagent-vela` 工作区状态仍未经本仓会话验证（零改动，无影响）。
