// 图表设置对话框（B3-02）：数据源（Mock/MT5）+ 主题切换 + 壳偏好（磁吸/stay/自动套用）。
// 偏好经 NexusShellContext 读写并持久化于 nexus.shell.prefs；无引擎写入。
// MT5 可达性在点击切换时才探测（不在挂载时发请求，保持 mock 路径零网络噪声）；
// 探测失败保持 Mock 并行内提示。

import { useEffect, useState } from 'react'
import type { MagnetMode } from '../shell/pointerBridge'
import { useNexusShell } from '../shell/NexusShellContext'
import { SHELL_LABELS } from '../shell/labels'

/** 设置对话框组件。 */
export function SettingsDialog({ onClose }: { onClose: () => void }) {
  const shell = useNexusShell()
  // MT5 切换中 / 上次切换失败（探测不可达）
  const [checking, setChecking] = useState(false)
  const [switchFailed, setSwitchFailed] = useState(false)

  // Esc 关闭（窗口级；壳级 Esc 逻辑互不干扰）。
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  /** 切换数据源：切 MT5 时探测连接器可达性，失败保持现状并提示。 */
  async function handleSelect(next: 'mock' | 'mt5') {
    if (next === shell.dataSource || checking) return
    setChecking(true)
    setSwitchFailed(false)
    const ok = await shell.selectDataSource(next)
    setChecking(false)
    setSwitchFailed(!ok)
  }

  return (
    <div
      className="nx-dialog"
      role="dialog"
      aria-modal="true"
      aria-label={SHELL_LABELS.settingsTitle}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className="nx-dialog__panel">
        <h3 className="nx-dialog__title">{SHELL_LABELS.settingsTitle}</h3>

        <div className="nx-settings__row">
          <span className="nx-settings__label">{SHELL_LABELS.settingsSourceLabel}</span>
          <div className="nx-settings__segment">
            <button
              type="button"
              disabled={checking}
              className={`nx-settings__segment-btn${shell.dataSource === 'mock' ? ' nx-settings__segment-btn--active' : ''}`}
              onClick={() => void handleSelect('mock')}
            >
              {SHELL_LABELS.settingsSourceMock}
            </button>
            <button
              type="button"
              disabled={checking}
              className={`nx-settings__segment-btn${shell.dataSource === 'mt5' ? ' nx-settings__segment-btn--active' : ''}`}
              onClick={() => void handleSelect('mt5')}
            >
              {SHELL_LABELS.settingsSourceMt5}
            </button>
          </div>
        </div>
        {switchFailed && (
          <div className="nx-settings__hint">{SHELL_LABELS.settingsSourceMt5Unavailable}</div>
        )}

        <div className="nx-settings__row">
          <span className="nx-settings__label">{SHELL_LABELS.settingsThemeLabel}</span>
          <div className="nx-settings__segment">
            <button
              type="button"
              className={`nx-settings__segment-btn${shell.theme === 'dark' ? ' nx-settings__segment-btn--active' : ''}`}
              onClick={() => shell.setTheme('dark')}
            >
              {SHELL_LABELS.settingsThemeDark}
            </button>
            <button
              type="button"
              className={`nx-settings__segment-btn${shell.theme === 'light' ? ' nx-settings__segment-btn--active' : ''}`}
              onClick={() => shell.setTheme('light')}
            >
              {SHELL_LABELS.settingsThemeLight}
            </button>
          </div>
        </div>

        <div className="nx-settings__row">
          <span className="nx-settings__label">{SHELL_LABELS.settingsMagnetLabel}</span>
          <select
            className="nx-settings__select"
            value={shell.magnet}
            onChange={(event) => shell.setMagnet(event.target.value as MagnetMode)}
          >
            <option value="off">{SHELL_LABELS.settingsMagnetOff}</option>
            <option value="weak">{SHELL_LABELS.settingsMagnetWeak}</option>
            <option value="strong">{SHELL_LABELS.settingsMagnetStrong}</option>
          </select>
        </div>

        <label className="nx-settings__row nx-settings__row--check">
          <input
            type="checkbox"
            checked={shell.stay}
            onChange={() => shell.toggleStay()}
          />
          <span>{SHELL_LABELS.settingsStayLabel}</span>
        </label>

        <label className="nx-settings__row nx-settings__row--check">
          <input
            type="checkbox"
            checked={shell.autoApply}
            onChange={() => shell.toggleAutoApply()}
          />
          <span>{SHELL_LABELS.settingsAutoApplyLabel}</span>
        </label>

        <div className="nx-dialog__actions">
          <button type="button" className="nx-btn nx-btn--primary" onClick={onClose}>
            {SHELL_LABELS.settingsClose}
          </button>
        </div>
      </div>
    </div>
  )
}
