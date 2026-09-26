// 左侧绘图工具条（TV 形态）：光标/框选/测量/橡皮 + 置顶的收藏区 +
// 分组 flyout（线条/通道/形状标注，组按钮记忆最近子工具）+
// 磁吸三态循环 + 保持绘图模式 + 缩放。

import { useEffect, useRef, useState } from 'react'
import { findTool, SHELL_TOOL_CATALOG, type ShellToolDef, TOOL_GROUPS } from '../shell/drawingTools'
import { ToolIcon } from '../shell/icons'
import { SHELL_LABELS } from '../shell/labels'
import { useNexusShell } from '../shell/NexusShellContext'

/** 左工具条组件。 */
export function DrawingToolbar() {
  const shell = useNexusShell()
  const [openGroupId, setOpenGroupId] = useState<string | null>(null)
  const rootRef = useRef<HTMLElement>(null)

  // 点击工具条外部时关闭 flyout（捕获阶段，行为对齐 Vue 版）。
  useEffect(() => {
    const onDocumentClick = (event: MouseEvent) => {
      if (rootRef.current !== null && !rootRef.current.contains(event.target as Node)) {
        setOpenGroupId(null)
      }
    }
    document.addEventListener('click', onDocumentClick, true)
    return () => document.removeEventListener('click', onDocumentClick, true)
  }, [])

  const plainTools = SHELL_TOOL_CATALOG.filter((tool) => tool.group === null)
  const favoriteTools = shell.favorites
    .map((id) => findTool(id))
    .filter((tool): tool is ShellToolDef => tool !== undefined)

  const magnetLabel =
    shell.magnet === 'off'
      ? SHELL_LABELS.magnetOff
      : shell.magnet === 'weak'
        ? SHELL_LABELS.magnetWeak
        : SHELL_LABELS.magnetStrong

  return (
    <aside
      ref={rootRef}
      className="nx-drawing-toolbar"
      aria-label={SHELL_LABELS.drawingSectionTitle}
    >
      {plainTools.map((tool) => (
        <ToolButton
          key={tool.id}
          tool={tool}
          active={shell.activeTool === tool.id}
          onSelect={() => shell.selectTool(tool.id)}
        />
      ))}

      <span className="nx-toolbar-divider" />

      {favoriteTools.length > 0 && (
        <>
          {favoriteTools.map((tool) => (
            <ToolButton
              key={`fav-${tool.id}`}
              tool={tool}
              active={shell.activeTool === tool.id}
              onSelect={() => shell.selectTool(tool.id)}
            />
          ))}
          <span className="nx-toolbar-divider" />
        </>
      )}

      {TOOL_GROUPS.map((group) => {
        const children = SHELL_TOOL_CATALOG.filter((tool) => tool.group === group.id)
        const lastUsed = findTool(shell.groupLastTool[group.id] ?? '') ?? children[0]!
        const groupActive = children.some((tool) => tool.id === shell.activeTool)
        const open = openGroupId === group.id
        return (
          <div key={group.id} className="nx-toolbar-item">
            <button
              type="button"
              className={`nx-toolbtn${groupActive ? ' nx-toolbtn--active' : ''}`}
              title={group.label}
              aria-label={group.label}
              onClick={() => {
                // 组按钮点击：沿用上次子工具并展开；再次点击仅收起。
                if (!groupActive) shell.selectTool(lastUsed.id)
                setOpenGroupId(open ? null : group.id)
              }}
            >
              <ToolIcon name={lastUsed.icon} className="nx-toolbtn__icon" />
              <span className={`nx-toolbtn__corner${open ? ' nx-toolbtn__corner--open' : ''}`} />
            </button>

            {open && (
              <div className="nx-flyout" role="menu">
                {children.map((child) => {
                  const starred = shell.favorites.includes(child.id)
                  return (
                    <div key={child.id} className="nx-flyout__item">
                      <button
                        type="button"
                        className={`nx-toolbtn${shell.activeTool === child.id ? ' nx-toolbtn--active' : ''}`}
                        title={child.label}
                        aria-label={child.label}
                        onClick={() => {
                          shell.selectTool(child.id)
                          shell.setGroupLastTool(group.id, child.id)
                          setOpenGroupId(null)
                        }}
                      >
                        <ToolIcon name={child.icon} className="nx-toolbtn__icon" />
                      </button>
                      <button
                        type="button"
                        className="nx-flyout__star"
                        title={
                          starred ? SHELL_LABELS.unfavoriteToggle : SHELL_LABELS.favoriteToggle
                        }
                        aria-label={
                          starred ? SHELL_LABELS.unfavoriteToggle : SHELL_LABELS.favoriteToggle
                        }
                        onClick={() => shell.toggleFavorite(child.id)}
                      >
                        <ToolIcon
                          name={starred ? 'star-filled' : 'star'}
                          className="nx-flyout__star-icon"
                        />
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}

      <span className="nx-toolbar-divider" />

      <button
        type="button"
        className={`nx-toolbtn nx-toolbtn--magnet-${shell.magnet}`}
        title={magnetLabel}
        aria-label={magnetLabel}
        onClick={shell.cycleMagnet}
      >
        <ToolIcon name="magnet" className="nx-toolbtn__icon" />
      </button>
      <button
        type="button"
        className={`nx-toolbtn${shell.stay ? ' nx-toolbtn--active' : ''}`}
        title={shell.stay ? SHELL_LABELS.stayModeActive : SHELL_LABELS.stayModeTitle}
        aria-label={SHELL_LABELS.stayModeTitle}
        aria-pressed={shell.stay}
        onClick={shell.toggleStay}
      >
        <ToolIcon name="chart-line" className="nx-toolbtn__icon" />
      </button>

      <span className="nx-toolbar-divider" />

      <button
        type="button"
        className="nx-toolbtn"
        title={SHELL_LABELS.zoomInTitle}
        aria-label={SHELL_LABELS.zoomInTitle}
        onClick={() => shell.ctrl?.zoomIn()}
      >
        <ToolIcon name="zoom-in" className="nx-toolbtn__icon" />
      </button>
      <button
        type="button"
        className="nx-toolbtn"
        title={SHELL_LABELS.zoomOutTitle}
        aria-label={SHELL_LABELS.zoomOutTitle}
        onClick={() => shell.ctrl?.zoomOut()}
      >
        <ToolIcon name="zoom-out" className="nx-toolbtn__icon" />
      </button>
    </aside>
  )
}

/** 通用工具按钮。 */
function ToolButton({
  tool,
  active,
  onSelect,
}: {
  tool: ShellToolDef
  active: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      className={`nx-toolbtn${active ? ' nx-toolbtn--active' : ''}`}
      title={tool.label}
      aria-label={tool.label}
      aria-pressed={active}
      onClick={onSelect}
    >
      <ToolIcon name={tool.icon} className="nx-toolbtn__icon" />
    </button>
  )
}
