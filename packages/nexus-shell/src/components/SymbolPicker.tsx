// 顶栏品种搜索器：下拉 + 关键字过滤 + 最近使用。
// mock 模式接本地品种目录（nexus.shell.recent-symbols）；
// 网络源模式经 searchInstruments 限定当前源搜索（nexus.shell.recent-source-instruments 存品种描述）。

import { useEffect, useMemo, useRef, useState } from 'react'
import type { InstrumentDescriptor } from '@363045841yyt/klinechart-core/controllers'
import {
  marketDataProviderRegistry,
  searchInstruments,
} from '@363045841yyt/klinechart-core/controllers'
import { useNexusShell } from '../shell/NexusShellContext'
import { MOCK_SYMBOLS } from '../shell/mockData'
import { readJson, writeJson, STORAGE_KEYS } from '../shell/storage'
import { SHELL_LABELS } from '../shell/labels'

/** 最近使用上限。 */
const RECENT_LIMIT = 8

/** 网络源搜索防抖间隔（毫秒）。 */
const NETWORK_SEARCH_DEBOUNCE_MS = 200

/** 网络源单次搜索返回上限。 */
const NETWORK_SEARCH_LIMIT = 20

/** 记录最近使用的 mock 品种（去重置顶，超限截断）。 */
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
  // 网络源异步搜索状态
  const [networkResults, setNetworkResults] = useState<ReadonlyArray<InstrumentDescriptor>>([])
  const [networkSearching, setNetworkSearching] = useState(false)
  const [networkError, setNetworkError] = useState(false)

  const isNetworkSource = shell.dataSource !== 'mock'

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

  // 网络源模式：防抖搜索（限定当前源），晚到的结果按请求序号丢弃。
  const searchSeq = useRef(0)
  useEffect(() => {
    if (!open || !isNetworkSource) return
    const keyword = query.trim()
    const seq = ++searchSeq.current
    if (keyword === '') {
      setNetworkResults([])
      setNetworkSearching(false)
      setNetworkError(false)
      return
    }
    setNetworkSearching(true)
    setNetworkError(false)
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      void searchInstruments(marketDataProviderRegistry, {
        keyword,
        limit: NETWORK_SEARCH_LIMIT,
        sourceIds: [shell.dataSource],
        signal: controller.signal,
      })
        .then((items) => {
          if (seq !== searchSeq.current) return
          setNetworkResults(items)
          setNetworkSearching(false)
        })
        .catch(() => {
          if (seq !== searchSeq.current) return
          setNetworkResults([])
          setNetworkSearching(false)
          setNetworkError(true)
        })
    }, NETWORK_SEARCH_DEBOUNCE_MS)
    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [open, isNetworkSource, shell.dataSource, query])

  /** 关闭并消费唤起请求（避免下次手动打开残留关键字）。 */
  function closePicker() {
    setOpen(false)
    shell.clearSymbolPickerRequest()
  }

  const current = MOCK_SYMBOLS.find((item) => item.symbol === shell.symbol)

  const mockRecents = useMemo(() => {
    const known = new Set(MOCK_SYMBOLS.map((item) => item.symbol))
    return readJson<ReadonlyArray<string>>(STORAGE_KEYS.recentSymbols, []).filter((symbol) =>
      known.has(symbol),
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, shell.symbol])

  const networkRecents = useMemo(
    () => readJson<ReadonlyArray<InstrumentDescriptor>>(STORAGE_KEYS.recentSourceInstruments, []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [open, shell.sourceInstrument],
  )

  const keyword = query.trim().toLowerCase()
  const matched = MOCK_SYMBOLS.filter(
    (item) =>
      item.symbol.toLowerCase().includes(keyword) || item.name.toLowerCase().includes(keyword),
  )

  /** 选中 mock 品种：切换 + 记最近 + 收起。 */
  function selectMock(symbol: string) {
    if (symbol !== shell.symbol) {
      shell.setSymbol(symbol)
      pushRecent(symbol)
    }
    closePicker()
  }

  /** 选中网络源品种：切换品种描述（上下文负责接线与最近使用记录）。 */
  function selectNetwork(instrument: InstrumentDescriptor) {
    shell.setSourceInstrument(instrument)
    closePicker()
  }

  function renderMockRow(symbol: string, name: string) {
    const active = symbol === shell.symbol
    return (
      <button
        key={symbol}
        type="button"
        className={`nx-symbol-option${active ? ' nx-symbol-option--active' : ''}`}
        onClick={() => selectMock(symbol)}
      >
        <span className="nx-symbol-option__code">{symbol}</span>
        <span className="nx-symbol-option__name">{name}</span>
      </button>
    )
  }

  function renderNetworkRow(instrument: InstrumentDescriptor) {
    const active = instrument.symbol === shell.symbol
    return (
      <button
        key={instrument.id}
        type="button"
        className={`nx-symbol-option${active ? ' nx-symbol-option--active' : ''}`}
        onClick={() => selectNetwork(instrument)}
      >
        <span className="nx-symbol-option__code">{instrument.symbol}</span>
        <span className="nx-symbol-option__name">{instrument.name}</span>
      </button>
    )
  }

  /** 网络源结果区（搜索中/失败/空态/结果）。 */
  function renderNetworkList() {
    if (networkSearching) {
      return <div className="nx-symbol-picker__empty">{SHELL_LABELS.symbolSearchLoading}</div>
    }
    if (networkError) {
      return <div className="nx-symbol-picker__empty">{SHELL_LABELS.symbolSearchFailed}</div>
    }
    if (keyword === '') {
      return null // 空关键字只展示最近使用
    }
    if (networkResults.length === 0) {
      return <div className="nx-symbol-picker__empty">{SHELL_LABELS.symbolNoResults}</div>
    }
    return networkResults.map(renderNetworkRow)
  }

  const recents = isNetworkSource ? networkRecents : mockRecents
  const hasRecents = recents.length > 0 && keyword === ''

  return (
    <div ref={rootRef} className="nx-symbol-picker">
      <button
        type="button"
        className="nx-btn nx-symbol-picker__trigger"
        title={SHELL_LABELS.symbolSearchTitle}
        onClick={() => (open ? closePicker() : setOpen(true))}
      >
        <span className="nx-symbol-picker__code">{shell.symbol}</span>
        <span className="nx-symbol-picker__name">
          {isNetworkSource ? (shell.sourceInstrument?.name ?? '') : (current?.name ?? '')}
        </span>
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
              if (event.key === 'Enter') {
                if (isNetworkSource) {
                  const first = networkResults[0]
                  if (first) selectNetwork(first)
                } else if (matched.length > 0) {
                  selectMock(matched[0]!.symbol)
                }
              }
            }}
          />
          {hasRecents && (
            <>
              <div className="nx-symbol-picker__group">{SHELL_LABELS.symbolRecentGroup}</div>
              {isNetworkSource
                ? networkRecents.map(renderNetworkRow)
                : mockRecents.map((symbol) =>
                    renderMockRow(
                      symbol,
                      MOCK_SYMBOLS.find((item) => item.symbol === symbol)?.name ?? '',
                    ),
                  )}
            </>
          )}
          <div className="nx-symbol-picker__group">{SHELL_LABELS.symbolAllGroup}</div>
          {isNetworkSource ? (
            renderNetworkList()
          ) : matched.length === 0 ? (
            <div className="nx-symbol-picker__empty">{SHELL_LABELS.symbolNoResults}</div>
          ) : (
            matched.map((item) => renderMockRow(item.symbol, item.name))
          )}
        </div>
      )}
    </div>
  )
}
