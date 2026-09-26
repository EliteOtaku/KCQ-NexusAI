// 绘图工具目录：分组、锚点数、图标名的唯一事实来源。
// 引擎未公开导出锚点数表（引擎缺口 G-07），壳内维护与 toolConfig 同源的副本。

import type { DrawingToolId } from '@363045841yyt/klinechart-core/controllers'

/** 壳层伪工具：不进入引擎 DrawingToolId，由壳的事件桥自行处理。 */
export type PseudoToolId = 'measure' | 'eraser'

/** 壳统一工具 id：引擎工具 + 伪工具。 */
export type ShellToolId = DrawingToolId | PseudoToolId

/** 分组 id：线条 / 通道 / 形状标注。 */
export type ToolGroupId = 'lines' | 'channels' | 'annotations'

/** 工具目录条目。anchorCount 为 0 表示非绘制类（光标/框选/测量/橡皮）。 */
export interface ShellToolDef {
  id: ShellToolId
  label: string
  /** tabler 图标名，经 unplugin-icons ~icons/tabler/<name> 引用。 */
  icon: string
  group: ToolGroupId | null
  anchorCount: 0 | 1 | 2 | 3
}

/** 完整工具目录；分组顺序即工具条展示顺序。 */
export const SHELL_TOOL_CATALOG: ReadonlyArray<ShellToolDef> = [
  { id: 'cursor', label: '光标', icon: 'pointer', group: null, anchorCount: 0 },
  { id: 'box-select', label: '框选', icon: 'select', group: null, anchorCount: 0 },
  { id: 'measure', label: '测量', icon: 'ruler-2', group: null, anchorCount: 0 },
  { id: 'eraser', label: '橡皮擦', icon: 'eraser', group: null, anchorCount: 0 },
  { id: 'trend-line', label: '线段', icon: 'chart-line', group: 'lines', anchorCount: 2 },
  { id: 'ray', label: '射线', icon: 'arrow-up-right', group: 'lines', anchorCount: 2 },
  { id: 'h-line', label: '水平线', icon: 'minus', group: 'lines', anchorCount: 1 },
  { id: 'h-ray', label: '水平射线', icon: 'arrow-right', group: 'lines', anchorCount: 1 },
  { id: 'v-line', label: '垂直线', icon: 'separator', group: 'lines', anchorCount: 1 },
  { id: 'crosshair-line', label: '十字线', icon: 'crosshair', group: 'lines', anchorCount: 1 },
  { id: 'info-line', label: '信息线', icon: 'info-circle', group: 'lines', anchorCount: 2 },
  {
    id: 'parallel-channel',
    label: '平行通道',
    icon: 'shape',
    group: 'channels',
    anchorCount: 3,
  },
  {
    id: 'regression-channel',
    label: '回归趋势',
    icon: 'chart-dots-3',
    group: 'channels',
    anchorCount: 2,
  },
  { id: 'flat-line', label: '平滑顶底', icon: 'caret-up-down', group: 'channels', anchorCount: 3 },
  {
    id: 'disjoint-channel',
    label: '不相交通道',
    icon: 'brackets',
    group: 'channels',
    anchorCount: 3,
  },
  {
    id: 'fib-retracement',
    label: '斐波那契回撤',
    icon: 'chart-dots-3',
    group: 'annotations',
    anchorCount: 2,
  },
  { id: 'rectangle', label: '矩形', icon: 'shape', group: 'annotations', anchorCount: 2 },
  { id: 'arrow', label: '箭头', icon: 'arrow-up-right', group: 'annotations', anchorCount: 2 },
]

/** 工具 id → 目录条目索引。 */
const TOOL_BY_ID = new Map(SHELL_TOOL_CATALOG.map((tool) => [tool.id as string, tool]))

/** 查工具定义；未知 id 返回 undefined。 */
export function findTool(id: ShellToolId | string): ShellToolDef | undefined {
  return TOOL_BY_ID.get(id)
}

/** 判断是否为进入引擎的多锚点绘制工具（锁角/锚点计数只对它们生效）。 */
export function isMultiAnchorTool(id: string): boolean {
  const tool = TOOL_BY_ID.get(id)
  return tool !== undefined && tool.anchorCount >= 2
}

/** 判断是否为引擎绘制工具（磁吸生效范围）。 */
export function isEngineDrawingTool(id: string): boolean {
  const tool = TOOL_BY_ID.get(id)
  return tool !== undefined && tool.anchorCount >= 1
}

/** 分组展示元数据。 */
export const TOOL_GROUPS: ReadonlyArray<{ id: ToolGroupId; label: string }> = [
  { id: 'lines', label: '线条' },
  { id: 'channels', label: '通道' },
  { id: 'annotations', label: '形状与标注' },
]

/** 引擎 DrawingKind → 工具目录 id 的反查表（少数 kind 与 toolId 不同名）。 */
const KIND_TO_TOOL_ID: Readonly<Record<string, string>> = {
  'horizontal-line': 'h-line',
  'horizontal-ray': 'h-ray',
  'vertical-line': 'v-line',
  'cross-line': 'crosshair-line',
}

/** 按 DrawingKind 查工具显示名（模板列表等持久化数据展示用）。 */
export function kindToolLabel(kind: string): string {
  const toolId = KIND_TO_TOOL_ID[kind] ?? kind
  return TOOL_BY_ID.get(toolId)?.label ?? kind
}
