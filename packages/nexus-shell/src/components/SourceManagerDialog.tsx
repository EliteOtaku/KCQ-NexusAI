// 数据源管理对话框：与 Vue 版聚合源管理同构的 React 实现。
// 注册表驱动列出全部行情源：拨测状态 / 聚合搜索开关 / 地址与端口覆盖 / 设为当前源。
// 开关与地址写回 core 注册表运行时配置（enabled/baseUrl），持久化由消费方自行处理。

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  marketDataProviderRegistry,
  type MarketDataProvider,
} from '@363045841yyt/klinechart-core/controllers'
import { useNexusShell } from '../shell/NexusShellContext'
import { SHELL_LABELS } from '../shell/labels'

/** 拨测超时（毫秒）。 */
const PROBE_TIMEOUT_MS = 5000

/** 地址变更后的防抖拨测间隔（毫秒）。 */
const ENDPOINT_PROBE_DEBOUNCE_MS = 400

/** 单个源的拨测结果。 */
interface SourceProbeState {
  status: 'checking' | 'online' | 'offline'
  latencyMs?: number
  /** 连接器附带的补充说明（如 MT5 对齐摘要/离线原因）。 */
  message?: string
}

/** 源的地址编辑草稿。 */
interface SourceEndpoint {
  host: string
  port: string
}

/** 解析默认地址为 host/port 草稿。 */
function parseEndpoint(baseUrl: string): SourceEndpoint {
  const url = new URL(baseUrl)
  return { host: url.hostname, port: url.port || (url.protocol === 'https:' ? '443' : '80') }
}

/** 由 host/port 草稿按默认地址的协议与路径组装完整覆盖地址。 */
function composeBaseUrl(host: string, port: string, defaultBaseUrl: string): string {
  const url = new URL(defaultBaseUrl)
  url.hostname = host.trim()
  url.port = port.trim()
  return url.toString().replace(/\/$/, '')
}

/** mock 源沉底展示（本地生成数据，非网络源）。 */
function isMockSource(provider: MarketDataProvider): boolean {
  return provider.source.id === 'mock'
}

