// 壳上下文：图表 controller/交互桥 的挂载点，以及工具/磁吸/stay/收藏/模板/选中
// 等壳级状态与动作的唯一提供方。组件只消费本上下文，不直接持有引擎对象。

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type {
  ChartController,
  DrawingToolId,
} from '@363045841yyt/klinechart-core/controllers'
import type { DrawingObject, DrawingStyle } from '@363045841yyt/klinechart-core/plugin'
import { buildMockBundle, MOCK_SYMBOLS } from './mockData'
import { ChartPointerBridge, type MeasureSession, type MagnetMode } from './pointerBridge'
import type { ShellToolId } from './drawingTools'
import { loadLastUsedTemplate, markTemplateUsed } from './drawingTemplates'
import { readJson, writeJson, STORAGE_KEYS } from './storage'
import { EMPTY_IDS, useSignal } from './reactivity'

/** 壳偏好持久化形状（nexus.shell.prefs）。 */
interface ShellPrefs {
  magnet: MagnetMode
  stay: boolean
  autoApply: boolean
  /** 各分组最近使用的子工具 id（组按钮图标记忆）。 */
  groupLastTool: Record<string, string>
}

const DEFAULT_PREFS: ShellPrefs = { magnet: 'off', stay: false, autoApply: true, groupLastTool: {} }

/** 空图元数组兜底（稳定引用）。 */
const EMPTY_DRAWINGS: ReadonlyArray<DrawingObject> = []

/** 上下文值。 */
export interface NexusShellValue {
  ctrl: ChartController | null
  /** 当前选中图元 id 列表（kernel 信号镜像）。 */
  selectedIds: ReadonlyArray<string>
  /** 当前选中图元对象。 */
  selectedDrawings: ReadonlyArray<DrawingObject>
  /** 生效工具（伪工具优先，否则 kernel drawingTool）。 */
  activeTool: ShellToolId
  magnet: MagnetMode
  stay: boolean
  autoApply: boolean
  favorites: ReadonlyArray<string>
  groupLastTool: Record<string, string>
  measureSession: MeasureSession | null
  theme: 'light' | 'dark'
  symbol: string
  period: string
  /** 模板库版本号（保存/删除后自增，消费方据此重拉清单）。 */
  templateVersion: number

  attachChart(ctrl: ChartController, bridge: ChartPointerBridge): void
  detachChart(): void
  bridgeAccessors: { getActiveTool(): string; getMagnet(): MagnetMode }
  handleDrawingCreated(drawing: DrawingObject): void
  onAnchorSessionReset(): void
  setMeasureSession(session: MeasureSession | null): void

  selectTool(toolId: ShellToolId): void
  setGroupLastTool(groupId: string, toolId: string): void
  cycleMagnet(): void
  toggleStay(): void
  toggleAutoApply(): void
  toggleFavorite(toolId: string): void
  deleteSelection(): void
  clearSelection(): void
  updateSelectionStyle(style: Partial<DrawingStyle>): void
  applyTemplateToSelection(kind: string, name: string): void
  toggleSelectionLock(): void
  bumpTemplateVersion(): void
  setTheme(theme: 'light' | 'dark'): void
  toggleTheme(): void
  setSymbol(symbol: string): void
  setPeriod(period: string): void
}

const NexusShellContext = createContext<NexusShellValue | null>(null)

/** 消费壳上下文；必须在 NexusShellProvider 内使用。 */
export function useNexusShell(): NexusShellValue {
  const value = useContext(NexusShellContext)
  if (value === null) throw new Error('useNexusShell must be used within NexusShellProvider')
  return value
}

