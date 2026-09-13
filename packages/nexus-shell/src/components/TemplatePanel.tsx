// 模板管理面板：列出全部绘图模板，支持套用到当前选中（同 kind）、
// 行内重命名、删除；顶部开关控制“下次绘制自动套用最近模板”。

import { useMemo, useState } from 'react'
import { useNexusShell } from '../shell/NexusShellContext'
import {
  listTemplates,
  loadLastUsedTemplateName,
  markTemplateUsed,
  removeTemplate,
  renameTemplate,
} from '../shell/drawingTemplates'
import { kindToolLabel } from '../shell/drawingTools'
import { SHELL_LABELS } from '../shell/labels'
import { ToolIcon } from '../shell/icons'

/** 模板面板组件。 */
export function TemplatePanel() {
  const shell = useNexusShell()
  const [renaming, setRenaming] = useState<{ kind: string; name: string; draft: string } | null>(
    null,
  )

  const records = useMemo(
    () => listTemplates(),
    // templateVersion 是模板库变更信号（保存/删除后自增）。
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [shell.templateVersion],
  )

  /** 套用：要求当前有同 kind 选中。 */
  function apply(kind: string, name: string) {
    shell.applyTemplateToSelection(kind, name)
  }

  /** 重命名确认。 */
  function confirmRename() {
    if (renaming === null) return
    const next = renaming.draft.trim()
      if (next !== '' && next !== renaming.name) {
      renameTemplate(renaming.kind, renaming.name, next)
      if (loadLastUsedTemplateName(renaming.kind) === renaming.name) {
        markTemplateUsed(renaming.kind, next)
      }
      shell.bumpTemplateVersion()
    }
    setRenaming(null)
  }

  return (
    <section className="nx-side-panel__section">
      <h2 className="nx-side-panel__title">{SHELL_LABELS.templateSectionTitle}</h2>

      <label className="nx-side-panel__row nx-side-panel__row--toggle">
        <span>{SHELL_LABELS.templateAutoApply}</span>
        <input
          type="checkbox"
          checked={shell.autoApply}
          onChange={shell.toggleAutoApply}
        />
      </label>

      {records.length === 0 ? (
        <p className="nx-side-panel__empty">{SHELL_LABELS.templateEmpty}</p>
      ) : (
        records.map((record) => {
          const isRenaming =
            renaming !== null && renaming.kind === record.kind && renaming.name === record.name
          return (
            <div key={`${record.kind}/${record.name}`} className="nx-side-panel__row">
              {isRenaming && renaming !== null ? (
                <>
                  <input
                    className="nx-side-panel__rename"
                    type="text"
                    value={renaming.draft}
                    autoFocus
                    onChange={(event) => setRenaming({ ...renaming, draft: event.target.value })}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') confirmRename()
                      if (event.key === 'Escape') setRenaming(null)
                    }}
                  />
                  <button type="button" className="nx-iconbtn" title={SHELL_LABELS.templateRenameConfirm} onClick={confirmRename}>
                    <ToolIcon name="device-floppy" className="nx-iconbtn__icon" />
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    className="nx-side-panel__name"
                    title={`${kindToolLabel(record.kind)} · ${record.name}`}
                    onClick={() => apply(record.kind, record.name)}
                  >
                    <span className="nx-side-panel__kind">{kindToolLabel(record.kind)}</span>
                    {record.name}
                  </button>
                  <button
                    type="button"
                    className="nx-iconbtn"
                    title={SHELL_LABELS.templateRename}
                    onClick={() =>
                      setRenaming({ kind: record.kind, name: record.name, draft: record.name })
                    }
                  >
                    <ToolIcon name="pencil" className="nx-iconbtn__icon" />
                  </button>
                  <button
                    type="button"
                    className="nx-iconbtn"
                    title={SHELL_LABELS.templateRemove}
                    onClick={() => {
                      removeTemplate(record.kind, record.name)
                      shell.bumpTemplateVersion()
                    }}
                  >
                    <ToolIcon name="trash" className="nx-iconbtn__icon" />
                  </button>
                </>
              )}
            </div>
          )
        })
      )}
    </section>
  )
}
