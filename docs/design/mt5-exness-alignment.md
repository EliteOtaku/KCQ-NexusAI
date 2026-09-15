# MT5 数据源接入与 Exness 时区对齐设计

> 关联决策：`.agent-handoff/decisions.md` D13–D17（2026-09-15 用户拍板）。
> 本文档是 core 侧改动（updateBars 原语 + mt5 Provider + SSE 消费器）的设计决策记录。

## 背景

从本地 MT5 终端（Exness）读取 K 线并在图表实时绘制。MT5 只能经 MetaTrader5 Python 包 IPC 读本机终端（Node 无法直连），且包内无推送回调——实时性只能靠轮询。Exness 的 4h/日/周/月 K 线锚服务器时区（EET/EEST），与币安等 UTC 标准的加密图表不一致，且周日存在短棒。

## 架构形态（D13/D14）

```
MetaTrader5 终端（Windows 本机，Exness 已登录）
   │  MetaTrader5 Python 包（IPC，单工作线程串行队列）
   ▼
KCQ-MT5-connector（同级独立仓库，FastAPI :8090）
   ├─ V1 协议 REST：probe / instruments/search / bars（游标分页）
   ├─ 采样循环：tick 探针 1s → 变化才取 K 线；静默指数退避封顶 30s
   └─ SSE 单连接推帧：snapshot / forming / closed / status（Last-Event-ID 补帧）
   ▼
core：mt5 Provider（V1 HTTP Transport）+ Mt5LiveSource（EventSource）
   ▼
RealtimeBarsConnector → controller.updateBars → DataBuffer → 指标重算 → 重绘
```

不做 core 进程内 Provider、不做 WebSocket、不做浏览器轮询（双顾问一致 + 用户拍板）。

## 时区对齐（D15/D16）

- **伪 UTC 问题**：MT5 时间戳按服务器墙钟解释为 UTC epoch。连接器用最后 tick 时间与本机时钟差实测偏移（取整小时、模 24h 归一 ±12h，优先探测 7x24 的加密品种），`EXNESS_SERVER_UTC_OFFSET` 可覆盖。
- **日内（1m–1h）**：原生序列仅偏移校正，保留周日短棒（剔除会丢失日内走势段）。
- **4h/日线**：自 H1 按锚时区重采样；**周/月**：自 D1 重采样。加密品种锚 UTC（币安标准），传统品种锚 Europe/Athens（EET/EEST 自动 DST）。周日短棒在重采样中自然并入周一首根——显示、指标计算、存储三层数据同源一致。
- **开关**：连接器 env `ALIGN_TZ=auto|gmt2|gmt3|off`；probe 响应上报对齐状态与实测偏移。图表 UI 开关后续再加。

对齐语义的行为基准（冬夏 4h/日线边界、DST 切换日 23 小时周日、周月锚、偏移换算）由 KCQ-MT5-connector 的 pytest 纯函数用例固化，无需终端即可回归。

## updateBars 原语（D17）

**问题**：既有写入路径无法安全承接实时帧——

| 路径 | 行为 | 对 forming 更新的后果 |
| --- | --- | --- |
| `KLineDataStore.merge` | 同时间戳保旧弃新 | 更新被静默吞掉 |
| `updateData`（= setData） | 全量替换 | 每帧重发全量，代价大且与分页加载互踩 |
| `appendData` | 无去重 concat | 重复根堆积 |

**方案**：`KLineDataStore.updateBars` —— replace-on-conflict 的末尾窗口合并：

- 同时间戳的末尾 bar 被新值替换（forming 更新、收线后终端缓存滞后的修订）；
- 晚于末根的时间戳追加（新根、休市 gap 跳根）；
- 早于末 2 根（`REALTIME_REVISABLE_TAIL_BARS`）的陈旧帧拒绝并返回 `rejected`，数据不变不发布信号；
- 一次调用发布一个数据快照（`prependedCount` 恒 0，实时更新永不左插）——`closed+forming` 帧批合并为一次原子写，消费方不会观察到中间态。

全链暴露：`DataBuffer.updateBars` → `KLineBuffer` 接口 → `ChartDataManager.updateBars`（分时视图忽略）→ `Chart` 门面 → `ChartController.updateBars`。写入即联动：data signal → `handleBufferDataEvent` → 指标重算 → `scheduleDraw`，无需消费方手动触发。

语义防线：`packages/core/src/data/__tests__/kLineDataStore.test.ts`（替换/追加/陈旧拒绝/原子写/空存储种子）。

## SSE 消费（帧协议与合并策略）

- `Mt5LiveSource`：EventSource 封装（原生重连、keepalive 注释帧容忍、esFactory 可注入测试）；URL 固定单 (symbol, period) 订阅。
- `RealtimeBarsConnector`：`closed` 帧先暂存，随后的 `forming` 帧合并为一次 `updateBars([closed, forming])`；`snapshot` 帧自带全量尾态直接整批写并作废暂存；断流/停止时冲刷暂存，收线终值不丢。
- 陈旧帧由 `updateBars` 的窗口拒绝兜底，消费端无需自行判序。

## nexus-shell 接线

- 设置对话框「数据源」段：切 MT5 时按需 probe（mock 路径零网络噪声），失败保持 Mock 并行内提示。
- MT5 模式 SymbolPicker 走 `searchInstruments`（200ms 防抖 + AbortSignal），最近使用持久化品种描述。
- 选中品种 → `setSymbols([{...spec, source: 'mt5'}])` 走 fetcher 管线（左翻分页自动补历史）；SSE 随 (symbol, period) 变化重连、离开 mt5 即断流。

## 验证

- KCQ-MT5-connector pytest 全绿（对齐/去重/收线判定/帧协议/路由，FakeGateway 无需终端）。
- core vitest：updateBars 语义 8 用例 + mt5 provider/live 10 用例。
- nexus-shell：typecheck 绿 + 三探针回归（mock 路径 39/15/49）+ `probe-mt5.mjs` 冒烟 8 断言（桩连接器，全链路含断流）。
- 真机 E2E（Windows + Exness 终端已登录）：`pnpm connecter mt5` → 壳切 MT5 → forming 实时刷新 / 日线与 4h 无周日棒——由用户执行。
