// NexusAI Shell 根组件：NexusShellProvider 提供壳级状态，布局组装
// 顶栏 / 绘图工具条 / 图表舞台 / 右侧面板。

import { ChartStage } from './components/ChartStage'
import { DrawingToolbar } from './components/DrawingToolbar'
import { IndicatorPanel } from './components/IndicatorPanel'
import { ObjectTreePanel } from './components/ObjectTreePanel'
import { PanelSection, usePanelSections } from './components/PanelSection'
import { ShortcutsOverlay } from './components/ShortcutsOverlay'
import { TemplatePanel } from './components/TemplatePanel'
import { TopBar } from './components/TopBar'
import { WatchlistPanel } from './components/WatchlistPanel'
import { SHELL_LABELS } from './shell/labels'
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
  const { isCollapsed, toggleSection } = usePanelSections()

  return (
    <div className="nx-app">
      <TopBar />
      <div className="nx-body">
        <DrawingToolbar />
        <div className="nx-body__main">
          <ChartStage />
        </div>
        <aside className="nx-side-panel">
          <PanelSection
            sectionKey="watchlist"
            title={SHELL_LABELS.watchlistSectionTitle}
            collapsed={isCollapsed('watchlist')}
            onToggle={() => toggleSection('watchlist')}
          >
            <WatchlistPanel />
          </PanelSection>
          <PanelSection
            sectionKey="objects"
            title={SHELL_LABELS.objectSectionTitle}
            collapsed={isCollapsed('objects')}
            onToggle={() => toggleSection('objects')}
          >
            <ObjectTreePanel />
          </PanelSection>
          <PanelSection
            sectionKey="indicators"
            title={SHELL_LABELS.indicatorSectionTitle}
            collapsed={isCollapsed('indicators')}
            onToggle={() => toggleSection('indicators')}
          >
            <IndicatorPanel />
          </PanelSection>
          <PanelSection
            sectionKey="templates"
            title={SHELL_LABELS.templateSectionTitle}
            collapsed={isCollapsed('templates')}
            onToggle={() => toggleSection('templates')}
          >
            <TemplatePanel />
          </PanelSection>
        </aside>
      </div>
      {shell.shortcutsVisible && <ShortcutsOverlay />}
    </div>
  )
}