/** 数据源管理对话框组件。 */
export function SourceManagerDialog({ onClose }: { onClose: () => void }) {
  const shell = useNexusShell()
  const providers = useMemo(() => {
    const list = [...marketDataProviderRegistry.getAll()]
    return list.sort((a, b) => Number(isMockSource(a)) - Number(isMockSource(b)))
  }, [])

  const [probes, setProbes] = useState<Record<string, SourceProbeState>>({})
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  // 开关等注册表配置变化时强制重渲染（registry 非响应式）
  const [, setTick] = useState(0)
  const [endpoints, setEndpoints] = useState<Record<string, SourceEndpoint>>(() =>
    Object.fromEntries(
      marketDataProviderRegistry
        .getAll()
        .filter((provider) => provider.source.defaultBaseUrl)
        .map((provider) => [
          provider.source.id,
          parseEndpoint(
            marketDataProviderRegistry.getConfig(provider.source.id).baseUrl ??
              provider.source.defaultBaseUrl!,
          ),
        ]),
    ),
  )
  const probeSeq = useRef(0)
  const probeController = useRef<AbortController | null>(null)

  /** 对全部源并发拨测；结果含延迟与连接器补充说明。 */
  async function probeAll() {
    probeController.current?.abort()
    const controller = new AbortController()
    probeController.current = controller
    const seq = ++probeSeq.current
    setProbes(() =>
      Object.fromEntries(
        providers.map((provider) => [provider.source.id, { status: 'checking' as const }]),
      ),
    )
    const timeout = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS)
    await Promise.all(
      providers.map(async (provider) => {
        try {
          const result = await provider.probe(controller.signal)
          if (seq !== probeSeq.current) return
          setProbes((prev) => ({
            ...prev,
            [provider.source.id]: {
              status: result.status === 'offline' ? 'offline' : 'online',
              latencyMs: result.latencyMs,
              message: result.message || undefined,
            },
          }))
        } catch {
          if (seq !== probeSeq.current) return
          setProbes((prev) => ({ ...prev, [provider.source.id]: { status: 'offline' } }))
        }
      }),
    )
    clearTimeout(timeout)
  }

  // 打开时全量拨测；地址变更后防抖重拨。
  useEffect(() => {
    void probeAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => void probeAll(), ENDPOINT_PROBE_DEBOUNCE_MS)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpoints])

  // 卸载时中断未完成拨测。
  useEffect(
    () => () => {
      probeSeq.current += 1
      probeController.current?.abort()
    },
    [],
  )

  /** 更新某源地址草稿并立即写回注册表覆盖。 */
  function updateEndpoint(id: string, patch: Partial<SourceEndpoint>) {
    const provider = marketDataProviderRegistry.get(id)
    if (!provider?.source.defaultBaseUrl) return
    const current = endpoints[id] ?? parseEndpoint(provider.source.defaultBaseUrl)
    const next = { host: patch.host ?? current.host, port: patch.port ?? current.port }
    setEndpoints((prev) => ({ ...prev, [id]: next }))
    const composed = composeBaseUrl(next.host, next.port, provider.source.defaultBaseUrl)
    const defaultComposed = composeBaseUrl(
      parseEndpoint(provider.source.defaultBaseUrl).host,
      parseEndpoint(provider.source.defaultBaseUrl).port,
      provider.source.defaultBaseUrl,
    )
    marketDataProviderRegistry.setConfig(id, {
      baseUrl: composed === defaultComposed ? undefined : composed,
    })
  }

  /** 切换聚合搜索启用（写回注册表，影响跨源搜索与路由）。 */
  function toggleEnabled(id: string, enabled: boolean) {
    marketDataProviderRegistry.setConfig(id, { enabled })
    setTick((value) => value + 1)
  }

  /** 设为当前源（内部走 probe 门控；失败行内提示）。 */
  const [switchFailed, setSwitchFailed] = useState(false)
  async function useAsCurrent(id: string) {
    const ok = await shell.selectDataSource(id)
    setSwitchFailed(!ok)
    if (ok) onClose()
  }

  function statusText(id: string): string {
    const probe = probes[id]
    if (!probe || probe.status === 'checking') return SHELL_LABELS.sourceStatusChecking
    if (probe.status === 'offline') {
      return probe.message
        ? `${SHELL_LABELS.sourceStatusOffline} · ${probe.message.slice(0, 40)}`
        : SHELL_LABELS.sourceStatusOffline
    }
    const base =
      probe.latencyMs !== undefined
        ? `${SHELL_LABELS.sourceStatusOnline} · ${probe.latencyMs}ms`
        : SHELL_LABELS.sourceStatusOnline
    return probe.message ? `${base} · ${probe.message}` : base
  }

  return (
    <div
      className="nx-dialog nx-dialog--nested"
      role="dialog"
      aria-modal="true"
      aria-label={SHELL_LABELS.sourceManagerTitle}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className="nx-dialog__panel nx-source-manager">
        <h3 className="nx-dialog__title">{SHELL_LABELS.sourceManagerTitle}</h3>

        <div className="nx-source-list">
          {providers.map((provider) => {
            const id = provider.source.id
            const config = marketDataProviderRegistry.getConfig(id)
            const isCurrent = shell.dataSource === id
            const endpoint = endpoints[id]
            return (
              <div
                key={id}
                data-source={id}
                className={`nx-source-item${isCurrent ? ' nx-source-item--current' : ''}`}
              >
                <div className="nx-source-item__main">
                  <div className="nx-source-item__info">
                    <span className="nx-source-item__name">{provider.source.displayName}</span>
                    <span className="nx-source-item__description">
                      {provider.source.description ?? ''}
                    </span>
                    <span className={`nx-source-item__status is-${probes[id]?.status ?? 'checking'}`}>
                      {statusText(id)}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="nx-btn nx-source-item__use"
                    disabled={isCurrent}
                    title={SHELL_LABELS.sourceUseTitle}
                    onClick={() => void useAsCurrent(id)}
                  >
                    {isCurrent ? SHELL_LABELS.sourceCurrent : SHELL_LABELS.sourceUse}
                  </button>
                </div>

                {provider.source.defaultBaseUrl && (
                  <div className="nx-source-item__endpoint">
                    <button
                      type="button"
                      className="nx-source-item__endpoint-toggle"
                      onClick={() => setExpanded((prev) => ({ ...prev, [id]: !prev[id] }))}
                    >
                      {SHELL_LABELS.sourceEndpointLabel}
                      <span aria-hidden="true">{expanded[id] ? '▾' : '▸'}</span>
                    </button>
                    {expanded[id] && endpoint && (
                      <div className="nx-source-endpoint">
                        <label className="nx-source-endpoint__field">
                          <span>{SHELL_LABELS.sourceEndpointHost}</span>
                          <input
                            type="text"
                            value={endpoint.host}
                            placeholder={parseEndpoint(provider.source.defaultBaseUrl).host}
                            onChange={(event) => updateEndpoint(id, { host: event.target.value })}
                          />
                        </label>
                        <label className="nx-source-endpoint__field nx-source-endpoint__field--port">
                          <span>{SHELL_LABELS.sourceEndpointPort}</span>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={endpoint.port}
                            placeholder={parseEndpoint(provider.source.defaultBaseUrl).port}
                            onChange={(event) => updateEndpoint(id, { port: event.target.value })}
                          />
                        </label>
                      </div>
                    )}
                  </div>
                )}

                <label className="nx-source-item__toggle-row">
                  <input
                    type="checkbox"
                    checked={config.enabled}
                    onChange={(event) => toggleEnabled(id, event.target.checked)}
                  />
                  <span>{SHELL_LABELS.sourceAggregationToggle}</span>
                </label>
              </div>
            )
          })}
        </div>

        {switchFailed && <div className="nx-settings__hint">{SHELL_LABELS.sourceSwitchFailed}</div>}

        <div className="nx-dialog__actions">
          <button type="button" className="nx-btn nx-btn--primary" onClick={onClose}>
            {SHELL_LABELS.settingsClose}
          </button>
        </div>
      </div>
    </div>
  )
}
