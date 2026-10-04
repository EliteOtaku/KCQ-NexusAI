# 未来时间轴（TV 式自由拖动）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** K 线可拖出右侧未来区（默认 3 屏），十字光标可越界并按交易日历外推显示未来时间。

**Architecture:** 纯函数改 core 几何层（viewport/contentGeometry），新增 `futureTimeAxis` 纯函数模块做交易日历外推，交互与时间轴消费外推语义；分时模式全部分支隔离不受影响。设计决策见 `docs/design/future-time-axis.md`。

**Tech Stack:** TypeScript (vue-tsc strict)、Vitest、Biome。测试命令：`pnpm --filter @363045841yyt/klinechart-core test -- <file>`；类型检查：`pnpm type-check`。

**测试环境注意：** 日期断言依赖 `TZ=Asia/Shanghai`，本地跑测试前先 `$env:TZ='Asia/Shanghai'`（PowerShell）。

---

### Task 1: viewport 纯函数支持未来区上限与越界 end

**Files:**
- Modify: `packages/core/src/engine/viewport/viewport.ts`
- Test: `packages/core/src/engine/viewport/__tests__/viewport.future.test.ts`（新建，若目录已有 viewport 测试文件则并入）

- [ ] **Step 1: 写失败测试——maxScrollLeft 含未来区**

```ts
import { describe, expect, it } from 'vitest'
import {
  computeMaxScrollLeftWithVisibleData,
  getVisibleRange,
} from '../viewport.js'

// dpr=1, kWidth=9, kGap=1 → unitPx=10, startXPx=0（无左缓冲时）
describe('computeMaxScrollLeftWithVisibleData future space', () => {
  it('允许最后一根 K 线拖到左缘：上限含 futureBars', () => {
    // 100 根数据, plotWidth=1000 → futureBars = ceil(1000/10) * 1（1 屏便于断言）
    const max = computeMaxScrollLeftWithVisibleData(
      100_000, // contentMaxScrollLeft 足够大，不成为瓶颈
      0,       // leftLoadBufferWidth
      9,       // kWidth
      1,       // kGap
      100,     // totalDataCount
      1,       // dpr
      { plotWidth: 1000, futureScreens: 1 },
    )
    // 无未来区上限 = 最后一根位置 ≈ 100 * 10 = 1000
    // 1 屏未来区上限 ≈ 1000 + 1000 = 2000
    expect(max).toBeGreaterThan(1500)
  })

  it('不传 future 选项时保持旧行为', () => {
    const max = computeMaxScrollLeftWithVisibleData(100_000, 0, 9, 1, 100, 1)
    expect(max).toBeCloseTo(1000, 0)
  })
})

describe('getVisibleRange future end', () => {
  it('end 可超出 totalDataCount（未来槽位）', () => {
    const range = getVisibleRange(1500, 1000, 9, 1, 100, 1)
    expect(range.end).toBeGreaterThan(100)
    expect(range.start).toBeGreaterThanOrEqual(0)
  })
})
```

- [ ] **Step 2: 运行确认失败**

Run: `$env:TZ='Asia/Shanghai'; pnpm --filter @363045841yyt/klinechart-core test -- viewport.future`
Expected: FAIL（签名不匹配或值不符）

- [ ] **Step 3: 实现——viewport.ts**

`computeMaxScrollLeftWithVisibleData` 增加可选尾参：

```ts
export type FutureSpaceInput = { plotWidth: number; futureScreens?: number }

/** 默认未来区屏数：最后一根 K 线可推到绘图区左缘后再留 3 屏。 */
export const DEFAULT_FUTURE_SCREENS = 3

export function computeMaxScrollLeftWithVisibleData(
  contentMaxScrollLeft: number,
  leftLoadBufferWidth: number,
  kWidth: number,
  kGap: number,
  totalDataCount: number,
  dpr: number = 1,
  future?: FutureSpaceInput,
): number {
  if (totalDataCount === 0) return contentMaxScrollLeft

  const { unitPx, startXPx } = getPhysicalKLineConfig(kWidth, kGap, dpr)
  // 未来区槽位：允许更远由 options.futureScreens 配置，默认 3 屏
  const futureBars = future
    ? Math.ceil(future.plotWidth / unitPx) * (future.futureScreens ?? DEFAULT_FUTURE_SCREENS)
    : 0
  const lastBarIndex = totalDataCount - 1 + futureBars
  const rawMax = leftLoadBufferWidth + (startXPx + lastBarIndex * unitPx) / dpr
  const maxScrollRaw = Math.min(contentMaxScrollLeft, rawMax)
  const maxScrollPx = (maxScrollRaw - leftLoadBufferWidth) * dpr - startXPx
  const maxN = Math.floor(maxScrollPx / unitPx)
  return Math.max(0, leftLoadBufferWidth + (startXPx + maxN * unitPx) / dpr)
}
```

