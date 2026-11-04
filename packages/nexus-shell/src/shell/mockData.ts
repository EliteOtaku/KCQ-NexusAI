// 壳层 demo 数据：确定性（固定种子）多品种多周期 K 线生成器。
// fork 自洽要求——不依赖任何后端；真数据联调属宿主侧职责。
// 以 MarketDataSource 形式注册进 MarketDataContext，与真实数据源共用路由和缓存。

import type { KLineData } from '@363045841yyt/klinechart-core/controllers'
import {
  type DataSourceInstrument,
  KLinePeriod,
  type MarketDataSource,
  OLDER_DATA_STATUS,
} from '@363045841yyt/klinechart-core/market-data'

/** 品种目录条目。 */
export interface MockSymbol {
  symbol: string
  name: string
  basePrice: number
  /** 最小变动价位（B4-04 方向键微调用）：指数 0.2、个股 0.01、ETF 0.001。 */
  tick: number
}

/** demo 品种目录：覆盖指数/个股/ETF 风格命名，供搜索与自选列表消费。 */
export const MOCK_SYMBOLS: ReadonlyArray<MockSymbol> = [
  { symbol: 'MOCK-SZ300', name: '示例·沪深300', basePrice: 3580, tick: 0.2 },
  { symbol: 'MOCK-SH501', name: '示例·上证50', basePrice: 2740, tick: 0.2 },
  { symbol: 'MOCK-CSI500', name: '示例·中证500', basePrice: 5320, tick: 0.2 },
  { symbol: 'MOCK-TECH', name: '示例·科技成长', basePrice: 86.5, tick: 0.01 },
  { symbol: 'MOCK-ENERGY', name: '示例·能源周期', basePrice: 128.4, tick: 0.01 },
  { symbol: 'MOCK-BOND', name: '示例·国债ETF', basePrice: 104.2, tick: 0.001 },
]

/** 支持的周期（与 core KLinePeriod 对齐；4h 为 fork 补丁能力）。 */
export const MOCK_PERIODS: ReadonlyArray<KLinePeriod> = [
  '1min',
  '5min',
  '15min',
  '30min',
  '60min',
  '4h',
  'daily',
  'weekly',
  'monthly',
]

