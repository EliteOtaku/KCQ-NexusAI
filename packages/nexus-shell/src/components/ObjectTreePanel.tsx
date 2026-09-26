// 对象树（B3-03）：列出全部图元，行点击定位（选中高亮 + 属性浮条），
// 行内 显隐/锁定/删除。注：简报所引 scrollToDataIndex 在 core 不存在，
// 定位以选中高亮实现；滚动定位待引擎补 API（见 backlog）。
// 外壳（分区标题/折叠）由 PanelSection 提供。

import { kindToolLabel } from '../shell/drawingTools'
import { SHELL_LABELS } from '../shell/labels'
import { useNexusShell } from '../shell/NexusShellContext'

/** 对象树面板组件。 */
export function ObjectTreePanel() {
  const shell = useNexusShell()
  const ctrl = shell.ctrl
  const drawings = shell.drawings

  if (drawings.length === 0) {
    return <p className="nx-side-panel__empty">{SHELL_LABELS.objectEmpty}</p>
  }

  return (
    <>
      {drawings.map((drawing) => {
        const selected = shell.selectedIds.includes(drawing.id)
        return (
          <div
            key={drawing.id}
            className={`nx-object__row${selected ? ' nx-object__row--selected' : ''}`}
            role="button"
            tabIndex={0}
            onClick={() => ctrl?.setSelectedDrawingIds([drawing.id])}
            onKeyDown={(event) => {
              if (event.key === 'Enter') ctrl?.setSelectedDrawingIds([drawing.id])
            }}
          >
            <span className="nx-object__kind">{kindToolLabel(drawing.kind)}</span>
            <span className="nx-object__id">{drawing.id.slice(0, 6)}</span>
            <span className="nx-object__actions">
              <button
                type="button"
                className="nx-object__action"
                title={
                  drawing.visible ? SHELL_LABELS.objectHideTitle : SHELL_LABELS.objectShowTitle
                }
                onClick={(event) => {
                  event.stopPropagation()
                  ctrl?.updateDrawing({ ...drawing, visible: !drawing.visible })
                }}
              >
                {drawing.visible ? '◉' : '◌'}
              </button>
              <button
                type="button"
                className={`nx-object__action${drawing.locked ? ' nx-object__action--active' : ''}`}
                title={drawing.locked ? SHELL_LABELS.ctxUnlockTitle : SHELL_LABELS.ctxLockTitle}
                onClick={(event) => {
                  event.stopPropagation()
                  ctrl?.updateBatch([drawing.id], { locked: !drawing.locked })
                }}
              >
                {drawing.locked ? '🔒' : '🔓'}
              </button>
              <button
                type="button"
                className="nx-object__action"
                title={SHELL_LABELS.ctxDeleteTitle}
                onClick={(event) => {
                  event.stopPropagation()
                  ctrl?.removeBatch([drawing.id])
                }}
              >
                ✕
              </button>
            </span>
          </div>
        )
      })}
    </>
  )
}
