// 图例栏：替代引擎 canvas 图例（ChartStage 挂载时 updateRendererConfig 关闭）。
// 行1 = 品种·周期·OHLC·量（值取 legendTemplateContext.currentBar，十字线联动）；
// 行2+ = 主图指标行（值行与用户实例按序对齐）+ 副图指标行（引擎图例不覆盖副图，自建）。
// 指标行 hover 出 眼睛/设置/删除：引擎无可见性 API，眼睛=移除并 stash（再点按 stash 恢复）。

import { useState, type ChangeEvent } from 'react'
import type {
  IndicatorDefinition,
  IndicatorInstance,
  IndicatorParamDef,
} from '@363045841yyt/klinechart-core/controllers'
import type { LegendTemplateContext } from '@363045841yyt/klinechart-core/controllers'
import { useNexusShell } from '../shell/NexusShellContext'
import { useSignal } from '../shell/reactivity'
import { periodLabel } from '../shell/periods'
import { SHELL_LABELS } from '../shell/labels'

/** 图例信号空态兜底（稳定引用）。 */
const NO_LEGEND: LegendTemplateContext | null = null
/** 指标实例空数组兜底（稳定引用）。 */
const EMPTY_INSTANCES: ReadonlyArray<IndicatorInstance> = []

/** 眼睛隐藏指标的暂存条目：恢复所需的全部重加参数。 */
interface IndicatorStash {
  /** definitionId:role，同一定义同一角色只允许一个实例（与 IndicatorPanel 口径一致）。 */
  key: string
  definitionId: string
  role: 'main' | 'sub'
  label: string
  params: Record<string, unknown>
}

/** 运行时实例可能携带 source（分时模式注入的实例不归壳管理），公开类型未收录。 */
function isUserInstance(item: IndicatorInstance): boolean {
  return (item as IndicatorInstance & { source?: string }).source !== 'mode'
}

/** 参数按定义顺序格式化为括号文本；无参数定义时返回空串。 */
function formatParams(
  definition: IndicatorDefinition | undefined,
  instance: IndicatorInstance,
): string {
  if (definition === undefined || definition.params.length === 0) return ''
  const values = definition.params.map((param) => {
    const value = instance.params[param.key] ?? param.default
    return String(value)
  })
  return `(${values.join(', ')})`
}

/** 图例栏组件。 */
export function LegendBar() {
  const shell = useNexusShell()
  const ctrl = shell.ctrl
  const legend = useSignal(ctrl?.legendTemplateContext ?? null, NO_LEGEND)
  const instances = useSignal(ctrl?.indicators ?? null, EMPTY_INSTANCES)

  /** 眼睛隐藏的指标暂存（会话级：隐藏行保留在图例中，可再点恢复）。 */
  const [stashed, setStashed] = useState<ReadonlyArray<IndicatorStash>>([])
  /** 当前展开参数编辑器的实例 key。 */
  const [editingKey, setEditingKey] = useState<string | null>(null)

  const userMain = instances.filter((item) => item.role === 'main' && isUserInstance(item))
  const subInstances = instances.filter((item) => item.role === 'sub' && isUserInstance(item))
  const legendRows = legend?.indicators ?? []
  const bar = legend?.currentBar ?? null
  const barColor = bar?.color ?? 'var(--nx-text-primary)'

  /** 眼睛切换：隐藏→stash+移除；已隐藏→按 stash 重加。 */
  function toggleEye(key: string) {
    if (ctrl === null) return
    const stash = stashed.find((item) => item.key === key)
    if (stash !== undefined) {
      ctrl.addIndicator(stash.definitionId, stash.role, stash.params)
      setStashed((prev) => prev.filter((item) => item.key !== key))
      return
    }
    const instance = [...userMain, ...subInstances].find(
      (item) => `${item.definitionId}:${item.role}` === key,
    )
    if (instance === undefined) return
    setStashed((prev) => [
      ...prev,
      {
        key,
        definitionId: instance.definitionId,
        role: instance.role,
        label: instance.label,
        params: { ...instance.params },
      },
    ])
    ctrl.removeIndicator(instance.id)
  }

  /** 删除：真移除实例并清掉同名 stash，避免幽灵暂存。 */
  function removeInstance(instance: IndicatorInstance) {
    if (ctrl === null) return
    const key = `${instance.definitionId}:${instance.role}`
    setStashed((prev) => prev.filter((item) => item.key !== key))
    setEditingKey((prev) => (prev === key ? null : prev))
    ctrl.removeIndicator(instance.id)
  }

  /** 行渲染：label + 参数括号 + 可选值序列 + hover 动作。 */
  function renderIndicatorRow(options: {
    key: string
    label: string
    paramsText: string
    values?: ReadonlyArray<{ label: string; value: number; color: string }>
    instance: IndicatorInstance | null
    hidden: boolean
  }) {
    const { key, label, paramsText, values, instance, hidden } = options
    const editing = editingKey === key
    return (
      <div key={key} className={`nx-legend__row${hidden ? ' nx-legend__row--hidden' : ''}`}>
        <span className="nx-legend__indicator-name">{label}</span>
        {paramsText !== '' && <span className="nx-legend__indicator-params">{paramsText}</span>}
        {values?.map((item) => (
          <span key={item.label} className="nx-legend__value" style={{ color: item.color }}>
            {item.label} {item.value.toFixed(2)}
          </span>
        ))}
        <span className="nx-legend__actions">
          <button
            type="button"
            className="nx-legend__action"
            title={hidden ? SHELL_LABELS.legendEyeShow : SHELL_LABELS.legendEyeHide}
            onClick={() => toggleEye(key)}
          >
            {hidden ? '◌' : '◉'}
          </button>
          {instance !== null && (
            <>
              <button
                type="button"
                className="nx-legend__action"
                title={SHELL_LABELS.legendSettingsTitle}
                onClick={() => setEditingKey((prev) => (prev === key ? null : key))}
              >
                ⚙
              </button>
              <button
                type="button"
                className="nx-legend__action"
                title={SHELL_LABELS.legendDeleteTitle}
                onClick={() => removeInstance(instance)}
              >
                ✕
              </button>
            </>
          )}
        </span>
        {editing && instance !== null && (
          <ParamsEditor
            instance={instance}
            onDone={() => setEditingKey(null)}
          />
        )}
      </div>
    )
  }

  return (
    <div className="nx-legend" role="group" aria-label="legend">
      <div className="nx-legend__row">
        <span className="nx-legend__symbol">{shell.symbol}</span>
        <span className="nx-legend__period">{periodLabel(shell.period)}</span>
        {bar !== null && (
          <span className="nx-legend__ohlc" style={{ color: barColor }}>
            <span>
              {SHELL_LABELS.legendOhlcOpen} {bar.open.toFixed(2)}
            </span>
            <span>
              {SHELL_LABELS.legendOhlcHigh} {bar.high.toFixed(2)}
            </span>
            <span>
              {SHELL_LABELS.legendOhlcLow} {bar.low.toFixed(2)}
            </span>
            <span>
              {SHELL_LABELS.legendOhlcClose} {bar.close.toFixed(2)}
            </span>
            {bar.volumeText !== null && (
              <span>
                {SHELL_LABELS.legendVolumeLabel} {bar.volumeText}
              </span>
            )}
          </span>
        )}
      </div>
      {userMain.map((instance, index) => {
        const key = `${instance.definitionId}:${instance.role}`
        const definition = ctrl?.catalog.find((item) => item.id === instance.definitionId)
        const row = legendRows[index]
        return renderIndicatorRow({
          key,
          label: instance.label,
          paramsText:
            row?.params !== undefined
              ? `(${row.params.join(', ')})`
              : formatParams(definition, instance),
          values: row?.values,
          instance,
          hidden: false,
        })
      })}
      {stashed
        .filter((item) => item.role === 'main')
        .map((stash) =>
          renderIndicatorRow({
            key: stash.key,
            label: stash.label,
            paramsText: '',
            instance: null,
            hidden: true,
          }),
        )}
      {subInstances.map((instance) =>
        renderIndicatorRow({
          key: `${instance.definitionId}:${instance.role}`,
          label: instance.label,
          paramsText: formatParams(
            ctrl?.catalog.find((item) => item.id === instance.definitionId),
            instance,
          ),
          instance,
          hidden: false,
        }),
      )}
      {stashed
        .filter((item) => item.role === 'sub')
        .map((stash) =>
          renderIndicatorRow({
            key: stash.key,
            label: stash.label,
            paramsText: '',
            instance: null,
            hidden: true,
          }),
        )}
    </div>
  )
}

