// 右侧指标管理面板骨架：指标清单数据驱动，开关状态本地持有（接线到引擎为后续里程碑）。

import { useState } from 'react'
import { SHELL_LABELS } from '../shell/labels'

/** 面板默认展示的指标条目（主图/副图各一代表，接线后由引擎注册表驱动）。 */
const DEFAULT_INDICATORS: ReadonlyArray<{ id: string; main: boolean }> = [
  { id: 'MA', main: true },
  { id: 'BOLL', main: true },
  { id: 'VOLUME', main: false },
  { id: 'MACD', main: false },
  { id: 'RSI', main: false },
]

/** 指标管理面板。 */
export function IndicatorPanel() {
  const [enabled, setEnabled] = useState<Record<string, boolean>>({ MA: true, VOLUME: true })

  return (
    <section className="nx-side-panel__section">
      <h2 className="nx-side-panel__title">{SHELL_LABELS.indicatorSectionTitle}</h2>
      {DEFAULT_INDICATORS.length === 0 ? (
        <p className="nx-side-panel__empty">{SHELL_LABELS.indicatorEmpty}</p>
      ) : (
        DEFAULT_INDICATORS.map((indicator) => (
          <label key={indicator.id} className="nx-side-panel__row">
            <span>
              {indicator.id}
              {indicator.main ? ' · 主图' : ' · 副图'}
            </span>
            <input
              type="checkbox"
              checked={enabled[indicator.id] === true}
              onChange={(event) =>
                setEnabled((prev) => ({ ...prev, [indicator.id]: event.target.checked }))
              }
            />
          </label>
        ))
      )}
    </section>
  )
}
