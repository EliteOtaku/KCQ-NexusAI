// 自选列表（B3-01）：mock 品种目录 + 点选切品种 + 当前品种高亮。
// 外壳（分区标题/折叠）由 PanelSection 提供。

import { useNexusShell } from '../shell/NexusShellContext'
import { MOCK_SYMBOLS } from '../shell/mockData'

/** 自选面板组件。 */
export function WatchlistPanel() {
  const shell = useNexusShell()

  return (
    <>
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
    </>
  )
}
