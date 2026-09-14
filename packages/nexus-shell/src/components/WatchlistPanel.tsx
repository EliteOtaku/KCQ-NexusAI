// 右侧自选列表（B3-01）：mock 品种目录 + 点选切品种 + 当前品种高亮。

import { useNexusShell } from '../shell/NexusShellContext'
import { MOCK_SYMBOLS } from '../shell/mockData'
import { SHELL_LABELS } from '../shell/labels'

/** 自选面板组件。 */
export function WatchlistPanel() {
  const shell = useNexusShell()

  return (
    <section className="nx-side-panel__section">
      <h2 className="nx-side-panel__title">{SHELL_LABELS.watchlistSectionTitle}</h2>
      {MOCK_SYMBOLS.map((item) => (
        <button
          key={item.symbol}
          type="button"
          className={`nx-watchlist__row${item.symbol === shell.symbol ? ' nx-watchlist__row--active' : ''}`}
          onClick={() => shell.setSymbol(item.symbol)}
        >
          <span className="nx-watchlist__code">{item.symbol}</span>
          <span className="nx-watchlist__name">{item.name}</span>
        </button>
      ))}
    </section>
  )
}
