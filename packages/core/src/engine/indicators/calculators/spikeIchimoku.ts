/**
 * 临时 spike（#273 验证用，验收后移除）：一目均衡表 calculator。
 * Donchian 中轨三线 + 位移对齐先行带 + 延迟线；计数模式 original（disp=kijun−1）/
 * classic（disp=kijun）。输出 { spike: { series, params } }，bar 下标对齐。
 */
import type { KLineData } from '@/foundation/types/price.js'

export interface SpikeIchimokuParams {
  tenkan: number
  kijun: number
  senkouB: number
  mode: 'original' | 'classic'
}

interface SpikeBar {
  tenkan?: number
  kijun?: number
  spanA?: number
  spanB?: number
  chikou?: number
}

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

export function calcSpikeIchimokuData(
  data: KLineData[],
  tenkanLen: number,
  kijunLen: number,
  senkouBLen: number,
  mode: 'original' | 'classic',
): SpikeRawResult {
  const params: SpikeIchimokuParams = { tenkan: tenkanLen, kijun: kijunLen, senkouB: senkouBLen, mode }
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

  const disp = mode === 'original' ? params.kijun - 1 : params.kijun
  const series: SpikeBar[] = new Array(n)
  for (let i = 0; i < n; i++) {
    const bar: SpikeBar = {}
    if (Number.isFinite(tenkan[i])) bar.tenkan = tenkan[i]
    if (Number.isFinite(kijun[i])) bar.kijun = kijun[i]
    const j = i - disp
    if (j >= 0) {
      if (Number.isFinite(senkouA[j])) bar.spanA = senkouA[j]
      if (Number.isFinite(senkouB[j])) bar.spanB = senkouB[j]
    }
    const k = i + disp
    if (k < n && Number.isFinite(c[k])) bar.chikou = c[k]
    series[i] = bar
  }
  return { spike: { series, params } }
}

interface SpikeRawResult {
  spike: { series: SpikeBar[]; params: SpikeIchimokuParams }
}
