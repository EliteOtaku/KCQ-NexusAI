/**
 * 临时 spike（#273 验证用，验收后整文件移除）：
 * 编程式外部指标注册端到端验证——一目均衡表主图（转折/基准/先行A/B/延迟线+云填充）。
 *
 * 验证点：
 *  1. registerIndicatorDefinition 注册的新指标进入指标选择器（添加指标列表）
 *  2. runtime.compute（主线程）→ visibleState.compose → rendererFactory 全链路接线
 *  3. 原生指标渲染管线对主图线/云的帧纪律（对照外部渲染层的错帧抖动）
 *  4. 原生渲染视觉质量（云多空填充/主题色/虚线延迟线）
 *
 * 注册方式与交付形态对齐：闭源侧 bundle 将来经 loader 传入的
 * registerIndicatorDefinition 注册（与 #272 registerToolHost 同族）。
 */
import type { RendererPluginWithHost } from '@363045841yyt/klinechart-core'
import { registerIndicatorDefinition } from '@363045841yyt/klinechart-core/controllers'

// ── 配色（Pine ② 显示烧录默认值）──
const C_TENKAN = '#F23645'
const C_KIJUN = '#2962FF'
const C_SPAN_A = '#FF9800'
const C_SPAN_B = '#636363'

interface SpikeBar {
  tenkan?: number
  kijun?: number
  spanA?: number
  spanB?: number
  chikou?: number
}

interface SpikeParams {
  tenkan: number
  kijun: number
  senkouB: number
  mode: 'original' | 'classic'
}

interface SpikeRawResult {
  spike: { series: SpikeBar[]; params: SpikeParams }
}

function dispOf(p: SpikeParams): number {
  return p.mode === 'original' ? p.kijun - 1 : p.kijun
}

/** 固定窗口滚动极值（单调队列 O(n)）；i < len-1 为 NaN */
function rollingExtreme(src: Float64Array, len: number, isMax: boolean): Float64Array {
  const n = src.length
  const out = new Float64Array(n).fill(NaN)
  if (len <= 0 || n === 0) return out
  const dq: number[] = []
  for (let i = 0; i < n; i++) {
    const v = src[i]
    while (dq.length && (isMax ? src[dq[dq.length - 1]] <= v : src[dq[dq.length - 1]] >= v)) dq.pop()
    dq.push(i)
    while (dq[0] < i - len + 1) dq.shift()
    if (i >= len - 1) out[i] = src[dq[0]]
  }
  return out
}

function donchianMid(h: Float64Array, l: Float64Array, len: number): Float64Array {
  const hi = rollingExtreme(h, len, true)
  const lo = rollingExtreme(l, len, false)
  const out = new Float64Array(h.length).fill(NaN)
  for (let i = len - 1; i < h.length; i++) out[i] = (hi[i] + lo[i]) / 2
  return out
}

/** 主线程 compute：bar 对齐一目序列（与蜡烛同源数据快照） */
function computeSpikeIchimoku(
  data: ReadonlyArray<{ high: number; low: number; close: number }>,
  params: SpikeParams,
): SpikeRawResult {
  const n = data.length
  const h = new Float64Array(n)
  const l = new Float64Array(n)
  const c = new Float64Array(n)
  for (let i = 0; i < n; i++) {
    h[i] = data[i].high
    l[i] = data[i].low
    c[i] = data[i].close
  }
  const tenkan = donchianMid(h, l, params.tenkan)
  const kijun = donchianMid(h, l, params.kijun)
  const senkouB = donchianMid(h, l, params.senkouB)
  const senkouA = new Float64Array(n).fill(NaN)
  for (let i = 0; i < n; i++) senkouA[i] = (tenkan[i] + kijun[i]) / 2

  const disp = dispOf(params)
  const series: SpikeBar[] = new Array(n)
  for (let i = 0; i < n; i++) {
    const bar: SpikeBar = {}
    if (Number.isFinite(tenkan[i])) bar.tenkan = tenkan[i]
    if (Number.isFinite(kijun[i])) bar.kijun = kijun[i]
    // 先行带位移对齐：第 i 根位置的云 = i-disp 根的原始 span（Pine offset=+disp）
    const j = i - disp
    if (j >= 0) {
      if (Number.isFinite(senkouA[j])) bar.spanA = senkouA[j]
      if (Number.isFinite(senkouB[j])) bar.spanB = senkouB[j]
    }
    // 延迟线：第 i 根位置画未来第 i+disp 根收盘（Pine offset=-disp）
    const k = i + disp
    if (k < n && Number.isFinite(c[k])) bar.chikou = c[k]
    series[i] = bar
  }
  return { spike: { series, params } }
}

