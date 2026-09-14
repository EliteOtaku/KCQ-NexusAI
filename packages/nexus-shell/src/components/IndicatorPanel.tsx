// 右侧指标管理面板：清单来自引擎 catalog，勾选状态镜像 kernel indicators 信号，
// 切换即 addIndicator/removeIndicator（真正接线，非本地状态）。
// 外壳（分区标题/折叠）由 PanelSection 提供。

import { useMemo } from 'react'
import type { IndicatorDefinition, IndicatorInstance } from '@363045841yyt/klinechart-core/controllers'
import { useNexusShell } from '../shell/NexusShellContext'
import { useSignal } from '../shell/reactivity'
import { SHELL_LABELS } from '../shell/labels'

/** 指标实例空数组兜底（稳定引用）。 */
const EMPTY_INSTANCES: ReadonlyArray<IndicatorInstance> = []

/** 指标面板组件。 */
export function IndicatorPanel() {
  const shell = useNexusShell()
  const ctrl = shell.ctrl
  const instances = useSignal(ctrl?.indicators ?? null, EMPTY_INSTANCES)

  const catalog = ctrl?.catalog ?? []
  const grouped = useMemo(
    () => ({
      main: catalog.filter((definition) => definition.role === 'main'),
      sub: catalog.filter((definition) => definition.role === 'sub'),
    }),
    [catalog],
  )

  /** 勾选切换：已有实例则移除，否则按定义角色添加。 */
  function toggle(definition: IndicatorDefinition) {
    if (ctrl === null) return
    const existing = instances.find((item) => item.definitionId === definition.id)
    if (existing !== undefined) {
      // 主图实例的移除按 definitionId 寻址（引擎不接受 'main:*' 实例 id，见 LegendBar 注记）。
      ctrl.removeIndicator(existing.role === 'main' ? existing.definitionId : existing.id)
    } else {
      ctrl.addIndicator(definition.id, definition.role)
    }
  }

  const isActive = (definitionId: string) =>
    instances.some((item) => item.definitionId === definitionId)

  if (ctrl === null || catalog.length === 0) {
    return <p className="nx-side-panel__empty">{SHELL_LABELS.indicatorEmpty}</p>
  }

  return (
    <>
      {[...grouped.main, ...grouped.sub].map((definition) => (
        <label key={definition.id} className="nx-side-panel__row">
          <span className="nx-side-panel__indicator-name" title={definition.description ?? definition.label}>
            {definition.label}
          </span>
          <input
            type="checkbox"
            checked={isActive(definition.id)}
            onChange={() => toggle(definition)}
          />
        </label>
      ))}
    </>
  )
}
