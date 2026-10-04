# 未来时间轴（TV 式自由拖动与越界十字光标）设计决策

## 背景与目标

当前引擎把横向滚动与十字光标都钳制在「最后一根已有 K 线」内：滚动上限 `computeMaxScrollLeftWithVisibleData` 钉死在 `totalDataCount - 1`，`positionCrosshair` 对 `globalIdx >= data.length` 直接清除十字线，时间轴对越界索引无时间语义。用户无法像 TradingView 那样把 K 线拖到绘图区左侧、在空白未来区比划时间日期或延展图元。

目标（对齐 TradingView 行为）：

1. 最后一根 K 线可被拖动到绘图区左缘，右侧露出**可配置屏数的未来空白区**（默认 3 屏）。
2. 十字光标可进入未来区，纵向线吸附外推网格，底部时间签显示**外推的未来交易日**。
3. 未来区有时间刻度与纵向网格，日期为交易日历预测（跳过休市时段）。
4. 纯未来区视口下价格轴冻结最近一次有效价格区间（不跳变到兜底 0-100）。

## 核心决策

### D1：滚动上限 = 最后一根 K 线 + FUTURE_SCREENS 屏

`computeMaxScrollLeftWithVisibleData` 的 `rawMax` 从 `totalDataCount - 1` 放宽为
`totalDataCount - 1 + futureBars`，其中 `futureBars = ceil(plotWidth / unitPx) * FUTURE_SCREENS`。
`FUTURE_SCREENS` 为 `ChartOptions` 新增可选项，默认 3。不采用无限滚动：滚动条几何、
索引精度与"回家"体验都要求有界空间；`scrollToRight()` 继续承担回到实时的职责。

现存的 `SCROLL_TRAILING_SLOTS = 30`（内容宽度尾部槽位）被本次上限放宽自然吸收，
保留常量但不再限制滚动（内容宽度公式不变，30 槽 ⊪ 3 屏，多数缩放级别下无需再扩）。
若某缩放级别下 `futureBars > SCROLL_TRAILING_SLOTS`，`computeContentWidth` 同步用
`futureBars` 参与宽度计算，保证内容宽度 ≥ 可滚动范围。

### D2：可见区间 end 允许超出数据长度（索引制未来空间）

`getVisibleRange` 的 `end = Math.min(totalDataCount, ...)` 移除钳制，`end` 可达
`totalDataCount + futureBars`。逻辑索引空间 = 已有数据 [0, dataLength) ∪ 未来槽位
[dataLength, dataLength + futureBars)。选择索引制而非时间制的原因：
几何层（`logicalIndexToScreenX` / `getLogicalIndexAtScreenX`）已经按"未来槽位线性外推"
实现并有注释背书，绘图图元已依赖此语义；十字光标与网格沿用同一坐标系零新增概念。

`clampVisibleRange` 保持只钳 start（>=0）；`end` 的合法上限即未来边界，
由 viewportState 在 computed 内统一夹取。

### D3：时间外推 = 交易日历感知（market session 驱动）

新增纯函数模块 `engine/market/futureTimeAxis.ts`：

```
projectTradingTimestamp(session: MarketSessionConfig, lastTimestamp: number, steps: number, periodMs: number): number
```

- 24/7（crypto）：线性外推 `lastTs + steps * periodMs`。
- 24/5（forex，本项目主场景）：工作日近似（Mon-Fri），跳过周六周日；周五收盘后
  预测跳至下周一开盘。Exness 周日短时段不建模（预测标签会被真实 bar 覆盖，见 D4）。
- 日内周期在 session 内推进时按 `periodMs` 步进，跨日/跨休市按 session 开收盘跳转。

**不引入假日数据源**：索引制轴天然自愈——轴标签按 index 对齐，未来标签只是预测，
真实 bar 到达后以真实时间戳覆盖同 index 的预测标签，预测误差零累积。

### D4：越界索引的统一时间解析

`ChartDataManager.getTimestampAtLogicalIndex(index)`：`index >= data.length` 时走
D3 外推（需要 session 上下文，由 Chart 在 setSymbols/切市场时注入当前 session 与
最后时间戳缓存）；`index < 0` 仍返回 null（左缘历史加载边界，不外推）。

时间轴十字签（`timeAxis.ts` 的 `xCrosshair` 表面）改为：
`data[index] ?? extrapolatedTimestamp(index)`，未来区正常渲染时间签。