`getVisibleRange` 移除 end 钳制：

```ts
  // 未来区：end 允许超出 totalDataCount（未来槽位索引），由 viewportState 统一夹取上限
  const end = Math.ceil((scrollLeftPx + viewWidthPx - startXPx) / unitPx) + 1
```

- [ ] **Step 4: 运行测试通过**

Run: `$env:TZ='Asia/Shanghai'; pnpm --filter @363045841yyt/klinechart-core test -- viewport.future`
Expected: PASS

- [ ] **Step 5: 跑受影响的既有 viewport 测试**

Run: `$env:TZ='Asia/Shanghai'; pnpm --filter @363045841yyt/klinechart-core test -- viewport`
Expected: 旧行为用例（无 future 参数）全部 PASS；若有断言"end <= dataLength"的旧用例失败，按新语义更新该用例并在提交信息注明。

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/engine/viewport/
git commit -m "feat(core): allow future-space scroll bounds and extrapolated visible range end"
```

---

### Task 2: ChartOptions.futureScreens 贯穿 viewportState

**Files:**
- Modify: `packages/core/src/engine/chartTypes.ts:34-49`（ChartOptions 加字段）
- Modify: `packages/core/src/engine/state/contentGeometry.ts`（computeMaxScrollLeftWithVisibleData 调用点传 plotWidth 与 screens）
- Modify: `packages/core/src/engine/state/viewportState.ts:176-208`（maxScrollLeft computed、rawVisibleRange end 上限夹取）
- Test: `packages/core/src/engine/state/__tests__/contentGeometry.parity.test.ts`（既有文件追加用例）

- [ ] **Step 1: 写失败测试——内容宽度覆盖未来滚动范围**

在 `contentGeometry.parity.test.ts` 追加：

```ts
it('内容宽度覆盖 3 屏未来滚动范围', () => {
  const input = { viewWidth: 1000, plotWidth: 1000, dataLength: 100, period: '1day', dpr: 1, kWidth: 9, kGap: 1 }
  const width = computeContentWidth(input)
  // 数据 1000px + 左缓冲 1000px + 3 屏未来 3000px（至少不小于滚动上限 + 视宽）
  expect(width).toBeGreaterThanOrEqual(1000 + 1000 + 3000 - 10)
})
```

- [ ] **Step 2: 运行确认失败**

Run: `$env:TZ='Asia/Shanghai'; pnpm --filter @363045841yyt/klinechart-core test -- contentGeometry.parity`
Expected: FAIL

- [ ] **Step 3: 实现**

`chartTypes.ts` ChartOptions 追加（`DEFAULT_FUTURE_SCREENS` 从 viewport.js 导入常量作默认值注释）：

```ts
  /** 未来区屏数：最后一根 K 线右侧允许的滚动空间（屏宽倍数），默认 3 */
  futureScreens?: number
```

`contentGeometry.ts`：`ContentGeometryInput` 加 `futureScreens?: number`；
`computeContentWidth` 的 `dataPlotWidth` 改为取 `max(SCROLL_TRAILING_SLOTS, futureBars)`：

```ts
  const futureBars = Math.ceil(input.plotWidth / unitPx) * (input.futureScreens ?? 0)
  const trailingSlots = Math.max(SCROLL_TRAILING_SLOTS, futureBars)
  const dataPlotWidth = (startXPx + (input.dataLength + trailingSlots) * unitPx) / input.dpr
