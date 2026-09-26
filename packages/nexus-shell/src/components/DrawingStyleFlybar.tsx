// 绘图属性浮条：选中图元即浮出（图表顶部居中），提供颜色/线宽/线型/填充/
// 锁定/模板/删除控制；多选时按字段交集显示可控项、按值一致性显示混合态。

import type { DrawingStyle } from '@363045841yyt/klinechart-core/plugin'
import { type ChangeEvent, useMemo, useState } from 'react'
import { listTemplates, markTemplateUsed, saveTemplate } from '../shell/drawingTemplates'
import { ToolIcon } from '../shell/icons'
import { SHELL_LABELS } from '../shell/labels'
import { useNexusShell } from '../shell/NexusShellContext'

/** 可控样式字段名。 */
type FlybarStyleKey = keyof DrawingStyle

/** 线宽档位。 */
const WIDTH_OPTIONS = [1, 2, 3, 4] as const
/** 碰撞哨兵：模板下拉的“保存为模板”项。 */
const SAVE_SENTINEL = '__save__'

/** 属性浮条组件。 */
export function DrawingStyleFlybar() {
  const shell = useNexusShell()
  const { selectedDrawings, selectedIds, ctrl } = shell
  const [saveOpen, setSaveOpen] = useState(false)

  // 字段交集（引擎 getBatchStyleKeys）决定哪些控制可见。
  const styleKeys = useMemo<ReadonlyArray<FlybarStyleKey>>(
    () => (ctrl ? ctrl.getBatchStyleKeys(selectedIds) : []),
    [ctrl, selectedIds],
  )
  const first = selectedDrawings[0]?.style ?? {}
  const canEdit = (key: FlybarStyleKey) => styleKeys.includes(key)
  /** 值一致性：任一图元该字段值不同即混合态。 */
  const isMixed = (key: FlybarStyleKey) =>
    selectedDrawings.some((drawing) => drawing.style[key] !== first[key])

  const firstKind = selectedDrawings[0]?.kind
  const sameKind = selectedDrawings.every((drawing) => drawing.kind === firstKind)
  const templates = useMemo(
    () => (firstKind ? listTemplates().filter((item) => item.kind === firstKind) : []),
    [firstKind, shell.templateVersion],
  )

  const allLocked = selectedDrawings.length > 0 && selectedDrawings.every((d) => d.locked === true)

  /** 颜色变化统一入口（stroke/fill 各自调用）。 */
  function onColor(key: 'stroke' | 'fill', event: ChangeEvent<HTMLInputElement>) {
    shell.updateSelectionStyle({ [key]: event.target.value } as Partial<DrawingStyle>)
  }

  function onWidthChange(event: ChangeEvent<HTMLSelectElement>) {
    shell.updateSelectionStyle({ strokeWidth: Number(event.target.value) })
  }

  function onStyleChange(event: ChangeEvent<HTMLSelectElement>) {
    shell.updateSelectionStyle({ strokeStyle: event.target.value as DrawingStyle['strokeStyle'] })
  }

  function onOpacityChange(event: ChangeEvent<HTMLInputElement>) {
    shell.updateSelectionStyle({ fillOpacity: Number(event.target.value) / 100 })
  }

  /** 模板下拉：套用选中项；哨兵项打开保存对话框。 */
  function onTemplatePick(event: ChangeEvent<HTMLSelectElement>) {
    const value = event.target.value
    event.target.value = ''
    if (value === SAVE_SENTINEL) {
      setSaveOpen(true)
      return
    }
    if (value && firstKind) shell.applyTemplateToSelection(firstKind, value)
  }

  /** 保存确认：以首个图元完整样式为模板内容。 */
  function handleSave(name: string) {
    if (!firstKind) return
    const style = selectedDrawings[0]?.style ?? {}
    saveTemplate(firstKind, name, style)
    markTemplateUsed(firstKind, name)
    shell.bumpTemplateVersion()
    setSaveOpen(false)
  }

  return (
    <div className="nx-flybar" onPointerDown={stopPropagation} role="toolbar">
      {canEdit('stroke') && (
        <label className="nx-flybar__color" title={SHELL_LABELS.flybarColorTitle}>
          <span
            className={`nx-flybar__swatch${isMixed('stroke') ? ' nx-flybar__swatch--mixed' : ''}`}
            style={isMixed('stroke') ? undefined : { background: first.stroke ?? '#2962ff' }}
          />
          <input
            type="color"
            className="nx-flybar__color-input"
            value={typeof first.stroke === 'string' ? first.stroke : '#2962ff'}
            onChange={(event) => onColor('stroke', event)}
          />
        </label>
      )}

      {canEdit('strokeWidth') && (
        <select
          className="nx-flybar__select"
          title={SHELL_LABELS.flybarWidthTitle}
          value={
            isMixed('strokeWidth') || first.strokeWidth === undefined
              ? ''
              : String(first.strokeWidth)
          }
          onChange={onWidthChange}
        >
          {(isMixed('strokeWidth') || first.strokeWidth === undefined) && (
            <option value="">{SHELL_LABELS.flybarMixedValue}</option>
          )}
          {WIDTH_OPTIONS.map((width) => (
            <option key={width} value={width}>
              {width}px
            </option>
          ))}
        </select>
      )}

      {canEdit('strokeStyle') && (
        <select
          className="nx-flybar__select"
          title={SHELL_LABELS.flybarStyleTitle}
          value={isMixed('strokeStyle') || first.strokeStyle === undefined ? '' : first.strokeStyle}
          onChange={onStyleChange}
        >
          {(isMixed('strokeStyle') || first.strokeStyle === undefined) && (
            <option value="">{SHELL_LABELS.flybarMixedValue}</option>
          )}
          <option value="solid">{SHELL_LABELS.strokeSolid}</option>
          <option value="dashed">{SHELL_LABELS.strokeDashed}</option>
          <option value="dotted">{SHELL_LABELS.strokeDotted}</option>
        </select>
      )}

      {canEdit('fill') && (
        <label className="nx-flybar__color" title={SHELL_LABELS.flybarFillTitle}>
          <span
            className={`nx-flybar__swatch nx-flybar__swatch--fill${
              isMixed('fill') ? ' nx-flybar__swatch--mixed' : ''
            }`}
            style={isMixed('fill') ? undefined : { background: first.fill ?? '#2962ff33' }}
          />
          <input
            type="color"
            className="nx-flybar__color-input"
            value={typeof first.fill === 'string' ? first.fill : '#2962ff'}
            onChange={(event) => onColor('fill', event)}
          />
        </label>
      )}

      {canEdit('fillOpacity') && (
        <input
          className="nx-flybar__range"
          type="range"
          min={0}
          max={100}
          title={SHELL_LABELS.flybarFillOpacityTitle}
          value={
            isMixed('fillOpacity') || first.fillOpacity === undefined
              ? 50
              : Math.round((first.fillOpacity ?? 0.5) * 100)
          }
          onChange={onOpacityChange}
        />
      )}

      {selectedDrawings.length > 1 && (
        <span className="nx-flybar__count">
          {SHELL_LABELS.flybarSelectedCount(selectedDrawings.length)}
        </span>
      )}

      {sameKind && templates.length > 0 && (
        <select
          className="nx-flybar__select"
          title={SHELL_LABELS.flybarTemplateTitle}
          value=""
          onChange={onTemplatePick}
        >
          <option value="">{SHELL_LABELS.flybarTemplateTitle}</option>
          {templates.map((item) => (
            <option key={item.name} value={item.name}>
              {item.name}
            </option>
          ))}
          <option value={SAVE_SENTINEL}>{SHELL_LABELS.flybarTemplateSave}</option>
        </select>
      )}
      {(templates.length === 0 || !sameKind) && (
        <button
          type="button"
          className="nx-flybar__btn"
          title={SHELL_LABELS.flybarTemplateSave}
          onClick={() => setSaveOpen(true)}
        >
          <ToolIcon name="device-floppy" className="nx-flybar__icon" />
        </button>
      )}

      <button
        type="button"
        className={`nx-flybar__btn${allLocked ? ' nx-flybar__btn--active' : ''}`}
        title={allLocked ? SHELL_LABELS.flybarUnlockTitle : SHELL_LABELS.flybarLockTitle}
        onClick={shell.toggleSelectionLock}
      >
        <ToolIcon name={allLocked ? 'lock' : 'lock-open'} className="nx-flybar__icon" />
      </button>

      <button
        type="button"
        className="nx-flybar__btn nx-flybar__btn--danger"
        title={SHELL_LABELS.flybarDeleteTitle}
        onClick={shell.deleteSelection}
      >
        <ToolIcon name="trash" className="nx-flybar__icon" />
      </button>

      {saveOpen && <SaveTemplateDialog onConfirm={handleSave} onClose={() => setSaveOpen(false)} />}
    </div>
  )
}