/** 参数内联编辑器：按定义逐键渲染输入控件，确认经 updateIndicatorParams 写回。 */
function ParamsEditor({
  instance,
  onDone,
}: {
  instance: IndicatorInstance
  onDone: () => void
}) {
  const shell = useNexusShell()
  const definition = shell.ctrl?.catalog.find((item) => item.id === instance.definitionId)
  const [draft, setDraft] = useState<Record<string, unknown>>(() => {
    const initial: Record<string, unknown> = {}
    for (const param of definition?.params ?? []) {
      initial[param.key] = instance.params[param.key] ?? param.default
    }
    return initial
  })

  function setParam(key: string, value: unknown) {
    setDraft((prev) => ({ ...prev, [key]: value }))
  }

  function renderInput(param: IndicatorParamDef) {
    const value = draft[param.key]
    if (param.type === 'boolean') {
      return (
        <input
          type="checkbox"
          checked={value === true}
          onChange={(event: ChangeEvent<HTMLInputElement>) => setParam(param.key, event.target.checked)}
        />
      )
    }
    if (param.type === 'number') {
      return (
        <input
          type="number"
          min={param.min}
          max={param.max}
          step={param.step}
          value={typeof value === 'number' ? value : Number(value ?? 0)}
          onChange={(event: ChangeEvent<HTMLInputElement>) => setParam(param.key, Number(event.target.value))}
        />
      )
    }
    if (param.type === 'color') {
      return (
        <input
          type="color"
          value={typeof value === 'string' ? value : '#2962ff'}
          onChange={(event: ChangeEvent<HTMLInputElement>) => setParam(param.key, event.target.value)}
        />
      )
    }
    if (param.type === 'select') {
      return (
        <select
          value={typeof value === 'string' ? value : ''}
          onChange={(event: ChangeEvent<HTMLSelectElement>) => setParam(param.key, event.target.value)}
        >
          {param.options?.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      )
    }
    return (
      <input
        type="text"
        value={typeof value === 'string' ? value : ''}
        onChange={(event: ChangeEvent<HTMLInputElement>) => setParam(param.key, event.target.value)}
      />
    )
  }

  function confirm() {
    if (shell.ctrl !== null) shell.ctrl.updateIndicatorParams(instance.id, draft)
    onDone()
  }

  return (
    <div className="nx-legend__editor">
      {(definition?.params ?? []).map((param) => (
        <label key={param.key} className="nx-legend__editor-row">
          <span>{param.label}</span>
          {renderInput(param)}
        </label>
      ))}
      <button type="button" className="nx-btn nx-btn--primary" onClick={confirm}>
        {SHELL_LABELS.legendParamsConfirm}
      </button>
    </div>
  )
}
