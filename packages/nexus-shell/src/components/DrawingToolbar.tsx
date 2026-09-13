// 左侧绘图工具条：工具清单数据驱动，选中状态由壳统一持有（接线到引擎为后续里程碑）。

import type { DrawingToolDescriptor } from '../shell/ports'
import { SHELL_LABELS } from '../shell/labels'

/** 内置绘图工具清单：图标用文字占位。 */
export const BUILTIN_DRAWING_TOOLS: ReadonlyArray<DrawingToolDescriptor> = [
  { id: 'cursor', icon: '＋', label: '光标' },
  { id: 'trendline', icon: '／', label: '趋势线' },
  { id: 'horizontal_line', icon: '—', label: '水平线' },
  { id: 'ray', icon: '→', label: '射线' },
  { id: 'fibonacci', icon: '𝟇', label: '斐波那契' },
  { id: 'rectangle', icon: '▭', label: '矩形' },
]

interface DrawingToolbarProps {
  activeTool: string
  onToolSelect: (toolId: string) => void
}

/** 绘图工具条骨架。 */
export function DrawingToolbar({ activeTool, onToolSelect }: DrawingToolbarProps) {
  return (
    <aside className="nx-drawing-toolbar" aria-label={SHELL_LABELS.drawingSectionTitle}>
      {BUILTIN_DRAWING_TOOLS.map((tool) => (
        <button
          key={tool.id}
          type="button"
          title={tool.label}
          aria-label={tool.label}
          className={`nx-btn${tool.id === activeTool ? ' nx-btn--active' : ''}`}
          onClick={() => onToolSelect(tool.id)}
        >
          {tool.icon}
        </button>
      ))}
    </aside>
  )
}
