// 图表指针事件桥：壳在事件进入引擎前施加 TV 习惯修正——
// 磁吸（OHLC 吸附）、Shift 锁角 45°、Shift 点选归一化为 Ctrl 多选、
// 测量工具、橡皮擦、Ctrl 拖拽复制（事后在原位重建“原件”）。
// 引擎无对应能力（见 action-checklist.md 引擎缺口 G-01/G-02/G-03/G-06），全部壳层实现。

import type { ChartController } from '@363045841yyt/klinechart-core/controllers'
import { DrawingInteractionController } from '@363045841yyt/klinechart-core/controllers'
import type { DrawingObject } from '@363045841yyt/klinechart-core/plugin'
import { isEngineDrawingTool, isMultiAnchorTool } from './drawingTools'

/** 磁吸三态。 */
export type MagnetMode = 'off' | 'weak' | 'strong'

/** 测量会话状态；frozen 表示松手后保留显示。 */
export interface MeasureSession {
  startX: number
  startY: number
  currentX: number
  currentY: number
  frozen: boolean
}

/** 桥读取壳偏好的访问器（由 React 侧以 ref 形式提供，避免重建桥）。 */
export interface BridgeStateAccessors {
  getActiveTool(): string
  getMagnet(): MagnetMode
}

/** 桥向 React 上抛的回调。 */
export interface BridgeHooks {
  /** 测量会话变化（null 表示清除）。 */
  onMeasureChange(session: MeasureSession | null): void
  /** 引擎完成一次图元创建（stay/模板自动套用在此接线）。 */
  onDrawingCreated(drawing: DrawingObject): void
}

/** 磁吸吸附半径（px）：weak 只吸高低点，strong 吸 OHLC 四值。 */
const MAGNET_RADIUS_WEAK = 8
const MAGNET_RADIUS_STRONG = 15

/** 锁角/拖拽的最小位移阈值。 */
const ANGLE_LOCK_MIN_DELTA = 2

/**
 * 指针桥：attach 后接管容器的指针/滚轮事件，按壳偏好改写后转发引擎。
 * 一个图表实例对应一个桥；detach 必须在 dispose 前调用。
 */
export class ChartPointerBridge {
  private container: HTMLElement | null = null
  private readonly listeners = new Array<() => void>()

  /** 当前多锚点工具已落点数（锁角基准跟踪）。 */
  private anchorClicks = 0
  /** 上一个锚点的 client 坐标（锁角基准）。 */
  private lastAnchorClient: { x: number; y: number } | null = null
  /** Ctrl 按下时的绘图快照（拖拽复制结算用）。 */
  private dragCopySnapshot: ReadonlyArray<DrawingObject> | null = null
  /** 本次按下是否以“去 Ctrl 合成事件”开拖（拖拽复制armed 标记）。 */
  private ctrlDragArmed = false
  /** 测量会话。 */
  private measure: MeasureSession | null = null

  constructor(
    private readonly ctrl: ChartController,
    private readonly dic: DrawingInteractionController,
    private readonly state: BridgeStateAccessors,
    private readonly hooks: BridgeHooks,
  ) {}

  /** 接管容器事件。重复 attach 由调用方保证不发生。 */
  attach(container: HTMLElement): void {
    this.container = container
    const add = <K extends keyof HTMLElementEventMap>(
      type: K,
      listener: (event: HTMLElementEventMap[K]) => void,
      options?: AddEventListenerOptions,
    ) => {
      container.addEventListener(type, listener as EventListener, options)
      this.listeners.push(() => container.removeEventListener(type, listener as EventListener))
    }

    add('pointerdown', (event) => this.onPointerDown(event))
    add('pointermove', (event) => this.onPointerMove(event))
    add('pointerup', (event) => this.onPointerUp(event))
    add('pointerleave', (event) => this.onPointerLeave(event))
    add('contextmenu', (event) => event.preventDefault())
    add('wheel', this.onWheel, { passive: false })
  }

  /** 解除事件接管（不 dispose 图表）。 */
  detach(): void {
    for (const remove of this.listeners) remove()
    this.listeners.length = 0
    this.container = null
    this.measure = null
    this.dragCopySnapshot = null
    this.resetAnchorSession()
  }

  /** 是否有未完成的多锚点绘制（Esc 取消判定用）。 */
  hasPendingAnchors(): boolean {
    return this.anchorClicks > 0
  }