边界声明：比较视图下 `context.data` 为对比参考序列，越界回退仍按**主品种**日历外推
（`futureSession` 注入 primary）。跨市场比较（如 A 股参考 + crypto 主品种）拖入未来区时，
预测标签可能偏数日——属预测语义，真实 bar 到达后同 index 自愈覆盖。

### D5：未来区网格与刻度

- 纵向网格（`gridLines.ts`）与时间刻度（`timeAxis.ts`）：对 `index >= dataLength`
  的槽位，用 D3 外推时间做"虚拟边界"——日线/月线边界沿用 `displayTimeFormatter`
  的 key 比较，未来区按预测时间戳生成边界索引，与历史边界同帧合并渲染。
- 未来区刻度颜色降级为 text.tertiary（区别于历史实区），标注"预测"语义。

### D6：纯未来区价格轴冻结

`getVisiblePriceRange` 对 `[start, end)` 全部越界（无任何有效 bar）时返回上一帧
有效区间。实现点在 `Pane.updateRange` 调用链（`kLineMode.updatePaneRange`）：
`priceRange` 兜底分支改为读取 pane.yAxis 当前 range 并原样保留；仅当 pane 从未
有过有效区间（冷启动即在未来区，理论不可达）才用 `{100, 0}` 兜底。
指标极值合并在无有效 bar 时跳过。

### D7：十字光标越界放行

`positionCrosshair` 移除 `globalIdx >= data.length` 清除分支；越界时：
- `crosshairIndex` 允许越界值（`InteractionSnapshot.crosshairIndex` 类型不变，number）。
- 十字线 X 吸附到 `frameCenters` 外推中心（与绘图图元同一 `logicalIndexToScreenX` 语义）。
- `hoveredIndex`：未来区设为越界 index；`hitTestCandle` 对越界 index 返回 false
  （无 OHLC 可命中），tooltip 隐藏——与 TV 一致：未来区只显示时间签 + 价格签。
- `findNearestBar` 的"边缘裁剪回夹"分支保留（左右各有 1 根兜底），但未来区内
  直接用 `getLogicalIndexAtScreenX` 的外推结果，不再回夹到最后一根真实 bar。

### D8：分时（timeShare）模式不放开

分时/五日分时的可见区间与内容宽度按 session 槽位构造，天然有界且语义为"已到达
的分时数据"，不提供未来区。所有改动以 `isTimeSharePeriod` 分支隔离，行为不变。

## 影响面与守卫清单

`visibleRange` 全引擎 26 个消费文件中需要逐一审计的读数据点（多数已有
`if (!item) continue` 类守卫，越界 end 只会多产生 continue）：

| 文件 | 审计点 | 预期 |
| --- | --- | --- |
| `renderers/candle*.ts`、量柱 | `klineData[index]` 越界读 | 已有守卫，跳过即可 |
| `indicators/stateComposer.ts`、`visibleStateComposers.ts`、`instanceProjection.ts` | 指标窗口按 range 切片 | 越界段无指标值，输出为空，需确认不抛错 |
| `scale/priceScale.ts` | 不直接读数据 | 无改动 |
| `drawing/geometry/impl/frameProjection.ts` | 已支持未来索引 | 无改动，回归验证 |
| `chartDataManager.ts` 增量加载 | 左缘检测用 rawRange.start | 未来区在右侧，start 语义不变 |
| `interaction.ts` | D7 | 修改 |
| `timeAxis.ts` / `gridLines.ts` | D5 | 修改 |
| vue `KLineChart.vue:1331` tooltip | `idx < data.length` 才显示 | 保持（未来区无 tooltip） |

## 测试策略

- viewport 纯函数：futureBars 上限、end 越界、start 钳制不变。
- contentGeometry parity 测试：内容宽度 ≥ 可滚动范围。
- futureTimeAxis：24/7 线性、24/5 跳周末（周五→周一）、日内跨 session。
- interaction：越界 hover 的 crosshairIndex/snap X、hitTestCandle false、tooltip 隐藏。
- timeAxis：未来区刻度生成与十字签外推。
- 手工验收：EURUSD 日线拖到最右，光标比划下周一，价格轴不跳变；`pnpm dev -c mt5` 全链路。

## 里程碑

- M1 自由拖动 + 越界光标 + 时间签外推（D1/D2/D4/D6/D7）
- M2 未来区网格与刻度（D5）
- M3 打磨：预测标签被真实 bar 覆盖的自愈验证、指标面板未来区空白审计