```

`viewportState.ts`：`signalDeps` 增加 `futureScreens$`（从 optionsState 读，缺省 undefined）；
`maxScrollLeft` computed（191-208 行）把 `computeMaxScrollLeftWithVisibleData` 调用加第 7 参
`{ plotWidth: readonly.plotWidth(), futureScreens: signalDeps.futureScreens$() }`；
`cachedRawVisibleRange`（236 行起）K 线分支 `getVisibleRange(...)` 结果对 end 夹取上限：

```ts
const vr = /* 分时分支不变 */
const raw = getVisibleRange(vp.scrollLeft, vp.plotWidth, options.kWidth, kGap(), dataLength, vp.dpr)
const futureBars = Math.ceil(vp.plotWidth / unitPx) * (futureScreens ?? DEFAULT_FUTURE_SCREENS)
const end = Math.min(raw.end, dataLength + futureBars + 1)
vr = { start: raw.start, end }
```

（`unitPx` 从 `getPhysicalKLineConfig(options.kWidth, kGap(), dpr)` 取。）

`createChartController` 链路：`chart/impl/controllerDefaults.ts` 无需默认值（undefined 即默认 3 屏）；
`createChartController.ts` chartOptions 组装处透传 `futureScreens: opts.futureScreens`；
`controllers/types.ts` 的 `ChartMountOptions` 加同名字段。

- [ ] **Step 4: 运行 parity 测试 + viewportState 相关测试**

Run: `$env:TZ='Asia/Shanghai'; pnpm --filter @363045841yyt/klinechart-core test -- contentGeometry`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/engine/ packages/core/src/controllers/
git commit -m "feat(core): thread futureScreens option through content geometry and viewport state"
```

---

### Task 3: 帧几何与交互放行越界（自由拖动 + 越界光标）

**Files:**
- Modify: `packages/core/src/engine/controller/interaction.ts:997-1020`（positionCrosshair）、`929-988`（findNearestBar 未来区分支）
- Test: `packages/core/src/engine/controller/__tests__/interaction.future.test.ts`（新建；复用 `__tests__/helpers/renderTestKit.ts` 既有 testkit）

- [ ] **Step 1: 写失败测试**

```ts
import { describe, expect, it } from 'vitest'
// 用既有 renderTestKit 构造 10 根 K 线、kWidth=9/kGap=1 的图表
import { createFutureInteractionFixture } from './helpers/futureInteractionFixture'

describe('crosshair beyond last bar', () => {
  it('hover 未来槽位时 crosshairIndex 越界且十字线不消失', () => {
    const fx = createFutureInteractionFixture({ dataCount: 10, plotWidth: 400 })
    // 拖到最右：scrollLeft = max；指针落在最后一根右侧 5 个槽位
    fx.scrollToMax()
    const futureSlotCenterX = fx.screenXOfIndex(10 + 5)
    fx.hover(futureSlotCenterX, 100)
    const snap = fx.chart.kernel.interaction.readonly.snapshot?.peek() ?? fx.crosshairSnapshot()
    expect(snap.crosshairIndex).toBe(15)
    expect(snap.crosshairPos).not.toBeNull()
  })

  it('未来槽位不命中 candle（hoveredIndex 为 null 或越界但 tooltip 隐藏）', () => {
    const fx = createFutureInteractionFixture({ dataCount: 10, plotWidth: 400 })
    fx.scrollToMax()
    fx.hover(fx.screenXOfIndex(17), 100)
    // hitTestCandle 对越界索引返回 false → hoveredIndex 不指向有效 OHLC
    expect(fx.hasVisibleTooltip()).toBe(false)
  })
})
```

fixture `createFutureInteractionFixture` 放在同目录 `helpers/futureInteractionFixture.ts`，
内部组合既有 renderTestKit 构造 Chart + InteractionController（不新造替身，复用单一事实来源），
暴露 `scrollToMax()`（scrollLeft 置 maxScrollLeft）、`screenXOfIndex(i)`（帧封存后
`getScreenXAtLogicalIndex(i)`）、`crosshairSnapshot()`、`hasVisibleTooltip()`。

- [ ] **Step 2: 运行确认失败**

Run: `$env:TZ='Asia/Shanghai'; pnpm --filter @363045841yyt/klinechart-core test -- interaction.future`
Expected: FAIL（当前 crosshairIndex 为 null）