/** visibleState composer：可见区极值（主图指标只供图例/边界，不驱动价格轴） */
function composeSpikeVisibleState({
  entry,
  visibleRange,
  timestamp,
  active,
}: {
  entry: unknown
  visibleRange: { start: number; end: number }
  timestamp: number
  active: boolean
}) {
  const w2 = window as unknown as { __spikeCompose?: { calls: number; entryKeys: string[]; entrySample: string } }
  w2.__spikeCompose ??= { calls: 0, entryKeys: [], entrySample: '' }
  w2.__spikeCompose.calls++
  if (w2.__spikeCompose.entryKeys.length === 0 && entry != null) {
    w2.__spikeCompose.entryKeys = Object.keys(entry as Record<string, unknown>)
    try {
      w2.__spikeCompose.entrySample = JSON.stringify(entry).slice(0, 300)
    } catch {
      w2.__spikeCompose.entrySample = 'unserializable'
    }
  }
  // 实例输出容器：entry.series = compute 结果（双层包裹，spike 键在 entry.series 下）
  const src = (entry as { series?: SpikeRawResult } | undefined)?.series?.spike ?? {
    series: [] as SpikeBar[],
    params: { tenkan: 9, kijun: 26, senkouB: 52, mode: 'original' as const },
  }
  let min = Infinity
  let max = -Infinity
  if (active) {
    for (let i = visibleRange.start; i < visibleRange.end && i < src.series.length; i++) {
      const b = src.series[i]
      if (!b) continue
      for (const v of [b.tenkan, b.kijun, b.spanA, b.spanB]) {
        if (typeof v === 'number' && Number.isFinite(v)) {
          if (v < min) min = v
          if (v > max) max = v
        }
      }
    }
  }
  return {
    timestamp,
    series: src.series,
    params: src.params,
    valueMin: Number.isFinite(min) ? min : 0,
    valueMax: Number.isFinite(max) ? max : 1,
    visibleMin: min,
    visibleMax: max,
  }
}

function rgba(hex: string, alpha: number): string {
  const v = parseInt(hex.slice(1), 16)
  return `rgba(${(v >> 16) & 255},${(v >> 8) & 255},${v & 255},${alpha})`
}

interface SpikeRendererOptions {
  paneId?: string
  instanceId?: string
}