/** mulberry32：体积小且确定性足够 demo 使用。 */
function mulberry32(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** 由字符串稳定散列出 32 位种子。 */
function hashSeed(input: string): number {
  let hash = 2166136261
  for (let index = 0; index < input.length; index++) {
    hash ^= input.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

/** 周期对应的毫秒步长；daily 以上按交易日近似（跳过周末）。 */
function periodStepMs(period: string): number {
  switch (period) {
    case '1min':
      return 60_000
    case '5min':
      return 300_000
    case '15min':
      return 900_000
    case '30min':
      return 1_800_000
    case '60min':
      return 3_600_000
    case '4h':
      return 4 * 3_600_000
    case 'daily':
      return 86_400_000
    case 'weekly':
      return 7 * 86_400_000
    case 'monthly':
      return 30 * 86_400_000
    default:
      return 86_400_000
  }
}

/** 各周期生成根数：日线级少、分钟级多。 */
function barCountFor(period: string): number {
  if (period === 'daily') return 480
  if (period === 'weekly') return 420
  if (period === 'monthly') return 240
  if (period === '4h') return 600
  return 1200
}

/** 判断时间戳是否周末（UTC 近似；demo 数据不追求精确交易日历）。 */
function isWeekend(ts: number): boolean {
  const day = new Date(ts).getUTCDay()
  return day === 0 || day === 6
}

/** 推进到下一个非周末时间戳；分钟级数据同样跳过周末以留出间隙。 */

/**
 * 生成一段确定性 K 线：围绕 basePrice 的均值回归随机游走。
 * @param symbol 品种代码（参与种子）
 * @param period 周期（参与种子与步长）
 */
export function generateMockBars(symbol: string, period: string): ReadonlyArray<KLineData> {
  const spec = MOCK_SYMBOLS.find((item) => item.symbol === symbol) ?? MOCK_SYMBOLS[0]!
  const random = mulberry32(hashSeed(`${spec.symbol}:${period}`))
  const stepMs = periodStepMs(period)
  const count = barCountFor(period)

  // 终点锚定到最近的非周末时间，倒推起点，保证数据贴近“今天”。
  let endTs = Date.now()
  while (isWeekend(endTs)) endTs -= stepMs
  const timestamps: number[] = []
  for (let cursor = endTs, index = 0; index < count; index++) {
    timestamps.unshift(cursor)
    cursor = nextTimestampBackward(cursor, stepMs)
  }

  const volatility = Math.max(0.004, 0.02 * (stepMs / 86_400_000) ** 0.5)
  const data: KLineData[] = []
  let price = spec.basePrice * (0.9 + random() * 0.2)
  for (let index = 0; index < count; index++) {
    const reversion = 0.004 * (spec.basePrice - price)
    const drift = (random() - 0.5) * price * volatility * 2
    const close = round2(price + drift + reversion)
    const open = round2(index === 0 ? close * (1 - drift / price) : price)
    const high = round2(Math.max(open, close) * (1 + random() * volatility * 0.8))
    const low = round2(Math.min(open, close) * (1 - random() * volatility * 0.8))
    const volume = Math.round(200_000 + random() * 3_000_000)
    data.push({
      timestamp: timestamps[index]!,
      open,
      high,
      low,
      close,
      volume,
      turnover: Math.round(volume * ((open + close) / 2)),
    })
    price = close
  }
  return data
}

/** 时间戳回退一步（同样跳过周末），供倒推起点。 */
function nextTimestampBackward(ts: number, stepMs: number): number {
  let prev = ts - stepMs
  while (isWeekend(prev)) prev -= stepMs
  return prev
}

/** 保留两位小数。 */
function round2(value: number): number {
  return Math.round(value * 100) / 100
}

/** 壳层 mock 数据源 ID；SymbolSpec.source 与品种目录的 sourceId 都用它。 */
export const MOCK_SOURCE_ID = 'mock'

/** 壳层 mock 数据源：确定性 K 线 + 品种目录，注册后与真实数据源共用路由与缓存。 */
export function createMockDataSource(): MarketDataSource {
  const instruments: ReadonlyArray<DataSourceInstrument> = MOCK_SYMBOLS.map((spec) => ({
    id: spec.symbol,
    symbol: spec.symbol,
    name: spec.name,
    instrumentType: 'stock',
    exchange: 'MOCK',
    sessionId: MOCK_SOURCE_ID,
    timezone: 'Asia/Shanghai',
    tickSize: spec.tick,
    capabilities: { bars: { periods: MOCK_PERIODS, adjustments: ['none'] } },
  }))

  return {
    id: MOCK_SOURCE_ID,
    name: '演示数据',
    capabilities: {
      instrumentTypes: ['stock'],
      bars: { periods: MOCK_PERIODS, adjustments: ['none'] },
    },
    instruments: {
      /** 关键词为空时返回全部品种，供自选/搜索列表消费。 */
      async search(query) {
        const keyword = query.keyword.trim().toUpperCase()
        const matched = instruments.filter(
          (item) =>
            keyword === '' ||
            item.symbol.includes(keyword) ||
            item.name.includes(query.keyword.trim()),
        )
        return matched.slice(0, query.limit)
      },
      /** 按稳定 ID 解析品种；找不到即报错，不做兜底猜测。 */
      async resolve(id, signal) {
        signal.throwIfAborted()
        const instrument = instruments.find((item) => item.id === id)
        if (instrument === undefined) throw new Error(`演示数据源没有该品种：${id}`)
        return instrument
      },
    },
    bars: {
      /** 按品种与周期确定性生成；游标之前的份额按 limit 截取。 */
      async fetch(request) {
        const generated = generateMockBars(request.instrument.symbol, request.period)
        const available =
          request.beforeTimestamp === undefined
            ? generated
            : generated.filter((bar) => bar.timestamp < request.beforeTimestamp!)
        return {
          bars: available.slice(-request.limit),
          olderData:
            available.length > request.limit
              ? OLDER_DATA_STATUS.AVAILABLE
              : OLDER_DATA_STATUS.EXHAUSTED,
        }
      },
    },
  }
}