- [ ] **Step 3: 实现 interaction.ts**

`positionCrosshair`（997 行）：删除

```ts
    if (bar.globalIdx < 0 || bar.globalIdx >= this.chart.getInternalData().length) {
      this._state.actions.updateCrosshair(null, null, null)
      return
    }
```

改为（负索引仍清除；越界放行，snap X 用外推中心）：

```ts
    if (bar.globalIdx < 0) {
      this._state.actions.updateCrosshair(null, null, null)
      return
    }
    const kLineCenters = this.frameCenters
    const centerX =
      kLineCenters?.[bar.localIdx] ?? bar.kLineStartX + bar.widthLogical / 2
```

`findNearestBar`（955-980 行）：二分与近邻比较不变；当 `lo >= positions.length`
（指针在最后一根右侧）时改为直接外推而不是回夹：

```ts
    } else if (lo >= positions.length) {
      // 未来槽位：按尾部步长外推索引，允许十字线进入未来区
      const lastLocal = positions.length - 1
      const lastCenter = centers?.[lastLocal] ?? positions[lastLocal]! + kWidthLogical / 2
      const step = fallbackStep(centers, positions, kWidthLogical, ctx.dpr)
      const extrapolated = lastLocal + Math.max(1, Math.ceil((worldX - lastCenter) / step))
      return {
        localIdx: extrapolated,
        globalIdx: extrapolated + visibleRange.start,
        kLineStartX: positions[lastLocal]! + (extrapolated - lastLocal) * kWidthLogical,
        widthLogical: kWidthLogical,
      }
    }
```

（`fallbackStep` 抽成本文件私有函数：`centers` 尾步长 → `frameFallbackCenterStep` →
`kWidthPx/dpr`，三选一，语义与 `getLogicalIndexAtScreenX:582-585` 一致。）
左右边缘回夹分支（966-980 行的前半段）仅对 `barCenter` 越出可视区的**真实 bar** 生效，
保持原样。

`hitTestCandle`（1040 行）：入口加越界短路：

```ts
    if (typeof this.crosshairIndex !== 'number') return false
    const data = this.chart.getInternalData()
    if (this.crosshairIndex >= data.length) return false // 未来槽位无 OHLC
```

`updatePlotHoverFromPoint`（832-838 行）顺序不变：`hitTestCandle` false →
`setHoveredIndex(null)` → tooltip 隐藏，未来区自然无 tooltip。

- [ ] **Step 4: 运行 interaction 全部测试**

Run: `$env:TZ='Asia/Shanghai'; pnpm --filter @363045841yyt/klinechart-core test -- interaction`
Expected: 新用例 PASS；既有 drawing/marker/pan 用例不回归。

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/engine/controller/
git commit -m "feat(core): let crosshair and pan extend into future index space"
```

---

### Task 4: 交易日历外推模块 futureTimeAxis

**Files:**
- Create: `packages/core/src/engine/market/futureTimeAxis.ts`
- Test: `packages/core/src/engine/market/__tests__/futureTimeAxis.test.ts`

- [ ] **Step 1: 写失败测试**

```ts
import { describe, expect, it } from 'vitest'
import { projectTradingTimestamp } from '../futureTimeAxis.js'
import { ASHARE_MARKET_SESSION } from '../../../foundation/utils/sessionTimeLabels.js'

// Forex 24/5 profile 在 Task 4 一并定义并导出
import { FOREX_MARKET_SESSION } from '../forexMarketSession.js'

const DAY = 86_400_000