function createSpikeIchimokuRenderer(options: SpikeRendererOptions = {}): RendererPluginWithHost {
  const { paneId = 'main', instanceId } = options
  const w = window as unknown as { __spike?: { created: number; draws: number; hasState: boolean; stateBars: number } }
  w.__spike ??= { created: 0, draws: 0, hasState: false, stateBars: 0 }
  w.__spike.created++
  return {
    name: `spike_ichimoku_${paneId}`,
    version: '0.1.0',
    description: '一目·原生Spike 渲染器（#273 验证）',
    paneId,
    priority: 49,
    getDeclaredNamespaces() {
      return instanceId ? [instanceId] : []
    },
    draw(context) {
      const w = window as unknown as { __spike?: { created: number; draws: number; hasState: boolean; stateBars: number } }
      if (w.__spike) w.__spike.draws++
      const state = context.indicatorStateReader?.get<{
        series: SpikeBar[]
        params: SpikeParams
      }>(instanceId ?? '')
      if (!state) return
      if (w.__spike) {
        w.__spike.hasState = true
        w.__spike.stateBars = state.series?.length ?? 0
      }
      const { ctx, pane, range, scrollLeft, kLineCenters } = context
      const toY = (v: number) => pane.yAxis.priceToY(v)
      const drawEnd = Math.min(range.end + dispOf(state.params), state.series.length)
      const start = Math.max(range.start, 0)

      const mkPts = (pick: (b: SpikeBar) => number | undefined): Array<{ x: number; y: number }> => {
        const pts: Array<{ x: number; y: number }> = []
        for (let i = start; i < drawEnd; i++) {
          const b = state.series[i]
          const v = b ? pick(b) : undefined
          const cx = kLineCenters[i - range.start]
          if (typeof v === 'number' && Number.isFinite(v) && cx !== undefined) {
            pts.push({ x: cx, y: toY(v) })
          }
        }
        return pts
      }
      const spanAPts = mkPts((b) => b.spanA)
      const spanBPts = mkPts((b) => b.spanB)
      const tenkanPts = mkPts((b) => b.tenkan)
      const kijunPts = mkPts((b) => b.kijun)
      const chikouPts = mkPts((b) => b.chikou)

      ctx.save()
      ctx.translate(-scrollLeft, 0)

      // 云填充（spanA/spanB 逐段四边形，多头橙/空头灰；Pine transp85 → α0.15）
      for (let i = 1; i < spanAPts.length; i++) {
        const a0 = spanAPts[i - 1]
        const b0 = spanBPts[i - 1]
        const a1 = spanAPts[i]
        const b1 = spanBPts[i]
        if (!a0 || !b0 || !a1 || !b1) continue
        ctx.fillStyle = rgba(a0.y <= b0.y ? C_SPAN_A : C_SPAN_B, 0.15)
        ctx.beginPath()
        ctx.moveTo(a0.x, a0.y)
        ctx.lineTo(a1.x, a1.y)
        ctx.lineTo(b1.x, b1.y)
        ctx.lineTo(b0.x, b0.y)
        ctx.closePath()
        ctx.fill()
      }
      // 边线 A/B（α0.6 宽 2）
      const drawLine = (
        pts: Array<{ x: number; y: number }>,
        color: string,
        width: number,
        dash: number[],
      ): void => {
        if (pts.length < 2) return
        ctx.strokeStyle = color
        ctx.lineWidth = width
        ctx.setLineDash(dash)
        ctx.beginPath()
        ctx.moveTo(pts[0].x, pts[0].y)
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y)
        ctx.stroke()
        ctx.setLineDash([])
      }
      drawLine(spanAPts, rgba(C_SPAN_A, 0.6), 2, [])
      drawLine(spanBPts, rgba(C_SPAN_B, 0.6), 2, [])
      drawLine(tenkanPts, C_TENKAN, 2, [])
      drawLine(kijunPts, C_KIJUN, 2, [])
      // 延迟线虚线（深色图白/浅色图深灰——主题近似：按背景亮度）
      const bgLight = context.theme ? String(context.theme).toLowerCase().includes('light') : false
      drawLine(chikouPts, bgLight ? '#131722' : '#FFFFFF', 2, [6, 4])

      ctx.restore()
    },
  }
}

registerIndicatorDefinition(
  {
    name: 'spike_ichimoku',
    displayName: '一目·原生Spike',
    kind: 'indicator' as never,
    category: 'main' as never,
    indicatorType: 'trend' as never,
    defaultPaneId: 'main',
    allowMainPane: true,
    mainPane: { rendererName: 'spike_ichimoku_main' },
    visibleState: { compose: composeSpikeVisibleState as never },
    presentation: {
      defaultOptions: { showLines: true, showCloud: true, showChikou: true },
    },
    runtime: {
      defaultParams: { tenkan: 9, kijun: 26, senkouB: 52, mode: 'original' },
      computeKey: 'calcSpikeIchimokuData',
      compute: computeSpikeIchimoku as never,
      outputAlignment: 'bar' as never,
    },
    ui: {
      name: '一目·原生Spike',
      description: '#273 spike：编程式注册的外部一目指标（转折/基准/先行带/延迟线+云）',
    },
  } as never,
  (options: SpikeRendererOptions) => createSpikeIchimokuRenderer(options) as never,
)