/** 保存模板对话框：命名 + 确认/取消。 */
function SaveTemplateDialog({
  onConfirm,
  onClose,
}: {
  onConfirm: (name: string) => void
  onClose: () => void
}) {
  const [name, setName] = useState('')
  const [error, setError] = useState(false)

  function confirm() {
    const trimmed = name.trim()
    if (trimmed === '') {
      setError(true)
      return
    }
    onConfirm(trimmed)
  }

  return (
    <div className="nx-dialog" role="dialog" aria-modal="true">
      <div className="nx-dialog__panel">
        <h3 className="nx-dialog__title">{SHELL_LABELS.templateSaveTitle}</h3>
        <input
          className={`nx-dialog__input${error ? ' nx-dialog__input--error' : ''}`}
          type="text"
          value={name}
          placeholder={SHELL_LABELS.templateNamePlaceholder}
          autoFocus
          onChange={(event) => {
            setName(event.target.value)
            setError(false)
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') confirm()
            if (event.key === 'Escape') onClose()
          }}
        />
        {error && <p className="nx-dialog__error">{SHELL_LABELS.templateNameRequired}</p>}
        <div className="nx-dialog__actions">
          <button type="button" className="nx-btn" onClick={onClose}>
            {SHELL_LABELS.templateCancel}
          </button>
          <button type="button" className="nx-btn nx-btn--primary" onClick={confirm}>
            {SHELL_LABELS.templateSaveConfirm}
          </button>
        </div>
      </div>
    </div>
  )
}

/** 阻止浮条上的指针事件落到图表容器。 */
function stopPropagation(event: React.PointerEvent) {
  event.stopPropagation()
}
