// 顶栏品种搜索器：下拉 + 关键字过滤 + 最近使用（nexus.shell.recent-symbols）。
// 数据接 mock 品种目录；选中经壳上下文切换主品种。

import { useEffect, useMemo, useRef, useState } from 'react'
import { useNexusShell } from '../shell/NexusShellContext'
import { MOCK_SYMBOLS } from '../shell/mockData'
import { readJson, writeJson, STORAGE_KEYS } from '../shell/storage'
import { SHELL_LABELS } from '../shell/labels'

/** 最近使用上限。 */
const RECENT_LIMIT = 8

/** 记录最近使用的品种（去重置顶，超限截断）。 */
function pushRecent(symbol: string): void {
  const recents = readJson<ReadonlyArray<string>>(STORAGE_KEYS.recentSymbols, [])
  const next = [symbol, ...recents.filter((item) => item !== symbol)].slice(0, RECENT_LIMIT)
  writeJson(STORAGE_KEYS.recentSymbols, next)
}

/** 品种搜索器组件。 */
export function SymbolPicker() {
  const shell = useNexusShell()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // 点击外部关闭（捕获阶段）。
  useEffect(() => {
    if (!open) return
    const onDocumentPointerDown = (event: PointerEvent) => {
      if (rootRef.current !== null && !rootRef.current.contains(event.target as Node)) {
        closePicker()
      }
    }
    document.addEventListener('pointerdown', onDocumentPointerDown, true)
    return () => document.removeEventListener('pointerdown', onDocumentPointerDown, true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // 打开时聚焦搜索框；关键字取当前唤起请求（键盘字母键）或清空（手动打开）。
  useEffect(() => {
    if (open) {
      setQuery(shell.symbolPickerRequest?.query ?? '')
      inputRef.current?.focus()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // 键盘唤起请求（B4-01）：带入首字母打开。
  const request = shell.symbolPickerRequest
  useEffect(() => {
    if (request !== null) setOpen(true)
  }, [request])

  /** 关闭并消费唤起请求（避免下次手动打开残留关键字）。 */
  function closePicker() {
    setOpen(false)
    shell.clearSymbolPickerRequest()
  }

  const current = MOCK_SYMBOLS.find((item) => item.symbol === shell.symbol)

  const recents = useMemo(() => {
    const known = new Set(MOCK_SYMBOLS.map((item) => item.symbol))
    return readJson<ReadonlyArray<string>>(STORAGE_KEYS.recentSymbols, []).filter((symbol) =>
      known.has(symbol),
    )
  }, [open, shell.symbol])

  const keyword = query.trim().toLowerCase()
  const matched = MOCK_SYMBOLS.filter(
    (item) =>
      item.symbol.toLowerCase().includes(keyword) || item.name.toLowerCase().includes(keyword),
  )

  /** 选中品种：切换 + 记最近 + 收起。 */
  function select(symbol: string) {
    if (symbol !== shell.symbol) {
      shell.setSymbol(symbol)
      pushRecent(symbol)
    }
    closePicker()
  }

  function renderRow(symbol: string, name: string) {
    const active = symbol === shell.symbol
    return (
      <button
        key={symbol}
        type="button"
        className={`nx-symbol-option${active ? ' nx-symbol-option--active' : ''}`}
        onClick={() => select(symbol)}
      >
        <span className="nx-symbol-option__code">{symbol}</span>
        <span className="nx-symbol-option__name">{name}</span>
      </button>
    )
  }

  return (
    <div ref={rootRef} className="nx-symbol-picker">
      <button
        type="button"
        className="nx-btn nx-symbol-picker__trigger"
        title={SHELL_LABELS.symbolSearchTitle}
        onClick={() => (open ? closePicker() : setOpen(true))}
      >
        <span className="nx-symbol-picker__code">{shell.symbol}</span>
        <span className="nx-symbol-picker__name">{current?.name ?? ''}</span>
      </button>

      {open && (
        <div className="nx-symbol-picker__panel" role="listbox">
          <input
            ref={inputRef}
            className="nx-symbol-picker__input"
            type="text"
            placeholder={SHELL_LABELS.symbolSearchPlaceholder}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') closePicker()
              if (event.key === 'Enter' && matched.length > 0) select(matched[0]!.symbol)
            }}
          />
          {recents.length > 0 && keyword === '' && (
            <>
              <div className="nx-symbol-picker__group">{SHELL_LABELS.symbolRecentGroup}</div>
              {recents.map((symbol) =>
                renderRow(symbol, MOCK_SYMBOLS.find((item) => item.symbol === symbol)?.name ?? ''),
              )}
            </>
          )}
          <div className="nx-symbol-picker__group">{SHELL_LABELS.symbolAllGroup}</div>
          {matched.length === 0 ? (
            <div className="nx-symbol-picker__empty">{SHELL_LABELS.symbolNoResults}</div>
          ) : (
            matched.map((item) => renderRow(item.symbol, item.name))
          )}
        </div>
      )}
    </div>
  )
}
