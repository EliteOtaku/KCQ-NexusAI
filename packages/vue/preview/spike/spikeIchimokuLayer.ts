/* 临时 spike，验证 #283：把一目均衡表渲染套件接到 upstream/main 官方第三方注册面
 * （ChartController.useRenderer/removeRenderer/getRenderer/requestRender，
 * 契约 = rendering/scene/types.ts Layer<RenderContext>）。
 *
 * spike 范围（勿当生产代码）：
 * - 固定缺省配置（defaultCfg()）+ 固定品种 XAUUSD + 固定体制 7x24；
 *   面板（ichimokuPanel.ts）与工厂（ichimoku.ts）不搬。
 * - role/z 判定：role 取 'indicator'（scene 语义 = MA/BOLL 类指标绘制；上游
 *   chartRenderer 把 indicator 角色归入 MAIN canvas 帧，随 Main/All 级重绘，
 *   缩放/拖动正确跟随；'overlay' 角色只随 Overlay 帧重绘，主帧移动时残影）。
 *   z 取 51：蜡烛层（RENDERER_PRIORITY.MAIN=50）之上、标记/十字线（80/150）之下。
 * - 坐标语义与 fork 一致：kLineCenters = scrollLeft 内容绝对坐标，本层内部
 *   translate(-scrollLeft) 落屏幕空间（candle renderer 同款）。
 * - 调试句柄：window.__spike283（layerMounted/draws/mainBars/htfSlotsReady/...）。
 */
import type { ChartController, KLineData } from '@363045841yyt/klinechart-core/controllers'
import type { Layer, RenderContext } from '@363045841yyt/klinechart-core'
import { IchimokuBarStore } from './ichimokuData'
import { createIchimokuOverlay, createIchimokuSharedState } from './ichimokuOverlay'
import { defaultCfg, type KlinePeriodKey } from './ichimokuParams'

export const SPIKE_LAYER_ID = 'spike_ichimoku_overlay'
export const SPIKE_SYMBOL = 'XAUUSD'

/** HTF 槽周期与根数（spike 最小集：给切片层供数，主图数据层共用同一 store） */
const SPIKE_HTF_SLOTS: ReadonlyArray<{ tf: KlinePeriodKey; bars: number }> = [
  { tf: '60min', bars: 150 },
  { tf: '4h', bars: 150 },
  { tf: 'daily', bars: 150 },
  { tf: 'weekly', bars: 150 },
  { tf: 'monthly', bars: 150 },
]

/** 主图（daily）拉取深度：warmup(60) + 视窗 + 云位移余量，500 根足够 */
const SPIKE_MAIN_DEPTH = 500

/** playwright 冒烟调试句柄（临时 spike，验证 #283） */
export interface Spike283Handle {
  layerMounted: boolean
  draws: number
  mainBars: number
  htfSlotsReady: number
  requestRenderCalls: number
  lastPaintAt: number | null
  /** 数据就绪后是否已做视口校正（zoomToLevel + scrollToRight，见 App.vue spike 块） */
  viewportReset: boolean
  /** 最近一帧 RenderContext 关键字段采样（字段兼容核对用） */
  lastFrame: Record<string, unknown> | null
  errors: string[]
}

declare global {
  interface Window {
    __spike283?: Spike283Handle
  }
}

/** spike 共享 bar store：主图与 HTF 槽同仓（连接器分页/失败标记全复用） */
const store = new IchimokuBarStore()

const handle: Spike283Handle = {
  layerMounted: false,
  draws: 0,
  mainBars: 0,
  htfSlotsReady: 0,
  requestRenderCalls: 0,
  lastPaintAt: null,
  viewportReset: false,
  lastFrame: null,
  errors: [],
}

/** 拉主图 daily bars 并映射成宿主 KLineData（字段实名 timestamp/open/high/low/close） */
export async function loadSpikeMainData(): Promise<KLineData[]> {
  await store.refresh(SPIKE_SYMBOL, 'daily', SPIKE_MAIN_DEPTH)
  const entry = store.get(SPIKE_SYMBOL, 'daily')
  const bars = (entry?.bars ?? []).map((b) => ({
    timestamp: b.t,
    open: b.o,
    high: b.h,
    low: b.l,
    close: b.c,
  }))
  handle.mainBars = bars.length
  if (entry?.failed) handle.errors.push(`main: fetch failed (stale=${bars.length})`)
  return bars
}