  /** 清空锚点会话状态（工具切换/Esc 后由壳调用）。 */
  resetAnchorSession(): void {
    this.anchorClicks = 0
    this.lastAnchorClient = null
  }

  /** 清除测量结果。 */
  clearMeasure(): void {
    if (this.measure === null) return
    this.measure = null
    this.hooks.onMeasureChange(null)
  }

  // ── 事件入口 ──

  private onPointerDown(event: PointerEvent): void {
    const tool = this.state.getActiveTool()

    // 测量：纯壳交互，事件不进引擎。每次派发新对象，保证 React 状态引用变化。
    if (tool === 'measure') {
      if (this.measure?.frozen) {
        this.clearMeasure()
        return
      }
      this.measure = {
        startX: event.clientX,
        startY: event.clientY,
        currentX: event.clientX,
        currentY: event.clientY,
        frozen: false,
      }
      this.hooks.onMeasureChange(this.measure)
      return
    }

    // 橡皮擦：借用光标点选语义命中图元，命中即删（引擎缺口 G-03 的壳侧组合实现）。
    if (tool === 'eraser') {
      this.dic.onPointerDown(event, this.container!)
      const ids = this.ctrl.getSelectedDrawingIds()
      if (ids.length > 0) this.ctrl.removeBatch(ids)
      return
    }

    // Ctrl 拖拽复制：按下命中已选图元时，剥离 Ctrl 转发（引擎把 Ctrl+down 路由为
    // 切换选中而非开拖拽），拖前快照，抬起时对被移动图元在原位重建副本。
    this.ctrlDragArmed = false
    if (tool === 'cursor' && (event.ctrlKey || event.metaKey) && this.hitsSelection(event)) {
      this.ctrlDragArmed = true
      this.dragCopySnapshot = this.ctrl.getFullDrawings()
    }

    let forwarded = event
    if (this.ctrlDragArmed) {
      forwarded = clonePointerEvent(event, { ctrlKey: false, metaKey: false })
    } else if (tool === 'cursor' && event.shiftKey && !event.ctrlKey) {
      // 光标模式下 Shift 点选 → Ctrl 多选语义归一化（引擎缺口 G-06）。
      forwarded = clonePointerEvent(event, { shiftKey: false, ctrlKey: true })
    }
    // 绘制模式：先磁吸后锁角（Shift 优先于磁吸，二者互斥使用）。
    if (isEngineDrawingTool(tool)) {
      if (forwarded.shiftKey && this.lastAnchorClient && isMultiAnchorTool(tool)) {
        forwarded = this.applyAngleLock(forwarded)
      } else {
        forwarded = this.applyMagnet(forwarded)
      }
    }

    let drawingConsumed = false
    this.ctrl.handlePointerEvent(forwarded, {
      onPointerDown: (innerEvent, innerContainer) => {
        drawingConsumed = this.dic.onPointerDown(innerEvent, innerContainer)
        return drawingConsumed
      },
    })

    if (isMultiAnchorTool(tool) && drawingConsumed) this.recordAnchor(forwarded)
  }

  private onPointerMove(event: PointerEvent): void {
    const tool = this.state.getActiveTool()

    if (tool === 'measure') {
      if (this.measure === null || this.measure.frozen) return
      // 派发新对象触发 React 重渲染（原对象引用不变会被 Object.is 判等跳过）。
      this.measure = {
        ...this.measure,
        currentX: event.clientX,
        currentY: event.clientY,
      }
      this.hooks.onMeasureChange(this.measure)
      return
    }

    let forwarded = event
    if (isEngineDrawingTool(tool)) {
      if (forwarded.shiftKey && this.lastAnchorClient && isMultiAnchorTool(tool)) {
        forwarded = this.applyAngleLock(forwarded)
      } else {
        forwarded = this.applyMagnet(forwarded)
      }
    }

    this.ctrl.handlePointerEvent(forwarded, {
      onPointerMove: (innerEvent, innerContainer) => this.dic.onPointerMove(innerEvent, innerContainer),
    })
  }