describe('projectTradingTimestamp', () => {
  it('24/5：周五日线之后跳到下周一', () => {
    // 2026-01-02 是周五（UTC）
    const friday = Date.UTC(2026, 0, 2, 22) // 周五收盘近似
    const next = projectTradingTimestamp(FOREX_MARKET_SESSION, friday, 1, DAY)
    // 2026-01-05 是周一
    expect(new Date(next).getUTCDay()).toBe(1)
  })

  it('24/5：周中日线按自然日推进', () => {
    const tuesday = Date.UTC(2026, 0, 6, 22)
    const next = projectTradingTimestamp(FOREX_MARKET_SESSION, tuesday, 1, DAY)
    expect(new Date(next).getUTCDay()).toBe(3) // 周三
  })

  it('24/5：周六起点（数据停在周五）首个预测是周一', () => {
    const saturday = Date.UTC(2026, 0, 3, 12)
    const next = projectTradingTimestamp(FOREX_MARKET_SESSION, saturday, 1, DAY)
    expect(new Date(next).getUTCDay()).toBe(1)
  })

  it('周期感知：15min 日内在同日 session 内线性步进', () => {
    const base = Date.UTC(2026, 0, 6, 10, 0) // 周二 10:00 UTC ≈ 亚洲盘（近似即可，断言相对关系）
    const next = projectTradingTimestamp(FOREX_MARKET_SESSION, base, 3, 900_000)
    expect(next - base).toBe(3 * 900_000)
  })

  it('24/7 profile：纯线性外推', () => {
    const base = Date.UTC(2026, 0, 3, 12) // 周六
    const next = projectTradingTimestamp(FOREX_MARKET_SESSION, base, 2, DAY)
    expect(next - base).toBe(2 * DAY)
  })
})
```

- [ ] **Step 2: 运行确认失败**

Run: `$env:TZ='Asia/Shanghai'; pnpm --filter @363045841yyt/klinechart-core test -- futureTimeAxis`
Expected: FAIL（模块不存在）

- [ ] **Step 3: 实现**

`packages/core/src/engine/market/forexMarketSession.ts`（新建）：

```ts
import type { MarketSessionConfig } from '../../foundation/utils/sessionTimeLabels.js'

/** 外汇 24/5 市场画像：工作日近似（周一至周五），周日短时段不建模（预测标签由真实 bar 覆盖）。 */
export const FOREX_MARKET_SESSION: MarketSessionConfig = {
  timeZone: 'UTC',
  sessions: [{ open: 0, close: 24 * 60 }],
  slotMinutes: 24 * 60, // 日线粒度：一个 session = 一个交易日
}
```

`futureTimeAxis.ts`（新建，纯函数、无副作用）：

```ts
import type { MarketSessionConfig } from '../../foundation/utils/sessionTimeLabels.js'

type SessionKind = 'continuous' | 'weekdays'

/** 由 session 推导外推模式：24h 全覆盖 = continuous；否则 weekdays。 */
function sessionKind(session: MarketSessionConfig): SessionKind {
  const covered = session.sessions.some((r) => r.open === 0 && r.close >= 24 * 60)
  return covered ? 'continuous' : 'weekdays'
}

/**
 * 从 lastTimestamp 起按交易日历外推 steps 个周期槽位的时间戳（毫秒）。
 * continuous：线性步进（crypto 24/7）。
 * weekdays：日粒度槽位跳过周六周日（forex 24/5 工作日近似）。
 * 预测标签会随真实 bar 到达被覆盖（索引制轴自愈），无需假日数据。
 */
export function projectTradingTimestamp(
  session: MarketSessionConfig,
  lastTimestamp: number,
  steps: number,
  periodMs: number,
): number {
  if (steps <= 0) return lastTimestamp
  if (sessionKind(session) === 'continuous') return lastTimestamp + steps * periodMs

  // weekdays：跳过周六(6)/周日(0)。日内周期（periodMs < DAY）在同日内按 periodMs
  // 线性步进、跨日切整日；日粒度槽位一次一天。
  const DAY = 86_400_000
  let ts = lastTimestamp
  for (let remaining = steps; remaining > 0; remaining--) {
    if (periodMs < DAY) {
      ts += periodMs
      const day = new Date(ts).getUTCDay()
      if (day === 6) ts += 2 * DAY // 周六 → 周一
      else if (day === 0) ts += DAY // 周日 → 周一
    } else {
      ts += Math.max(periodMs, DAY)
      const day = new Date(ts).getUTCDay()
      if (day === 6) ts += 2 * DAY
      else if (day === 0) ts += DAY
    }
  }
  return ts
}
```

（骨架已可运行；若测试暴露 DST/时区边界问题，以 5 个测试用例的语义为准修正日推进实现。）

- [ ] **Step 4: 运行通过**

Run: `$env:TZ='Asia/Shanghai'; pnpm --filter @363045841yyt/klinechart-core test -- futureTimeAxis`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/engine/market/
git commit -m "feat(core): add trading-calendar future timestamp projection"
```

