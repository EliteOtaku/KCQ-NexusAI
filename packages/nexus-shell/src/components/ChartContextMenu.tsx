// 图表右键菜单（B2-06）：命中图元 → 样式/锁定/删除；未命中 → 主题/周期/添加指标。
// 命中判定用引擎 hitTestAt（与点选同口径）；点击菜单外部或 Esc 关闭。

import { useEffect, useRef } from 'react'
import { SHELL_LABELS } from '../shell/labels'
import { useNexusShell } from '../shell/NexusShellContext'
import { ALL_PERIODS } from '../shell/periods'

/** 菜单会话状态：drawing 为 null 表示背景菜单。 */
export interface ContextMenuState {
  /** 菜单左上角在图表舞台内的局部坐标（已按舞台尺寸收边）。 */
  x: number
  y: number
  drawing: { id: string; locked: boolean } | null
}

/** 右键菜单组件。 */
export function ChartContextMenu({
  state,
  onClose,
}: {
  state: ContextMenuState
  onClose: () => void
}) {
  const shell = useNexusShell()
  const rootRef = useRef<HTMLDivElement>(null)

  // 点击菜单外部（捕获阶段）或 Esc 关闭。
  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (rootRef.current !== null && !rootRef.current.contains(event.target as Node)) onClose()
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('pointerdown', onPointerDown, true)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [onClose])

  /** 执行动作后收起菜单。 */
  function run(action: () => void) {
    action()
    onClose()
  }

  const ctrl = shell.ctrl

  return (
    <div ref={rootRef} className="nx-ctx-menu" role="menu" style={{ left: state.x, top: state.y }}>
      {state.drawing !== null ? (
        <>
          <button
            type="button"
            className="nx-ctx-menu__item"
            role="menuitem"
            onClick={() => run(() => shell.ctrl?.setSelectedDrawingIds([state.drawing!.id]))}
          >
            {SHELL_LABELS.ctxStyleTitle}
          </button>
          <button
            type="button"
            className="nx-ctx-menu__item"
            role="menuitem"
            onClick={() =>
              run(() =>
                shell.ctrl?.updateBatch([state.drawing!.id], { locked: !state.drawing!.locked }),
              )
            }
          >
            {state.drawing.locked ? SHELL_LABELS.ctxUnlockTitle : SHELL_LABELS.ctxLockTitle}
          </button>
          <button
            type="button"
            className="nx-ctx-menu__item"
            role="menuitem"
            onClick={() => run(() => shell.ctrl?.removeBatch([state.drawing!.id]))}
          >
            {SHELL_LABELS.ctxDeleteTitle}
          </button>
        </>
      ) : (
        <>
          <button
            type="button"
            className="nx-ctx-menu__item"
            role="menuitem"
            onClick={() => run(() => shell.toggleTheme())}
          >
            {SHELL_LABELS.ctxThemeTitle}
          </button>
          <div className="nx-ctx-menu__item nx-ctx-menu__item--sub">
            <span>{SHELL_LABELS.ctxPeriodTitle}</span>
            <div className="nx-ctx-menu__submenu" role="menu">
              {ALL_PERIODS.map((period) => (
                <button
                  key={period.value}
                  type="button"
                  className={`nx-ctx-menu__item${period.value === shell.period ? ' nx-ctx-menu__item--active' : ''}`}
                  role="menuitem"
                  onClick={() => run(() => shell.setPeriod(period.value))}
                >
                  {period.label}
                </button>
              ))}
            </div>
          </div>
          <div className="nx-ctx-menu__item nx-ctx-menu__item--sub">
            <span>{SHELL_LABELS.ctxAddIndicatorTitle}</span>
            <div className="nx-ctx-menu__submenu" role="menu">
              {(ctrl?.catalog ?? []).map((definition) => (
                <button
                  key={definition.id}
                  type="button"
                  className="nx-ctx-menu__item"
                  role="menuitem"
                  onClick={() =>
                    run(() => shell.ctrl?.addIndicator(definition.id, definition.role))
                  }
                >
                  {definition.label}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