  private onPointerUp(event: PointerEvent): void {
    const tool = this.state.getActiveTool()

    if (tool === 'measure') {
      if (this.measure !== null && !this.measure.frozen) {
        this.measure = { ...this.measure, frozen: true }
        this.hooks.onMeasureChange(this.measure)
      }
      return
    }

    this.ctrl.handlePointerEvent(event, {
      onPointerUp: (innerEvent, innerContainer) => this.dic.onPointerUp(innerEvent, innerContainer),
    })

    if (this.ctrlDragArmed && this.dragCopySnapshot !== null) {
      this.restoreDragCopies(this.dragCopySnapshot)
      this.dragCopySnapshot = null
      this.ctrlDragArmed = false
    }
  }

  private onPointerLeave(event: PointerEvent): void {
    this.ctrl.handlePointerEvent(event)
  }

  private onWheel(event: WheelEvent): void {
    event.preventDefault()
    this.ctrl.handleWheelEvent(event)
  }

  // ── 私有：磁吸 / 锁角 / 复制 ──

  /**
   * 近似命中检测：指针是否落在某个已选图元的锚点附近（±padding）。
   * 锚点按持久化 type 分轴判定：horizontal 只看 Y、vertical 只看 X、点锚点看两轴。
   * 用于 Ctrl 拖拽复制的开拖判定；精确线段命中引擎未公开（G-03）。
   */
  private hitsSelection(event: PointerEvent): boolean {
    const container = this.container
    if (container === null) return false
    const selected = new Set(this.ctrl.getSelectedDrawingIds())
    if (selected.size === 0) return false
    const rect = container.getBoundingClientRect()
    const localX = event.clientX - rect.left
    const localY = event.clientY - rect.top
    const plotWidth = this.ctrl.getViewport()?.plotWidth ?? 0
    // 半径对齐引擎 HitTester：线段 6px、锚点 8px；过宽会把 Ctrl 点选误判为复制拖拽。
    const linePadding = 6
    const pointPadding = 8

    for (const drawing of this.ctrl.getFullDrawings()) {
      if (!selected.has(drawing.id)) continue
      const pane = this.ctrl.getPaneInfo(drawing.paneId)
      if (pane === undefined) continue
      for (const anchor of drawing.anchors) {
        const screenY = pane.top + this.ctrl.priceToY(drawing.paneId, anchor.price)
        if (anchor.type === 'horizontal') {
          if (localX >= 0 && localX <= plotWidth && Math.abs(localY - screenY) <= linePadding) {
            return true
          }
          continue
        }
        if (anchor.time === undefined) continue
        const index = this.ctrl.getLogicalIndexAtTimestamp(Number(anchor.time))
        const screenX = index === null ? null : this.ctrl.getScreenXAtLogicalIndex(index)
        if (screenX === null) continue
        if (anchor.type === 'vertical') {
          if (Math.abs(localX - screenX) <= linePadding) return true
          continue
        }
        if (
          Math.abs(localX - screenX) <= pointPadding &&
          Math.abs(localY - screenY) <= pointPadding
        ) {
          return true
        }
      }
    }
    return false
  }

  /** 记录一次锚点落点；达到工具锚点数后引擎会完成创建并回调重置。 */
  private recordAnchor(event: PointerEvent): void {
    this.anchorClicks += 1
    this.lastAnchorClient = { x: event.clientX, y: event.clientY }
  }

  /**
   * 磁吸：把指针坐标吸附到最近 K 线的 OHLC 极值与 Bar 中心。
   * weak 只吸 high/low，strong 吸 OHLC 四值；Ctrl/Meta 临时强吸。
   */
  private applyMagnet(event: PointerEvent): PointerEvent {
    const mode = event.ctrlKey || event.metaKey ? 'strong' : this.state.getMagnet()
    if (mode === 'off') return event

    const container = this.container
    if (container === null) return event
    const rect = container.getBoundingClientRect()
    const localX = event.clientX - rect.left
    const localY = event.clientY - rect.top

    const logicalIndex = this.ctrl.getLogicalIndexAtX(localX)
    if (logicalIndex === null) return event
    const data = this.ctrl.getData()
    const barIndex = Math.min(Math.max(Math.round(logicalIndex), 0), data.length - 1)
    const bar = data[barIndex]
    if (bar === undefined) return event

    const pane = this.ctrl.getPaneAtY(localY)
    if (pane === undefined) return event

    const candidates =
      mode === 'weak' ? [bar.high, bar.low] : [bar.high, bar.low, bar.open, bar.close]
    const radius = mode === 'weak' ? MAGNET_RADIUS_WEAK : MAGNET_RADIUS_STRONG
    const paneLocalY = localY - pane.top

    let bestY: number | null = null
    let bestDistance = radius
    for (const price of candidates) {
      const candidateY = this.ctrl.priceToY(pane.paneId, price)
      const distance = Math.abs(candidateY - paneLocalY)
      if (distance <= bestDistance) {
        bestDistance = distance
        bestY = candidateY
      }
    }

    const snappedX = this.ctrl.getScreenXAtLogicalIndex(barIndex)
    const nextClientX = snappedX === null ? event.clientX : rect.left + snappedX
    const nextClientY = bestY === null ? event.clientY : rect.top + pane.top + bestY
    if (nextClientX === event.clientX && nextClientY === event.clientY) return event
    return clonePointerEvent(event, { clientX: nextClientX, clientY: nextClientY })
  }

