// 快捷键表浮层（B4-03）：静态清单数据 + Esc/点击遮罩关闭；可见性由壳上下文驱动。

import { useEffect } from 'react'
import { SHELL_LABELS } from '../shell/labels'
import { useNexusShell } from '../shell/NexusShellContext'

/** 快捷键清单（模块级静态数据）。 */
const SHORTCUT_ROWS: ReadonlyArray<{ keys: string; action: string }> = [
  { keys: 'A-Z', action: '搜索品种（带入首字母）' },
  { keys: '1-9', action: '切换周期' },
  { keys: '?', action: '呼出/收起本表' },
  { keys: '↑ / ↓', action: '微调选中图元价格（±最小变动价位）' },
  { keys: 'Delete / Backspace', action: '删除选中图元' },
  { keys: 'Esc', action: '取消绘制锚点 / 清空选中 / 关闭浮层' },
  { keys: 'Ctrl + 点击', action: '多选图元' },
  { keys: 'Ctrl + 拖拽', action: '复制图元' },
  { keys: 'Shift + 拖拽', action: '45° 角度锁定' },
  { keys: '右键', action: '上下文菜单' },
]

/** 快捷键表浮层组件。 */
export function ShortcutsOverlay() {
  const shell = useNexusShell()

  // Esc 关闭（壳级 Esc 分支已优先处理 shortcutsVisible，这里兜底遮罩点击）。
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') shell.toggleShortcuts()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div
      className="nx-shortcuts"
      role="dialog"
      aria-modal="true"
      aria-label={SHELL_LABELS.shortcutsTitle}
      onClick={(event) => {
        if (event.target === event.currentTarget) shell.toggleShortcuts()
      }}
    >
      <div className="nx-shortcuts__panel">
        <h3 className="nx-shortcuts__title">{SHELL_LABELS.shortcutsTitle}</h3>
        {SHORTCUT_ROWS.map((row) => (
          <div key={row.keys} className="nx-shortcuts__row">
            <kbd className="nx-shortcuts__keys">{row.keys}</kbd>
            <span className="nx-shortcuts__action">{row.action}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