---

### Task 5: getTimestampAtLogicalIndex 越界外推 + 时间轴十字签

**Files:**
- Modify: `packages/core/src/engine/data/chartDataManager.ts:1375-1380`
- Modify: `packages/core/src/engine/renderers/timeAxis.ts:197-211`
- Modify: `packages/core/src/engine/chart.ts`（注入 session 与 lastTimestamp 到 dataManager）
- Test: `packages/core/src/engine/data/__tests__/chartDataManager.futureTime.test.ts`（新建，复用 `chartDataManagerTestKit`）

- [ ] **Step 1: 写失败测试**

```ts
import { describe, expect, it } from 'vitest'
import { createChartDataManagerTestKit } from './helpers/chartDataManagerTestKit'
import { FOREX_MARKET_SESSION } from '../../market/forexMarketSession.js'

const HOUR = 3_600_000

describe('getTimestampAtLogicalIndex beyond data', () => {
  it('未来索引按交易日历外推（周五数据 +1 → 下周一）', () => {
    const kit = createChartDataManagerTestKit({
      session: FOREX_MARKET_SESSION,
      // 数据止于周五 22:00 UTC
      bars: fiveBarsEndingFriday(),
    })
    const dataLen = kit.dataLength
    expect(kit.dm.getTimestampAtLogicalIndex(dataLen)).toBeInstanceOf(Number)
    const day = new Date(kit.dm.getTimestampAtLogicalIndex(dataLen)!).getUTCDay()
    expect(day).toBe(1) // 周一
  })

  it('负索引仍返回 null', () => {
    const kit = createChartDataManagerTestKit({ session: FOREX_MARKET_SESSION, bars: fiveBarsEndingFriday() })
    expect(kit.dm.getTimestampAtLogicalIndex(-1)).toBeNull()
  })
})
```

testkit 扩展：`chartDataManagerTestKit.ts` 增加可选 `session` 注入（映射到 deps 的新字段），
`fiveBarsEndingFriday()` 为本文件内表驱动 helper（5 根日线 timestamp，末根为周五）。

- [ ] **Step 2: 运行确认失败**

Run: `$env:TZ='Asia/Shanghai'; pnpm --filter @363045841yyt/klinechart-core test -- chartDataManager.futureTime`
Expected: FAIL（越界返回 null）

- [ ] **Step 3: 实现**

`chartDataManager.ts`：deps 增加 `futureSession?: () => MarketSessionConfig | null`；
`getTimestampAtLogicalIndex` 越界分支：

```ts
  getTimestampAtLogicalIndex(index: number): number | null {
    const buf = this.getActiveDataBuffer()
    const data = buf ? buf.getRawData() : []
    if (!Number.isInteger(index) || index < 0) return null
    if (index < data.length) return data[index]?.timestamp ?? null
    // 未来槽位：交易日历外推（周期步长由末两根 bar 推导，session 由 Chart 注入）
    const session = this.deps.futureSession?.()
    if (!session || data.length < 2) return null
    const last = data[data.length - 1]!.timestamp
    const prev = data[data.length - 2]!.timestamp
    const periodMs = Math.max(1, last - prev)
    return projectTradingTimestamp(session, last, index - data.length + 1, periodMs)
  }
```

`chart.ts`：构造 dataManager deps 时传
`futureSession: () => 当前主品种 session`（复用 `resolveSymbolMarketSession(primary, this.marketSessions)`，
主品种为空时返回 null；`setSymbols`/`setCurrentSymbol` 已有刷新点，无需新事件）。

`timeAxis.ts` 十字签（197-211 行）：`data[crosshair.index]` 取不到时走外推：

```ts
      const k = (context.data as KLineData[])[crosshair.index]
      const ts = k?.timestamp ?? this.extrapolatedCrosshairTime(crosshair.index, context)
      if (ts !== null) {
        registerAxisLabel(context, 'xCrosshair', {
          kind: AXIS_LABEL_KIND.TAG,
          text: formatCrosshairTime(context, ts),
          ...
        })
      }
```

