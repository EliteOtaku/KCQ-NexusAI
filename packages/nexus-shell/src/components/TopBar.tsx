// 顶栏：品牌 + 品种占位 + 周期档位 + 主题切换。数据接线（品种目录/周期切换）为后续里程碑。

import type { PeriodDescriptor } from '../shell/ports'
import { SHELL_LABELS } from '../shell/labels'

/** 默认周期档位：与 core KLinePeriod 对齐（4h 依赖 fork 补丁）。 */
export const DEFAULT_PERIODS: ReadonlyArray<PeriodDescriptor> = [
  { value: '1min', label: '1分' },
  { value: '5min', label: '5分' },
  { value: '15min', label: '15分' },
  { value: '30min', label: '30分' },
  { value: '60min', label: '1小时' },
  { value: '4h', label: '4小时' },
  { value: 'daily', label: '日线' },
  { value: 'weekly', label: '周线' },
  { value: 'monthly', label: '月线' },
]

interface TopBarProps {
  currentPeriod: string
  onPeriodChange: (period: string) => void
  theme: 'light' | 'dark'
  onThemeToggle: () => void
}

/** 壳顶栏骨架：纯展示 + 回调上抛，不持有业务状态。 */
export function TopBar({ currentPeriod, onPeriodChange, theme, onThemeToggle }: TopBarProps) {
  return (
    <header className="nx-topbar">
      <span className="nx-topbar__brand">{SHELL_LABELS.brand}</span>
      <span>{SHELL_LABELS.symbolPlaceholder}</span>
      <nav>
        {DEFAULT_PERIODS.map((period) => (
          <button
            key={period.value}
            type="button"
            className={`nx-btn${period.value === currentPeriod ? ' nx-btn--active' : ''}`}
            onClick={() => onPeriodChange(period.value)}
          >
            {period.label}
          </button>
        ))}
      </nav>
      <span className="nx-topbar__spacer" />
      <button type="button" className="nx-btn" onClick={onThemeToggle}>
        {theme === 'dark' ? SHELL_LABELS.themeLight : SHELL_LABELS.themeDark}
      </button>
    </header>
  )
}