/** 壳状态提供方：App 根部挂载一次。 */
export function NexusShellProvider({ children }: { children: ReactNode }) {
  const [ctrl, setCtrl] = useState<ChartController | null>(null)
  const [bridge, setBridge] = useState<ChartPointerBridge | null>(null)

  const [pseudoTool, setPseudoTool] = useState<'measure' | 'eraser' | null>(null)
  const [prefs, setPrefs] = useState<ShellPrefs>(() => ({
    ...DEFAULT_PREFS,
    ...readJson<Partial<ShellPrefs>>(STORAGE_KEYS.prefs, {}),
  }))
  const [favorites, setFavorites] = useState<ReadonlyArray<string>>(() =>
    readJson<ReadonlyArray<string>>(STORAGE_KEYS.favorites, []),
  )
  const [measureSession, setMeasureSession] = useState<MeasureSession | null>(null)
  const [templateVersion, setTemplateVersion] = useState(0)
  const [symbol, setSymbol] = useState(MOCK_SYMBOLS[0]!.symbol)
  const [period, setPeriod] = useState('daily')
  const [shellTheme, setShellTheme] = useState<'light' | 'dark'>('dark')

  // 内核工具信号：引擎侧 SSOT（画完自动回 cursor 等）。
  const kernelTool = useSignal(ctrl?.drawingTool ?? null, 'cursor' as DrawingToolId)

  const activeTool: ShellToolId = pseudoTool ?? kernelTool

  // ── 信号镜像 ──
  const selectedIds = useSignal(ctrl?.selectedDrawingIds ?? null, EMPTY_IDS)
  const drawings = useSignal(ctrl?.drawings ?? null, EMPTY_DRAWINGS)
  const engineTheme = useSignal(ctrl?.theme ?? null, shellTheme)
  const theme = ctrl ? engineTheme : shellTheme

  const selectedDrawings = useMemo(() => {
    const ids = new Set(selectedIds)
    return drawings.filter((drawing) => ids.has(drawing.id))
  }, [drawings, selectedIds])

  // ── 偏好持久化 ──
  useEffect(() => {
    writeJson(STORAGE_KEYS.prefs, prefs)
  }, [prefs])
  useEffect(() => {
    writeJson(STORAGE_KEYS.favorites, favorites)
  }, [favorites])

  // 磁吸档位同步到引擎交互控制器（吸附执行方已下沉引擎）；桥挂载与偏好变化时各跑一次。
  useEffect(() => {
    bridge?.syncMagnet()
  }, [bridge, prefs.magnet])

  // ── 供桥读取的 ref 视图（桥持有稳定访问器，避免重建） ──
  const activeToolRef = useRef(activeTool)
  activeToolRef.current = activeTool
  const magnetRef = useRef(prefs.magnet)
  magnetRef.current = prefs.magnet
  const bridgeAccessors = useMemo(
    () => ({
      getActiveTool: () => activeToolRef.current as string,
      getMagnet: () => magnetRef.current,
    }),
    [],
  )

  // stay/自动套用/最近工具在 onDrawingCreated 回调里读取，避免闭包过期。
  const stayRef = useRef(prefs.stay)
  stayRef.current = prefs.stay
  const autoApplyRef = useRef(prefs.autoApply)
  autoApplyRef.current = prefs.autoApply
  const lastDrawingToolRef = useRef<ShellToolId>('cursor')
  // ctrl 也走 ref：ChartStage 在挂载期就把 handleDrawingCreated 接到交互控制器上，
  // 那一刻 ctrl 尚为 null，闭包里的 state 会永久过期。
  const ctrlRef = useRef<ChartController | null>(null)

  // ── 挂载 / 卸载 ──
  const attachChart = useCallback(
    (nextCtrl: ChartController, nextBridge: ChartPointerBridge) => {
      ctrlRef.current = nextCtrl
      setCtrl(nextCtrl)
      setBridge(nextBridge)
      // demo 基线：主图 MA + 副图成交量（失败静默，目录缺失不阻塞壳）。
      try {
        if (!nextCtrl.indicators.peek().some((item) => item.definitionId === 'MA')) {
          nextCtrl.addIndicator('MA', 'main')
        }
        if (!nextCtrl.indicators.peek().some((item) => item.definitionId === 'VOLUME')) {
          nextCtrl.addIndicator('VOLUME', 'sub')
        }
      } catch {
        /* 目录未就绪时跳过 */
      }
    },
    [],
  )

  const detachChart = useCallback(() => {
    ctrlRef.current = null
    setCtrl(null)
    setBridge(null)
    setMeasureSession(null)
  }, [])

  // ── 工具选择 ──
  const selectTool = useCallback(
    (toolId: ShellToolId) => {
      bridge?.resetAnchorSession()
      bridge?.clearMeasure()
      setPseudoTool(toolId === 'measure' || toolId === 'eraser' ? toolId : null)
      if (toolId === 'measure' || toolId === 'eraser') {
        // 伪工具下内核保持光标语义（点选/命中能力复用）。
        ctrl?.setDrawingToolId('cursor')
      } else {
        lastDrawingToolRef.current = toolId
        ctrl?.setDrawingToolId(toolId as DrawingToolId)
      }
    },
    [bridge, ctrl],
  )

  const setGroupLastTool = useCallback((groupId: string, toolId: string) => {
    setPrefs((prev) =>
      prev.groupLastTool[groupId] === toolId
        ? prev
        : { ...prev, groupLastTool: { ...prev.groupLastTool, [groupId]: toolId } },
    )
  }, [])

  const cycleMagnet = useCallback(() => {
    setPrefs((prev) => ({
      ...prev,
      magnet: prev.magnet === 'off' ? 'weak' : prev.magnet === 'weak' ? 'strong' : 'off',
    }))
  }, [])

  const toggleStay = useCallback(() => {
    setPrefs((prev) => ({ ...prev, stay: !prev.stay }))
  }, [])

  const toggleAutoApply = useCallback(() => {
    setPrefs((prev) => ({ ...prev, autoApply: !prev.autoApply }))
  }, [])

  const toggleFavorite = useCallback((toolId: string) => {
    setFavorites((prev) =>
      prev.includes(toolId) ? prev.filter((id) => id !== toolId) : [...prev, toolId],
    )
  }, [])

  // ── 选中集操作 ──
  const deleteSelection = useCallback(() => {
    const ids = ctrl?.selectedDrawingIds.peek() ?? []
    if (ids.length > 0) ctrl?.removeBatch(ids)
  }, [ctrl])

  const clearSelection = useCallback(() => {
    ctrl?.setSelectedDrawingIds([])
  }, [ctrl])

  const updateSelectionStyle = useCallback(
    (style: Partial<DrawingStyle>) => {
      const ids = ctrl?.selectedDrawingIds.peek() ?? []
      if (ids.length === 0) return
      ctrl?.updateBatch(ids, { style })
    },
    [ctrl],
  )

  /** 模板套用：合并式写入（updateBatch 的字段交集守卫会拒绝模板新增键）。 */
  const applyTemplateToSelection = useCallback(
    (kind: string, name: string) => {
      if (!ctrl) return
      markTemplateUsed(kind, name)
      const style = loadLastUsedTemplate(kind)
      if (!style) return
      const ids = new Set(ctrl.selectedDrawingIds.peek())
      for (const drawing of ctrl.drawings.peek()) {
        if (!ids.has(drawing.id)) continue
        ctrl.updateDrawing({ ...drawing, style: { ...drawing.style, ...style } })
      }
    },
    [ctrl],
  )

  const toggleSelectionLock = useCallback(() => {
    if (!ctrl) return
    const ids = ctrl.selectedDrawingIds.peek()
    if (ids.length === 0) return
    const selected = ctrl.drawings.peek().filter((drawing) => ids.includes(drawing.id))
    // 全部已锁 → 统一解锁，否则统一加锁。
    const lock = !selected.every((drawing) => drawing.locked === true)
    ctrl.updateBatch(ids, { locked: lock })
  }, [ctrl])

  const bumpTemplateVersion = useCallback(() => {
    setTemplateVersion((version) => version + 1)
  }, [])

  // ── 引擎回调（ChartStage 在交互控制器上接线） ──
  const handleDrawingCreated = useCallback(
    (drawing: DrawingObject) => {
      // 读取 ref 而非 state：本回调在图表挂载期就被固定到交互控制器上。
      const chartCtrl = ctrlRef.current
      if (!chartCtrl) return
      // stay：画完立刻恢复工具（先切工具再选中，避开会话重置清选中）。
      if (stayRef.current) {
        chartCtrl.setDrawingToolId(lastDrawingToolRef.current as DrawingToolId)
      }
      // 模板自动套用：按 kind 合并最近模板样式。
      if (autoApplyRef.current) {
        const template = loadLastUsedTemplate(drawing.kind)
        if (template) {
          chartCtrl.updateDrawing({
            ...drawing,
            style: { ...drawing.style, ...template },
          })
        }
      }
      chartCtrl.setSelectedDrawingIds([drawing.id])
    },
    [],
  )

  const onAnchorSessionReset = useCallback(() => {
    // 锚点会话属桥内部状态，React 侧无需镜像；保留空实现以稳定桥回调形状。
  }, [])

  // ── 主题 / 数据 ──
  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  const setTheme = useCallback(
    (next: 'light' | 'dark') => {
      setShellTheme(next)
      ctrl?.setTheme(next)
    },
    [ctrl],
  )

  /** 主题切换（顶栏按钮）。 */
  const toggleTheme = useCallback(() => {
    setTheme((ctrl?.theme.peek() ?? shellTheme) === 'dark' ? 'light' : 'dark')
  }, [ctrl, setTheme, shellTheme])

  useEffect(() => {
    if (!ctrl) return
    ctrl.applyCustomData(buildMockBundle(symbol, period))
  }, [ctrl, symbol, period])

  // ── 键盘：Delete/Backspace 删除选中，Esc 分级取消 ──
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        return
      }
      if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault()
        deleteSelection()
        return
      }
      if (event.key === 'Escape') {
        if (bridge?.hasPendingAnchors()) {
          selectTool('cursor')
          return
        }
        if ((ctrl?.selectedDrawingIds.peek() ?? []).length > 0) {
          clearSelection()
          return
        }
        if (measureSession !== null) {
          bridge?.clearMeasure()
          return
        }
        if (activeToolRef.current !== 'cursor') selectTool('cursor')
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [bridge, clearSelection, ctrl, deleteSelection, measureSession, selectTool])

  const value = useMemo<NexusShellValue>(
    () => ({
      ctrl,
      selectedIds,
      selectedDrawings,
      activeTool,
      magnet: prefs.magnet,
      stay: prefs.stay,
      autoApply: prefs.autoApply,
      favorites,
      groupLastTool: prefs.groupLastTool,
      measureSession,
      theme,
      symbol,
      period,
      templateVersion,
      attachChart,
      detachChart,
      bridgeAccessors,
      handleDrawingCreated,
      onAnchorSessionReset,
      setMeasureSession,
      selectTool,
      setGroupLastTool,
      cycleMagnet,
      toggleStay,
      toggleAutoApply,
      toggleFavorite,
      deleteSelection,
      clearSelection,
      updateSelectionStyle,
      applyTemplateToSelection,
      toggleSelectionLock,
      bumpTemplateVersion,
      setTheme,
      toggleTheme,
      setSymbol,
      setPeriod,
    }),
    [
      ctrl,
      selectedIds,
      selectedDrawings,
      activeTool,
      prefs.magnet,
      prefs.stay,
      prefs.autoApply,
      prefs.groupLastTool,
      favorites,
      measureSession,
      theme,
      symbol,
      period,
      templateVersion,
      attachChart,
      detachChart,
      bridgeAccessors,
      handleDrawingCreated,
      onAnchorSessionReset,
      selectTool,
      setGroupLastTool,
      cycleMagnet,
      toggleStay,
      toggleAutoApply,
      toggleFavorite,
      deleteSelection,
      clearSelection,
      updateSelectionStyle,
      applyTemplateToSelection,
      toggleSelectionLock,
      bumpTemplateVersion,
      setTheme,
      toggleTheme,
    ],
  )

  return <NexusShellContext.Provider value={value}>{children}</NexusShellContext.Provider>
}
