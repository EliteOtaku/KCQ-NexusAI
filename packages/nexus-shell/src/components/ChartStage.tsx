// 图表舞台：在宿主 div 上直接挂载 core controller（controller 自建 DOM 脚手架），
// 指针/滚轮事件经 ChartPointerBridge 改写后转发引擎。
// 属性浮条与测量浮层是舞台内的覆盖层，不参与引擎 DOM。

import { useEffect, useRef, type RefObject } from 'react'
import {
  createChartController,
  DrawingInteractionController,
} from '@363045841yyt/klinechart-core/controllers'
import { ChartPointerBridge } from '../shell/pointerBridge'
import { useNexusShell } from '../shell/NexusShellContext'
import { SHELL_LABELS } from '../shell/labels'
import { DrawingStyleFlybar } from './DrawingStyleFlybar'

/** 图表舞台组件：每实例挂载一个图表。 */
export function ChartStage() {
  const shell = useNexusShell()
  const hostRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const host = hostRef.current
    if (host === null) return
    let disposed = false
    let cleanup = () => {}

    void (async () => {
      const ctrl = await createChartController({
        container: host,
        theme: 'dark',
        settings: { theme: 'dark', isAsiaMarket: true },
        // mock 市场会话：与 A 股同时段（引擎内置会话未含 'mock' 市场 id）。
        marketSessions: {
          mock: {
            timeZone: 'Asia/Shanghai',
            sessions: [
              { open: 9 * 60 + 30, close: 11 * 60 + 30 },
              { open: 13 * 60, close: 15 * 60 },
            ],
            slotMinutes: 1,
          },
        },
      })
      if (disposed) {
        void ctrl.dispose()
        return
      }

      const dic = new DrawingInteractionController(ctrl)
      ctrl.registerDrawingSession(dic)
      dic.setCallbacks({
        onDrawingCreated: shell.handleDrawingCreated,
        onDrawingSelected: (list) => ctrl.setSelectedDrawingIds(list.map((item) => item.id)),
      })

      const bridge = new ChartPointerBridge(ctrl, dic, shell.bridgeAccessors, {
        onMeasureChange: shell.setMeasureSession,
        onDrawingCreated: shell.handleDrawingCreated,
      })
      bridge.attach(host)
      shell.attachChart(ctrl, bridge)

      // dev-only 调试钩子：E2E 探针经此读取引擎状态（生产构建无 import.meta.env.DEV 分支）。
      if (import.meta.env.DEV) {
        ;(window as unknown as Record<string, unknown>).__nx = { ctrl, dic, bridge }
      }

      cleanup = () => {
        shell.detachChart()
        bridge.detach()
        void ctrl.dispose()
      }
    })()

    return () => {
      disposed = true
      cleanup()
    }
    // 挂载逻辑只跑一次；shell 回调均为稳定引用。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="nx-chart-stage">
      <div ref={hostRef} className="nx-chart-stage__host" />
      {shell.selectedDrawings.length > 0 && <DrawingStyleFlybar />}
      {shell.measureSession !== null && <MeasureOverlay hostRef={hostRef} />}
    </div>
  )
}

/** 测量浮层：拖拽矩形 + 价格差/百分比/K 线数读数。 */
function MeasureOverlay({ hostRef }: { hostRef: RefObject<HTMLDivElement | null> }) {
  const shell = useNexusShell()
  const session = shell.measureSession
  const ctrl = shell.ctrl
  if (session === null || ctrl === null) return null

  const host = hostRef.current
  if (host === null) return null
  const rect = host.getBoundingClientRect()
  const startX = session.startX - rect.left
  const startY = session.startY - rect.top
  const endX = session.currentX - rect.left
  const endY = session.currentY - rect.top

  const left = Math.min(startX, endX)
  const top = Math.min(startY, endY)
  const width = Math.abs(endX - startX)
  const height = Math.abs(endY - startY)

  // 读数：起止价格统一用起始 pane 反解（跨 pane 时量纲不同，取起点所在 pane）。
  const startPane = ctrl.getPaneAtY(startY)
  const endPane = startPane
  const startPrice =
    startPane !== undefined ? ctrl.yToPrice(startPane.paneId, startY - startPane.top) : null
  const endPrice = endPane !== undefined ? ctrl.yToPrice(endPane.paneId, endY - endPane.top) : null
  const startIndex = ctrl.getLogicalIndexAtX(startX)
  const endIndex = ctrl.getLogicalIndexAtX(endX)

  let deltaText = ''
  if (startPrice !== null && endPrice !== null) {
    const delta = endPrice - startPrice
    const percent = startPrice !== 0 ? (delta / startPrice) * 100 : 0
    deltaText = `${delta >= 0 ? '+' : ''}${delta.toFixed(2)} (${percent >= 0 ? '+' : ''}${percent.toFixed(2)}%)`
  }
  const bars =
    startIndex !== null && endIndex !== null
      ? Math.abs(Math.round(endIndex) - Math.round(startIndex))
      : null

  const directionUp = (endPrice ?? 0) >= (startPrice ?? 0)

  return (
    <div className="nx-measure" aria-hidden="true" style={{ left, top, width, height }}>
      <span
        className={`nx-measure__label nx-measure__label--${directionUp ? 'up' : 'down'}`}
        style={{ left: width, top: height }}
      >
        {deltaText}
        {bars !== null && <span className="nx-measure__bars">{SHELL_LABELS.measureBars(bars)}</span>}
      </span>
    </div>
  )
}
