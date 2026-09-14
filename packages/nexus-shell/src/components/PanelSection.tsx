// 右栏折叠分区（B4-05 面板开关）：标题行点击折叠/展开，状态持久化于 nexus.panel。
// 分区带稳定修饰类（--{key}），探针/样式不依赖 DOM 顺序。

import { useEffect, useState, type ReactNode } from 'react'
import { readJson, writeJson, STORAGE_KEYS } from '../shell/storage'

type PanelSections = Record<string, boolean>

/** 默认全展开；持久化值合并覆盖。 */
const DEFAULT_SECTIONS: PanelSections = {
  watchlist: true,
  objects: true,
  indicators: true,
  templates: true,
}

/** 分区折叠状态（App 层单实例持有，向下分发，避免多实例写互踩）。 */
export function usePanelSections(): {
  isCollapsed: (key: string) => boolean
  toggleSection: (key: string) => void
} {
  const [sections, setSections] = useState<PanelSections>(() => ({
    ...DEFAULT_SECTIONS,
    ...readJson<PanelSections>(STORAGE_KEYS.panel, {}),
  }))

  useEffect(() => {
    writeJson(STORAGE_KEYS.panel, sections)
  }, [sections])

  return {
    isCollapsed: (key) => sections[key] === false,
    toggleSection: (key) => setSections((prev) => ({ ...prev, [key]: !(prev[key] ?? true) })),
  }
}

/** 折叠分区容器。 */
export function PanelSection({
  sectionKey,
  title,
  collapsed,
  onToggle,
  children,
}: {
  sectionKey: string
  title: string
  collapsed: boolean
  onToggle: () => void
  children: ReactNode
}) {
  return (
    <section className={`nx-side-panel__section nx-side-panel__section--${sectionKey}`}>
      <h2 className="nx-side-panel__title">
        <button
          type="button"
          className="nx-side-panel__title-btn"
          onClick={onToggle}
          aria-expanded={!collapsed}
        >
          <span>{title}</span>
          <span className="nx-side-panel__chevron">{collapsed ? '▸' : '▾'}</span>
        </button>
      </h2>
      {!collapsed && children}
    </section>
  )
}