  /** Shift 锁角：把指针约束到上一锚点的 8 方向（45° 步进）射线上。 */
  private applyAngleLock(event: PointerEvent): PointerEvent {
    const anchor = this.lastAnchorClient
    if (anchor === null) return event
    const dx = event.clientX - anchor.x
    const dy = event.clientY - anchor.y
    if (Math.abs(dx) + Math.abs(dy) < ANGLE_LOCK_MIN_DELTA) return event

    const length = Math.hypot(dx, dy)
    const snappedAngle = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4)
    return clonePointerEvent(event, {
      clientX: anchor.x + Math.cos(snappedAngle) * length,
      clientY: anchor.y + Math.sin(snappedAngle) * length,
    })
  }

  /**
   * 拖拽复制结算：Ctrl 拖拽结束（或点击）后，凡锚点发生了移动的原选中图元，
   * 在拖前位置重建一个同款图元——“原件”留在原地，被拖走的就是副本。
   */
  private restoreDragCopies(snapshot: ReadonlyArray<DrawingObject>): void {
    const current = this.ctrl.getFullDrawings()
    for (const before of snapshot) {
      const after = current.find((drawing) => drawing.id === before.id)
      if (after === undefined) continue
      if (!anchorsMoved(before, after)) continue
      this.ctrl.createDrawing({
        kind: before.kind,
        paneId: before.paneId,
        anchors: before.anchors.map((anchor) => {
          // 水平线类锚点仅持久化 price（无 time），命令输入用 price-only 变体。
          if (anchor.time === undefined) return { price: anchor.price }
          return {
            timestamp: Number(anchor.time),
            futureOffset: anchor.futureOffset,
            price: anchor.price,
          }
        }),
        style: before.style,
        params: before.params,
        labels: before.labels,
        locked: before.locked,
        visible: before.visible,
      })
    }
  }
}

/** 比较两个图元的持久化锚点是否发生位移。 */
function anchorsMoved(before: DrawingObject, after: DrawingObject): boolean {
  if (before.anchors.length !== after.anchors.length) return true
  for (let index = 0; index < before.anchors.length; index++) {
    const a = before.anchors[index]!
    const b = after.anchors[index]!
    if (a.price !== b.price) return true
    if (a.time !== b.time) return true
    if (a.futureOffset !== b.futureOffset) return true
  }
  return false
}

/** 克隆 PointerEvent 并覆写指定初始字段（坐标/修饰键），其余原样保留。 */
function clonePointerEvent(
  event: PointerEvent,
  overrides: {
    clientX?: number
    clientY?: number
    shiftKey?: boolean
    ctrlKey?: boolean
    metaKey?: boolean
  },
): PointerEvent {
  return new PointerEvent(event.type, {
    bubbles: event.bubbles,
    cancelable: event.cancelable,
    composed: event.composed,
    view: event.view,
    detail: event.detail,
    pointerId: event.pointerId,
    pointerType: event.pointerType,
    isPrimary: event.isPrimary,
    button: event.button,
    buttons: event.buttons,
    clientX: overrides.clientX ?? event.clientX,
    clientY: overrides.clientY ?? event.clientY,
    screenX: event.screenX,
    screenY: event.screenY,
    altKey: event.altKey,
    shiftKey: overrides.shiftKey ?? event.shiftKey,
    ctrlKey: overrides.ctrlKey ?? event.ctrlKey,
    metaKey: overrides.metaKey ?? event.metaKey,
  })
}
