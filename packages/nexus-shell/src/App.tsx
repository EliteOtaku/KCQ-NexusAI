// NexusAI Shell 根组件：组装顶栏/绘图工具条/图表舞台/右侧面板，持有壳级 UI 状态。

import { useState } from 'react'
import { ChartStage } from './components/ChartStage'
import { DrawingToolbar } from './components/DrawingToolbar'
import { IndicatorPanel } from './components/IndicatorPanel'
import { TemplatePanel } from './components/TemplatePanel'
import { TopBar } from './components/TopBar'

type ThemeName = 'light' | 'dark'

/** 壳根组件。 */
export function App() {
  const [theme, setTheme] = useState<ThemeName>('dark')
  const [period, setPeriod] = useState('60min')
  const [activeTool, setActiveTool] = useState('cursor')

  // 主题切换写 document 属性，tokens.css 按属性切换变量组。
  function handleThemeToggle() {
    const next: ThemeName = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    document.documentElement.dataset.theme = next
  }

  return (
    <div className="nx-app">
      <TopBar
        currentPeriod={period}
        onPeriodChange={setPeriod}
        theme={theme}
        onThemeToggle={handleThemeToggle}
      />
      <div className="nx-body">
        <DrawingToolbar activeTool={activeTool} onToolSelect={setActiveTool} />
        <div className="nx-body__main">
          <ChartStage />
        </div>
        <aside className="nx-side-panel">
          <IndicatorPanel />
          <TemplatePanel store={null} />
        </aside>
      </div>
    </div>
  )
}
