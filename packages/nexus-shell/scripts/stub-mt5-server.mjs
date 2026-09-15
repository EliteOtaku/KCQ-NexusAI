/**
 * stub-mt5-server.mjs — MT5 冒烟探针的内嵌桩连接器（端口 8090）。
 * 实现 V1 probe/instruments/search/bars + SSE stream 的最小子集：
 * 固定 60 根日线（UTC 零点对齐），流连接 1.2s 后推一帧 forming 更新（收盘价 2600.5）。
 * 桩仅供 probe-mt5.mjs 进程内使用，验证壳侧 mt5 接线，不依赖真实终端。
 */

import { createServer } from 'node:http'

/** 日线步长（毫秒）。 */
const DAY_MS = 24 * 3600 * 1000

/** 桩品种描述（sessionId 对齐 core sourceRegistry 的 MT5 会话）。 */
const INSTRUMENT = {
  id: 'mt5:XAUUSD',
  sourceId: 'mt5',
  symbol: 'XAUUSD',
  name: 'Gold vs US Dollar',
  assetClass: 'forex',
  exchange: 'MT5',
  sessionId: 'MT5',
  tickSize: 0.01,
  providerRef: { symbol: 'XAUUSD' },
  capabilities: {
    bars: {
      periods: ['1min', '5min', '15min', '30min', '60min', '4h', 'daily', 'weekly', 'monthly'],
      adjustments: ['none'],
    },
  },
}

/** 生成以 nowFloor 为末根的固定 60 根日线。 */
function buildBars(count = 60) {
  const endTs = Math.floor(Date.now() / DAY_MS) * DAY_MS
  const bars = []
  for (let i = count - 1; i >= 0; i--) {
    const ts = endTs - i * DAY_MS
    const base = 2500 + (count - i)
    bars.push({
      timestamp: ts,
      open: base,
      high: base + 8,
      low: base - 6,
      close: base + 2,
      volume: 1000 + i,
    })
  }
  return bars
}

/** 活跃 SSE 连接计数（探针断言断流用）。 */
const state = { activeStreams: 0, totalStreams: 0, lastFormingSent: false, requests: [] }

/** 启动桩连接器；返回关闭函数。 */
export function startStubMt5Server(port = 8090) {
  const server = createServer((req, res) => {
    const url = new URL(req.url, `http://127.0.0.1:${port}`)
    state.requests.push(`${req.method} ${url.pathname}`)
    if (state.requests.length > 50) state.requests.shift()
    // 跨源放开（真实连接器同样放开 CORS，前端 dev server 直连）
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Last-Event-ID')
    if (req.method === 'OPTIONS') {
      res.writeHead(204)
      res.end()
      return
    }
    const send = (body, status = 200, type = 'application/json') => {
      res.writeHead(status, { 'Content-Type': type })
      res.end(typeof body === 'string' ? body : JSON.stringify(body))
    }

    if (req.method === 'GET' && url.pathname.endsWith('/probe')) {
      send({
        data: {
          status: 'online',
          checkedAt: Date.now(),
          alignment: { enabled: true, serverOffsetMinutes: 180 },
          // capabilities 是 SourceRouter 的流转依据，缺省会拒绝 bars 请求
          capabilities: {
            assetClasses: ['forex'],
            bars: {
              periods: ['1min', '5min', '15min', '30min', '60min', '4h', 'daily', 'weekly', 'monthly'],
              adjustments: ['none'],
            },
          },
        },
        requestId: 'stub-probe',
      })
      return
    }

    if (req.method === 'POST' && url.pathname.endsWith('/instruments/search')) {
      let raw = ''
      req.on('data', (chunk) => (raw += chunk))
      req.on('end', () => {
        const body = JSON.parse(raw)
        const keyword = (body.keyword || '').toLowerCase()
        const hit =
          INSTRUMENT.symbol.toLowerCase().includes(keyword) ||
          INSTRUMENT.name.toLowerCase().includes(keyword)
        send({ data: { items: hit ? [INSTRUMENT] : [] }, requestId: 'stub-search' })
      })
      return
    }

    if (req.method === 'POST' && url.pathname.endsWith('/bars')) {
      let raw = ''
      req.on('data', (chunk) => (raw += chunk))
      req.on('end', () => {
        const body = JSON.parse(raw)
        const all = buildBars()
        let items = all
        if (body.beforeTimestamp !== undefined) {
          items = all.filter((bar) => bar.timestamp < body.beforeTimestamp)
        }
        items = items.slice(-Math.min(body.limit ?? 300, items.length))
        send({
          data: {
            instrumentId: body.instrument.id,
            period: body.period,
            adjustment: 'none',
            timezone: 'UTC',
            items,
            olderData: 'available',
          },
          requestId: 'stub-bars',
        })
      })
      return
    }

    if (req.method === 'GET' && url.pathname.endsWith('/stream')) {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
      })
      state.activeStreams += 1
      state.totalStreams += 1
      const bars = buildBars()
      const last = bars[bars.length - 1]
      // 快照：尾部两根
      res.write(`id: 1\ndata: ${JSON.stringify({ type: 'snapshot', symbol: 'XAUUSD', period: url.searchParams.get('period'), bars: bars.slice(-2) })}\n\n`)
      // 1.2s 后推 forming 更新（close 改 2600.5，探针据此断言 updateBars 生效）
      const timer = setTimeout(() => {
        state.lastFormingSent = true
        res.write(
          `id: 2\ndata: ${JSON.stringify({ type: 'forming', symbol: 'XAUUSD', period: url.searchParams.get('period'), bar: { ...last, close: 2600.5 } })}\n\n`,
        )
      }, 1200)
      const keepalive = setInterval(() => res.write(': keepalive\n\n'), 3000)
      req.on('close', () => {
        clearTimeout(timer)
        clearInterval(keepalive)
        state.activeStreams -= 1
      })
      return
    }

    send({ error: { code: 'INVALID_REQUEST', message: `no route: ${req.method} ${url.pathname}` } }, 404)
  })

  return new Promise((resolve) => {
    server.listen(port, '127.0.0.1', () => {
      resolve({
        state,
        close: () => new Promise((done) => server.close(() => done())),
      })
    })
  })
}