（`extrapolatedCrosshairTime` 实现于 timeAxis.ts 内部：session 从 `context` 已有的
marketSession 传入链路取，缺省按连续外推 `lastTs + n * periodMs`。）

- [ ] **Step 4: 运行 dataManager + timeAxis 测试**

Run: `$env:TZ='Asia/Shanghai'; pnpm --filter @363045841yyt/klinechart-core test -- chartDataManager timeAxis`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/engine/
git commit -m "feat(core): extrapolate future timestamps for crosshair beyond last bar"
```

---

### Task 6: 价格轴空区冻结

**Files:**
- Modify: `packages/core/src/engine/modes/impl/kLineMode.ts:30-37`（updatePaneRange 空区分支）
- Modify: `packages/core/src/engine/layout/pane.ts:109-135`（updateRange 返回冻结信号）
- Test: `packages/core/src/engine/modes/__tests__/kLineMode.future.test.ts`（新建）

- [ ] **Step 1: 写失败测试**

```ts
import { describe, expect, it } from 'vitest'
import { KLineMode } from '../impl/kLineMode.js'
import { createPaneTestKit } from './helpers/paneTestKit' // 若无此 kit，用 Pane 直接构造（见 Step 3）

describe('kLineMode.updatePaneRange pure-future viewport', () => {
  it('全部越界的 range 冻结当前 yAxis range', () => {
    const mode = new KLineMode()
    const pane = createPaneTestKit() // 内部先喂 10 根有效数据建立 range
    const frozen = pane.yAxis.getRange()
    // 数据只有 10 根，range 全部越界
    mode.updatePaneRange(pane.pane, { start: 10, end: 20 }, pane.dm, null)
    expect(pane.yAxis.getRange()).toEqual(frozen)
  })
})
```

- [ ] **Step 2: 运行确认失败**

Run: `$env:TZ='Asia/Shanghai'; pnpm --filter @363045841yyt/klinechart-core test -- kLineMode.future`
Expected: FAIL（当前 range 变为 0-100 兜底）

- [ ] **Step 3: 实现**

`pane.ts` `updateRange` 改为先算后写：

```ts
  updateRange(data, range, indicatorRange) {
    const hasVisibleBar =
      range.start < data.length && range.end > Math.max(0, range.start)
    if (!hasVisibleBar && data.length > 0) {
      // 纯未来区视口：冻结最近一次有效价格区间（TV 行为），避免跳变到兜底 0-100
      return
    }
    // ...原有逻辑不变
  }
```

（indicatorRange 合并、basePrice 逻辑都在 hasVisibleBar 命中时才执行，与现状一致。）

- [ ] **Step 4: 运行 modes + layout 测试**

Run: `$env:TZ='Asia/Shanghai'; pnpm --filter @363045841yyt/klinechart-core test -- kLineMode pane`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/engine/modes/ packages/core/src/engine/layout/
git commit -m "feat(core): freeze price axis range on pure-future viewports"
```

---

### Task 7: 未来区网格与刻度（M2）

**Files:**
- Modify: `packages/core/src/engine/renderers/timeAxis.ts:111-143`（collectTimeAxisTicks 未来边界）
- Modify: `packages/core/src/engine/renderers/gridLines.ts:65-80`（纵向网格未来边界）
- Test: `packages/core/src/engine/renderers/__tests__/timeAxis.future.test.ts`（新建）

- [ ] **Step 1: 写失败测试**

```ts
import { describe, expect, it } from 'vitest'
import { collectFutureTimeBoundaries } from '../timeAxis.js'

describe('collectFutureTimeBoundaries', () => {
  it('日线未来区按外推时间生成月边界索引', () => {
    // 数据止于 2026-01-30（周五），未来 60 个槽位覆盖 1 月→3 月
    const boundaries = collectFutureTimeBoundaries({
      lastTimestamp: Date.UTC(2026, 0, 30),
      dataLength: 100,
      rangeEnd: 160,
      periodMs: 86_400_000,
      kind: 'month',
    })
    expect(boundaries.length).toBeGreaterThan(0)
    // 每个边界都 >= dataLength 且 < rangeEnd
    for (const idx of boundaries) {
      expect(idx).toBeGreaterThanOrEqual(100)
      expect(idx).toBeLessThan(160)
    }
  })
})
```

