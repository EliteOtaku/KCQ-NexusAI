// NexusAI Shell 根组件：NexusShellProvider 提供壳级状态，布局组装
// 顶栏 / 绘图工具条 / 图表舞台 / 右侧面板。

import { ChartStage } from './components/ChartStage'
import { DrawingToolbar } from './components/DrawingToolbar'
import { IndicatorPanel } from './components/IndicatorPanel'
import { TemplatePanel } from './components/TemplatePanel'
import { TopBar } from './components/TopBar'
import { NexusShellProvider, useNexusShell } from './shell/NexusShellContext'

/** 应用入口组件。 */
export function App() {
  return (
    <NexusShellProvider>
      <AppLayout />
    </NexusShellProvider>
  )
}

/** 壳布局：必须在 Provider 内消费上下文。 */
function AppLayout() {
  const shell = useNexusShell()

  return (
    <div className="nx-app">
      <TopBar
        currentPeriod={shell.period}
        onPeriodChange={shell.setPeriod}
        theme={shell.theme}
        onThemeToggle={() => shell.setTheme(shell.theme === 'dark' ? 'light' : 'dark')}
      />
      <div className="nx-body">
        <DrawingToolbar />
        <div className="nx-body__main">
          <ChartStage />
        </div>
        <aside className="nx-side-panel">
          <IndicatorPanel />
          <TemplatePanel />
        </aside>
      </div>
    </div>
  )
}