/** 并行拉 HTF 槽数据进 store；返回拿到数据的槽数 */
export async function loadSpikeHtfSlots(): Promise<number> {
  await Promise.all(
    SPIKE_HTF_SLOTS.map(({ tf, bars }) => store.refresh(SPIKE_SYMBOL, tf, bars)),
  )
  let ready = 0
  for (const { tf } of SPIKE_HTF_SLOTS) {
    if ((store.get(SPIKE_SYMBOL, tf)?.bars.length ?? 0) > 0) ready++
  }
  handle.htfSlotsReady = ready
  return ready
}

/** 组装官方 Layer 并经 controller.useRenderer 挂载；返回卸载函数（临时 spike） */
export function mountSpikeIchimokuLayer(controller: ChartController): () => void {
  const state = createIchimokuSharedState({
    cfg: defaultCfg(), // spike：固定缺省配置（原著修正计数 + 全默认切片）
    regime: '7x24', // XAUUSD 贵金属 CFD 连续行情（ichimokuParams 体制口径）
    regimeBasis: 'spike283 固定 7×24（XAUUSD · 贵金属 CFD）',
    symbol: SPIKE_SYMBOL,
    store,
  })
  state.themeDark = controller.theme.peek() === 'dark'

  const plugin = createIchimokuOverlay(state)

  const layer: Layer<RenderContext> = {
    id: SPIKE_LAYER_ID,
    role: 'indicator', // 判定依据见文件头注释（MAIN canvas 帧，随缩放/拖动重绘）
    pane: 'main',
    z: 51, // 蜡烛(50)之上、标记/十字线(80/150)之下
    visible: true,
    paint(rc) {
      handle.draws++
      handle.lastPaintAt = Date.now()
      // 每 5 帧采样一次 RenderContext 关键字段（字段兼容核对 + 冒烟诊断）
      if (handle.draws % 5 === 1) {
        const d0 = rc.data.length ? (rc.data[0] as { timestamp?: number }).timestamp : null
        const dN = rc.data.length
          ? (rc.data[rc.data.length - 1] as { timestamp?: number }).timestamp
          : null
        const d10 = rc.data[10] as Record<string, unknown> | undefined
        handle.lastFrame = {
          paneId: (rc as { paneId?: string }).paneId ?? null,
          period: rc.period,
          dataLen: rc.data.length,
          firstTs: d0,
          lastTs: dN,
          liFirst: d0 == null ? null : rc.getLogicalIndexAtTimestamp(d0),
          liLast: dN == null ? null : rc.getLogicalIndexAtTimestamp(dN),
          datum10: d10
            ? {
                ts: d10.timestamp,
                open: [typeof d10.open, d10.open],
                high: [typeof d10.high, d10.high],
                low: [typeof d10.low, d10.low],
                close: [typeof d10.close, d10.close],
              }
            : null,
          rangeStart: rc.range?.start ?? null,
          rangeEnd: rc.range?.end ?? null,
          centers: rc.kLineCenters?.length ?? null,
          centerFirst: rc.kLineCenters?.[0] ?? null,
          centerLast: rc.kLineCenters?.[rc.kLineCenters.length - 1] ?? null,
          scrollLeft: rc.scrollLeft,
          paneWidth: rc.paneWidth,
          kWidth: rc.kWidth,
          kGap: rc.kGap,
          kBarRects: rc.kBarRects?.length ?? null,
          dpr: rc.dpr,
          priceToY4200: rc.pane?.yAxis?.priceToY?.(4200) ?? null,
          priceToY2940: rc.pane?.yAxis?.priceToY?.(2940) ?? null,
          theme: rc.theme,
          dataView: String((rc as { dataView?: unknown }).dataView),
        }
      }
      plugin.draw(rc) // 插件内部自带异常限频防护，不回抛
    },
    dispose() {
      plugin.onUninstall()
    },
  }

  controller.useRenderer(layer) // 官方注册面（#283）
  handle.layerMounted = controller.getRenderer(SPIKE_LAYER_ID) === layer
  window.__spike283 = handle

  return () => {
    controller.removeRenderer(SPIKE_LAYER_ID)
    handle.layerMounted = controller.getRenderer(SPIKE_LAYER_ID) !== undefined
  }
}