- [ ] **Step 2: 运行确认失败**

Run: `$env:TZ='Asia/Shanghai'; pnpm --filter @363045841yyt/klinechart-core test -- timeAxis.future`
Expected: FAIL

- [ ] **Step 3: 实现**

`timeAxis.ts` 导出纯函数 `collectFutureTimeBoundaries`：从 `range.start = max(range.start, dataLength)`
起逐槽用 `projectTradingTimestamp` 外推时间，`formatAxisMonthOrYear`/`formatAxisDay` 的
key（年月 / 年月日）变化处记为边界索引。`collectTimeAxisTicks` 末尾把未来边界合并进
`surface.register`（color 用 `colors.text.tertiary`，与历史刻度区分）。

`gridLines.ts`：同样调用 `collectFutureTimeBoundaries`（kind 由 `isMinuteData` 决定），
未来边界索引画纵向网格线（既有 rect 创建逻辑复用）。

- [ ] **Step 4: 运行 renderers 测试**

Run: `$env:TZ='Asia/Shanghai'; pnpm --filter @363045841yyt/klinechart-core test -- timeAxis gridLines`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/engine/renderers/
git commit -m "feat(core): render future-region time ticks and vertical grid from trading calendar"
```

---

### Task 8: 消费方守卫审计 + 全量回归

**Files:**
- Audit only（预期零改动或极小守卫补丁）:
  - `packages/core/src/engine/indicators/stateComposer.ts`
  - `packages/core/src/engine/indicators/visibleStateComposers.ts`
  - `packages/core/src/engine/indicators/instances/domain/instanceProjection.ts`
  - `packages/core/src/engine/scale/priceScale.ts`
  - `packages/core/src/engine/drawing/geometry/impl/frameProjection.ts`
  - `packages/vue/src/components/KLineChart.vue:1331`

- [ ] **Step 1: 逐文件审计越界读**

对上表每个文件：读 `klineData[index]` / `data[idx]` 处确认有 `undefined` 守卫；
`range.end` 参与切片处确认 `Math.min(end, data.length)` 或等效保护。发现问题就地补守卫
（一行 `if (!bar) continue` 级别），并补一条针对性断言到对应测试文件。

- [ ] **Step 2: core 全量测试**

Run: `$env:TZ='Asia/Shanghai'; pnpm --filter @363045841yyt/klinechart-core test`
Expected: 2594+ 全部 PASS

- [ ] **Step 3: 全仓类型检查与 lint**

Run: `pnpm type-check; pnpm lint`
Expected: 0 error

- [ ] **Step 4: 构建发布包**

Run: `pnpm build:packages`
Expected: 成功（vue 包产物含新交互语义）

- [ ] **Step 5: Commit（如有守卫补丁）**

```bash
git add -A
git commit -m "fix(core): guard indicator and renderer consumers against future-range out-of-bounds reads"
```

---

### Task 9: 端到端手工验收（MT5 实链路）

**Files:** 无代码改动；发现问题回到对应 Task 修复。

- [ ] **Step 1: 启动环境**

Run: `pnpm dev -c mt5`（后台）；确认 `http://localhost:5175/` 200、`http://127.0.0.1:8090/api/v1/market-data/sources/mt5/probe` online。

- [ ] **Step 2: 浏览器验证清单（bsk 会话 + 截图）**

1. 加载 EURUSD 日线，向右拖动：最后一根 K 线可推过绘图区右缘直至靠左，未来区约 3 屏
2. 十字光标移入未来区：纵向线存在、底部时间签显示未来交易日（周五后是周一）
3. 未来区纵向网格与刻度存在且颜色降级
4. 价格轴在纯未来区不跳变（保持最后区间）
5. 切 15min 周期重复 1-3（日内跨日预测标签合理）
6. 拖回实时区：`scrollToRight` 行为正常、最新价标签/倒计时正常
7. 绘图：趋势线终点可落在未来区（既有外推能力回归）

- [ ] **Step 3: 通过后收尾**

确认 `git status` 干净；如有修复提交一并列入；向用户汇报验收截图与结论。
