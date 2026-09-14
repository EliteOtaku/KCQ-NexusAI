// 顶栏：品牌 + 品种搜索器 + 分组周期下拉 + 主题切换。
// 状态全部经壳上下文读写（批2 数据接线完成）。

import { useNexusShell } from '../shell/NexusShellContext'
import { PERIOD_GROUPS } from '../shell/periods'
import { SHELL_LABELS } from '../shell/labels'
import { SymbolPicker } from './SymbolPicker'
import type { ChangeEvent } from 'react'

/** 壳顶栏组件。 */
export function TopBar() {
  const shell = useNexusShell()

  /** 周期切换：写壳状态（数据经 provider 重新注入）。 */
  function onPeriodChange(event: ChangeEvent<HTMLSelectElement>) {
    const value = event.target.value
    if (value !== shell.period) shell.setPeriod(value)
  }

  return (
    <header className="nx-topbar">
      <span className="nx-topbar__brand">{SHELL_LABELS.brand}</span>
      <SymbolPicker />
      <select
        className="nx-topbar__period"
        title={SHELL_LABELS.periodLabel}
        aria-label={SHELL_LABELS.periodLabel}
        value={shell.period}
        onChange={onPeriodChange}
      >
        {PERIOD_GROUPS.map((group) => (
          <optgroup key={group.label} label={group.label}>
            {group.items.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
      <span className="nx-topbar__spacer" />
      <button type="button" className="nx-btn" onClick={shell.toggleTheme}>
        {shell.theme === 'dark' ? SHELL_LABELS.themeLight : SHELL_LABELS.themeDark}
      </button>
    </header>
  )
}
