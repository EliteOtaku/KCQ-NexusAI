<template>
  <div class="app-container" :data-theme="currentTheme">
    <DebugControls
      :custom-data-active="useCustomData"
      @open-modal="showModal = true"
      @toggle-embed-size="toggleEmbedSize"
      @toggle-custom-data="onToggleCustomData"
    />

    <!-- 嵌入场景：模拟组件库在父容器中的使用 -->
    <div
      ref="embedContainerRef"
      class="embed-container"
      :class="{ 'is-fullscreen': isFullscreen }"
      :style="{ width: embedWidth, height: embedHeight }"
    >
      <AgentWorkbenchShell :bridge="agentBridge" :panel-width-storage="webPanelWidthStorage">
        <template #chart>
          <KlineChart
            ref="chartRef"
            :left-axis-width="60"
            :custom-data="customData"
            @update:is-fullscreen="isFullscreen = $event"
            @theme-change="onThemeChange"
            @controller-ready="onControllerReady"
          >
            <!-- 自定义 Tooltip -->
            <!-- <template #kline-tooltip="{ hoverData, upColor, downColor }">
          <div class="custom-tooltip">
            <div class="custom-tooltip__title">
              <span>{{ hoverData.symbol }}</span>
              <span>{{ formatTimeInTimeZone(hoverData.timestamp, { timeZone: 'Asia/Shanghai', showTime: false }) }}</span>
            </div>
            <div class="custom-tooltip__price"
                :style="{ color: hoverData.close >= hoverData.open ? upColor : downColor }">
              {{ hoverData.close.toFixed(2) }}
            </div>
            <div class="custom-tooltip__detail">
              O: {{ hoverData.open.toFixed(2) }}<br> H: {{ hoverData.high.toFixed(2) }}<br>
              L: {{ hoverData.low.toFixed(2) }}<br> C: {{ hoverData.close.toFixed(2) }}
            </div>
          </div>
        </template> -->
          </KlineChart>
        </template>
      </AgentWorkbenchShell>
    </div>

    <!-- Modal 场景 -->
    <Teleport :to="teleportTarget">
      <Transition name="modal">
        <div v-if="showModal" class="modal-overlay" @click.self="showModal = false">
          <div class="modal-container">
            <header class="modal-header">
              <span>K线图 Modal 测试</span>
              <button class="close-btn" @click="showModal = false">×</button>
            </header>
            <div class="modal-body">
              <KlineChart @theme-change="onThemeChange" />
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
  import { ref, computed, provide, inject, onBeforeUnmount, type Ref, type InjectionKey } from 'vue'
  import DebugControls from './DebugControls.vue'
  import { useChartDocumentTitle } from './useChartDocumentTitle'
  import { AgentWorkbenchShell, createAgentPanelWidthStorage, KlineChart } from '../src/index'
  import { BrowserAgentBridge } from '../src/features/agent/browser-agent/bridge/impl/browser-agent-bridge'
  import {
    type KLineData,
    type CustomDataSource,
    type ChartController,
  } from '@363045841yyt/klinechart-core/controllers'
  import { formatTimeInTimeZone } from '@363045841yyt/klinechart-core'
  import type { RegisteredChartTool } from '@363045841yyt/klinechart-core'
  import { normalizeSettings } from '@363045841yyt/klinechart-core/config'

  /**
   * 外部渲染器注册契约（本地结构化声明）。
   *
   * 上游已退役 `RendererPlugin`，改为 `useRenderer(layer: Layer)`；core dist 尚未导出
   * `Layer` / `LayerPaint` 类型（import type 不可得），故与 fork 插件侧
   * `kcq-plugins/src/kcqCoreCompat.ts` 同法本地声明。插件导出为双形态对象：
   * `id/role/pane/z/paint`（新契约）与 `name/paneId/priority/draw`（旧契约）并存。
   */
  interface ExternalRendererLayer {
    readonly id?: string
    readonly name?: string
    readonly role?: string
    readonly pane?: string
    readonly paneId?: string
    readonly z?: number
    readonly priority?: number
    paint?(frame: unknown): void
    draw?(context: unknown): void
    dispose?(): void
    onUninstall?(): void
  }

  /** useRenderer 的入参类型：从 ChartController 签名提取，避免重复声明 Layer。 */
  type RendererLayerParam = Parameters<ChartController['useRenderer']>[0]

  /**
   * 旧契约（`name/paneId/priority/draw`）归一为新契约 Layer 字段。
   *
   * Scene 以 `layer.pane === paneId && layer.visible` 过滤候选层；旧契约对象没有
   * `pane`/`visible`，直接注册会被**静默丢弃**（异常隔离只捕获 paint 抛错，过滤阶段
   * 不报错），表现为「注册成功但永不绘制」。故此处按 kcqCoreCompat 记载的映射补齐：
   * `id=name`、`pane=paneId`、`z=priority`、`paint=draw`、`dispose=onUninstall`。
   * 已是新契约的对象原样透传（不复制，保留其自有 dispose 身份）。
   */
  function normalizeExternalRenderer(plugin: ExternalRendererLayer): RendererLayerParam {
    if (typeof plugin.paint === 'function' && typeof plugin.pane === 'string') {
      return plugin as unknown as RendererLayerParam
    }
    const draw = plugin.paint ?? plugin.draw
    const source = plugin as unknown as Record<string, unknown>
    const normalized: Record<string, unknown> = {
      ...source,
      id: plugin.id ?? plugin.name ?? 'external_renderer',
      role: plugin.role ?? 'overlay',
      pane: plugin.pane ?? plugin.paneId ?? 'main',
      z: plugin.z ?? plugin.priority ?? 0,
      // 旧契约未声明 visible；Scene 要求显式 true 才会绘制。
      visible: source.visible ?? true,
      paint: (frame: unknown) => draw?.call(plugin, frame),
    }
    if (normalized.dispose === undefined && typeof plugin.onUninstall === 'function') {
      normalized.dispose = () => plugin.onUninstall?.()
    }
    return normalized as unknown as RendererLayerParam
  }

  /** 硬编码演示数据：主品种 CUSTOM.DEMO（15 根日 K） */
  const DEMO_MAIN_DATA: KLineData[] = [
    {
      timestamp: 1748736000000,
      date: '2025-06-01',
      open: 30.0,
      high: 32.0,
      low: 30.0,
      close: 31.5,
      volume: 1500000,
    },
    {
      timestamp: 1748822400000,
      date: '2025-06-02',
      open: 31.5,
      high: 33.2,
      low: 31.2,
      close: 33.0,
      volume: 2100000,
    },
    {
      timestamp: 1748908800000,
      date: '2025-06-03',
      open: 33.0,
      high: 33.5,
      low: 31.8,
      close: 32.1,
      volume: 1800000,
    },
    {
      timestamp: 1748995200000,
      date: '2025-06-04',
      open: 32.1,
      high: 32.8,
      low: 31.0,
      close: 31.2,
      volume: 1200000,
    },
    {
      timestamp: 1749081600000,
      date: '2025-06-05',
      open: 31.2,
      high: 31.5,
      low: 29.8,
      close: 30.0,
      volume: 900000,
    },
    {
      timestamp: 1749168000000,
      date: '2025-06-06',
      open: 30.0,
      high: 31.0,
      low: 29.5,
      close: 30.8,
      volume: 1350000,
    },
    {
      timestamp: 1749254400000,
      date: '2025-06-07',
      open: 30.8,
      high: 32.4,
      low: 30.6,
      close: 32.2,
      volume: 1700000,
    },
    {
      timestamp: 1749340800000,
      date: '2025-06-08',
      open: 32.2,
      high: 34.0,
      low: 32.0,
      close: 33.8,
      volume: 2200000,
    },
    {
      timestamp: 1749427200000,
      date: '2025-06-09',
      open: 33.8,
      high: 35.5,
      low: 33.5,
      close: 35.0,
      volume: 2600000,
    },
    {
      timestamp: 1749513600000,
      date: '2025-06-10',
      open: 35.0,
      high: 35.2,
      low: 33.6,
      close: 33.8,
      volume: 1900000,
    },
    {
      timestamp: 1749600000000,
      date: '2025-06-11',
      open: 33.8,
      high: 34.5,
      low: 33.0,
      close: 34.2,
      volume: 1550000,
    },
    {
      timestamp: 1749686400000,
      date: '2025-06-12',
      open: 34.2,
      high: 36.0,
      low: 34.0,
      close: 35.6,
      volume: 2400000,
    },
    {
      timestamp: 1749772800000,
      date: '2025-06-13',
      open: 35.6,
      high: 36.5,
      low: 35.0,
      close: 36.2,
      volume: 2800000,
    },
    {
      timestamp: 1749859200000,
      date: '2025-06-14',
      open: 36.2,
      high: 36.8,
      low: 35.2,
      close: 35.5,
      volume: 2000000,
    },
    {
      timestamp: 1749945600000,
      date: '2025-06-15',
      open: 35.5,
      high: 36.0,
      low: 34.5,
      close: 35.8,
      volume: 1600000,
    },
  ].map((bar, index) => ({
    ...bar,
    strategySignal: index % 3 === 0 ? 'BUY' : index % 3 === 1 ? 'HOLD' : 'WATCH',
    confidence: 72 + ((index * 7) % 24),
  }))

  /** 硬编码演示数据：对比商品 COMP.A（15 根日 K，偏弱走势） */
  const DEMO_COMP_A_DATA: KLineData[] = [
    {
      timestamp: 1748736000000,
      date: '2025-06-01',
      open: 28.0,
      high: 29.5,
      low: 27.8,
      close: 29.0,
      volume: 800000,
    },
    {
      timestamp: 1748822400000,
      date: '2025-06-02',
      open: 29.0,
      high: 29.2,
      low: 27.5,
      close: 27.8,
      volume: 950000,
    },
    {
      timestamp: 1748908800000,
      date: '2025-06-03',
      open: 27.8,
      high: 28.5,
      low: 26.8,
      close: 27.0,
      volume: 720000,
    },
    {
      timestamp: 1748995200000,
      date: '2025-06-04',
      open: 27.0,
      high: 27.2,
      low: 25.5,
      close: 25.8,
      volume: 1100000,
    },
    {
      timestamp: 1749081600000,
      date: '2025-06-05',
      open: 25.8,
      high: 26.5,
      low: 25.0,
      close: 25.2,
      volume: 680000,
    },
    {
      timestamp: 1749168000000,
      date: '2025-06-06',
      open: 25.2,
      high: 26.0,
      low: 24.8,
      close: 25.6,
      volume: 840000,
    },
    {
      timestamp: 1749254400000,
      date: '2025-06-07',
      open: 25.6,
      high: 26.8,
      low: 25.4,
      close: 26.5,
      volume: 920000,
    },
    {
      timestamp: 1749340800000,
      date: '2025-06-08',
      open: 26.5,
      high: 27.5,
      low: 26.2,
      close: 27.3,
      volume: 1050000,
    },
    {
      timestamp: 1749427200000,
      date: '2025-06-09',
      open: 27.3,
      high: 28.0,
      low: 26.8,
      close: 27.0,
      volume: 780000,
    },
    {
      timestamp: 1749513600000,
      date: '2025-06-10',
      open: 27.0,
      high: 27.2,
      low: 25.8,
      close: 26.1,
      volume: 890000,
    },
    {
      timestamp: 1749600000000,
      date: '2025-06-11',
      open: 26.1,
      high: 26.5,
      low: 25.0,
      close: 25.2,
      volume: 760000,
    },
    {
      timestamp: 1749686400000,
      date: '2025-06-12',
      open: 25.2,
      high: 25.8,
      low: 24.0,
      close: 24.5,
      volume: 1300000,
    },
    {
      timestamp: 1749772800000,
      date: '2025-06-13',
      open: 24.5,
      high: 25.6,
      low: 24.2,
      close: 25.4,
      volume: 960000,
    },
    {
      timestamp: 1749859200000,
      date: '2025-06-14',
      open: 25.4,
      high: 26.5,
      low: 25.0,
      close: 26.2,
      volume: 1120000,
    },
    {
      timestamp: 1749945600000,
      date: '2025-06-15',
      open: 26.2,
      high: 27.0,
      low: 25.8,
      close: 26.8,
      volume: 840000,
    },
  ]

  /** 硬编码演示数据：对比商品 COMP.B（15 根日 K，偏强走势） */
  const DEMO_COMP_B_DATA: KLineData[] = [
    {
      timestamp: 1748736000000,
      date: '2025-06-01',
      open: 35.0,
      high: 36.5,
      low: 34.8,
      close: 36.0,
      volume: 1800000,
    },
    {
      timestamp: 1748822400000,
      date: '2025-06-02',
      open: 36.0,
      high: 37.2,
      low: 35.5,
      close: 37.0,
      volume: 2200000,
    },
    {
      timestamp: 1748908800000,
      date: '2025-06-03',
      open: 37.0,
      high: 38.0,
      low: 36.2,
      close: 36.5,
      volume: 1950000,
    },
    {
      timestamp: 1748995200000,
      date: '2025-06-04',
      open: 36.5,
      high: 37.5,
      low: 35.8,
      close: 37.2,
      volume: 1650000,
    },
    {
      timestamp: 1749081600000,
      date: '2025-06-05',
      open: 37.2,
      high: 39.0,
      low: 37.0,
      close: 38.5,
      volume: 2500000,
    },
    {
      timestamp: 1749168000000,
      date: '2025-06-06',
      open: 38.5,
      high: 40.0,
      low: 38.2,
      close: 39.8,
      volume: 2800000,
    },
    {
      timestamp: 1749254400000,
      date: '2025-06-07',
      open: 39.8,
      high: 41.5,
      low: 39.5,
      close: 41.0,
      volume: 3100000,
    },
    {
      timestamp: 1749340800000,
      date: '2025-06-08',
      open: 41.0,
      high: 41.2,
      low: 39.0,
      close: 39.5,
      volume: 2400000,
    },
    {
      timestamp: 1749427200000,
      date: '2025-06-09',
      open: 39.5,
      high: 40.0,
      low: 38.0,
      close: 38.5,
      volume: 2100000,
    },
    {
      timestamp: 1749513600000,
      date: '2025-06-10',
      open: 38.5,
      high: 39.5,
      low: 37.5,
      close: 39.0,
      volume: 1750000,
    },
    {
      timestamp: 1749600000000,
      date: '2025-06-11',
      open: 39.0,
      high: 40.8,
      low: 38.5,
      close: 40.5,
      volume: 2300000,
    },
    {
      timestamp: 1749686400000,
      date: '2025-06-12',
      open: 40.5,
      high: 42.0,
      low: 40.0,
      close: 41.5,
      volume: 2900000,
    },
    {
      timestamp: 1749772800000,
      date: '2025-06-13',
      open: 41.5,
      high: 43.5,
      low: 41.0,
      close: 43.0,
      volume: 3400000,
    },
    {
      timestamp: 1749859200000,
      date: '2025-06-14',
      open: 43.0,
      high: 43.5,
      low: 41.5,
      close: 42.0,
      volume: 2600000,
    },
    {
      timestamp: 1749945600000,
      date: '2025-06-15',
      open: 42.0,
      high: 42.5,
      low: 40.5,
      close: 41.2,
      volume: 1900000,
    },
  ]

  const FULLSCREEN_TARGET_KEY: InjectionKey<Ref<HTMLElement | null>> = Symbol(
    'fullscreen-teleport-target',
  )

  function provideFullscreenTeleportTarget(targetRef: Ref<HTMLElement | null>): void {
    provide(FULLSCREEN_TARGET_KEY, targetRef)
  }

  function useFullscreenTeleportTarget() {
    const targetRef = inject(FULLSCREEN_TARGET_KEY, null)
    return computed<HTMLElement | string>(() => {
      return targetRef?.value ?? 'body'
    })
  }

  const chartRef = ref<InstanceType<typeof KlineChart> | null>(null)
  // 外部插件声明的 Agent 工具（loader 契约：模块可带 chartTools 工厂导出）；
  // bridge 先构造、插件后加载，经 getter 包装引用即可
  const externalChartTools: Ref<RegisteredChartTool[]> = ref([])
  const agentBridge = new BrowserAgentBridge({
    getChartAgent: () => chartRef.value?.getController?.()?.agent,
    extraChartTools: () => externalChartTools.value,
  })
  onBeforeUnmount(() => agentBridge.close())
  const webPanelWidthStorage = createAgentPanelWidthStorage()
  const showModal = ref(false)

  const sizeIndex = ref(0)
  const sizes = [
    { w: '100%', h: '100%' },
    { w: '800px', h: '500px' },
    { w: '600px', h: '400px' },
    { w: '100%', h: '300px' },
  ]

  const embedWidth = computed(() => sizes[sizeIndex.value]?.w ?? '100%')
  const embedHeight = computed(() => sizes[sizeIndex.value]?.h ?? '100%')

  function toggleEmbedSize() {
    sizeIndex.value = (sizeIndex.value + 1) % sizes.length
  }

  const isFullscreen = ref(false)
  const embedContainerRef = ref<HTMLElement | null>(null)

  // 初始主题取默认值，控制器就绪后跟随活动布局的有效主题。
  const themePreference = normalizeSettings().theme
  const currentTheme = ref<'light' | 'dark'>(
    themePreference === 'auto'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light'
      : (themePreference as 'light' | 'dark'),
  )

  /** 主品种 → 浏览器 Tab 标题同步器，控制器就绪时绑定。 */
  const { bind: bindDocumentTitle } = useChartDocumentTitle()

  function onThemeChange(theme: 'light' | 'dark') {
    currentTheme.value = theme
  }

  /** 控制器就绪后用内部解析出的有效主题初始化外壳主题。 */
  function onControllerReady(controller: ChartController) {
    agentBridge.bindChartAgent(controller.agent)
    currentTheme.value = controller.theme.peek()
    bindDocumentTitle(controller)
    void loadExternalRenderers(controller)
  }

  // ── 外部渲染器插件加载点 ──
  // 宿主声明外部渲染器插件模块 URL 列表（站点内路径或 http/https）：
  //   1) localStorage['kcq_external_renderers'] = JSON 数组
  //   2) URL 查询参数 ?externalRenderers=url1,url2
  // 模块契约：default / renderers / renderer 命名导出渲染器（新契约 Layer 或
  // 旧契约 RendererPlugin 双形态，见上方 ExternalRendererLayer）或其数组。
  // 动态 import 加载；单模块失败仅告警，不影响工作台与其它插件（互相隔离）。
  // Demo：?externalRenderers=/external-demo-renderer.js（preview/public 原样服务）。
  async function loadExternalRenderers(controller: ChartController) {
    const sources: string[] = []
    try {
      const raw = localStorage.getItem('kcq_external_renderers')
      if (raw) {
        const parsed: unknown = JSON.parse(raw)
        if (Array.isArray(parsed)) {
          sources.push(...parsed.filter((s): s is string => typeof s === 'string' && s.length > 0))
        }
      }
    } catch {
      // 声明无效时忽略，仅用查询参数
    }
    const fromQuery = new URLSearchParams(window.location.search).get('externalRenderers')
    if (fromQuery) {
      for (const item of fromQuery.split(',')) {
        const trimmed = item.trim()
        if (trimmed) sources.push(trimmed)
      }
    }
    for (const url of sources) {
      try {
        // 归一为绝对 URL：dev 管线只放行外部协议的动态 import（相对路径会被
        // 重写 ?import 进模块图，public/ 资产不在图内而 404）
        const href = /^https?:\/\//i.test(url) ? url : new URL(url, window.location.href).href
        const mod: Record<string, unknown> = await import(/* @vite-ignore */ href)
        let exported = mod.default ?? mod.renderers ?? mod.renderer
        // 工厂形态：default 为 (host: { controller, agent }) => 渲染器 | 渲染器[]
        // （新契约 Layer 或旧契约 RendererPlugin 双形态），供插件读取品种（controller.symbols）/订阅信号等宿主能力。
        // agent = 事件→Agent 通知的最小窄面（下游 app 壳自有代码，同 #266 99a2a23a
        // 形态；startRun 触发一轮模型运行——readOnly 语义由调用方经入参控制，
        // listSessions 供插件解析目标会话；刻意不暴露整个 bridge，会话/Provider
        // 管理面不外放）。
        if (typeof exported === 'function') {
          exported = (exported as (host: Record<string, unknown>) => unknown)({
            controller,
            agent: {
              startRun: (input: { sessionId: string; prompt: string; readOnly: boolean }) =>
                agentBridge.startRun(input),
              listSessions: () => agentBridge.listSessions(),
            },
          })
        }
        const list = Array.isArray(exported) ? exported : exported ? [exported] : []
        for (const item of list) {
          const plugin = item as ExternalRendererLayer | undefined
          // 双形态判定：新契约以 id/paint 标识，旧契约以 name/draw 标识。
          const isNew = typeof plugin?.id === 'string' && typeof plugin?.paint === 'function'
          const isLegacy = typeof plugin?.name === 'string' && typeof plugin?.draw === 'function'
          if (plugin && (isNew || isLegacy)) {
            // useRenderer 现接收 Layer<RenderContext>；core dist 未导出该类型，
            // 故按参数位取类型转交。旧契约先归一为新契约字段，否则会被 Scene
            // 的 pane/visible 过滤静默丢弃（注册成功但不绘制）。
            controller.useRenderer(normalizeExternalRenderer(plugin))
            console.info(
              `[preview] external renderer registered: ${plugin.id ?? plugin.name} (${url})`,
            )
          } else {
            console.warn(`[preview] external renderer module has no valid renderer export: ${url}`)
          }
        }
        // Agent 工具契约（两形态）：①工厂返回值带 chartTools 属性；②模块命名导出 chartTools
        const chartToolsExport = (Array.isArray(exported) && (exported as { chartTools?: unknown }).chartTools)
          ?? mod.chartTools
        if (Array.isArray(chartToolsExport) && chartToolsExport.length) {
          const incoming = chartToolsExport as RegisteredChartTool[]
          externalChartTools.value = [...externalChartTools.value, ...incoming]
          // 构造时快照已错过插件加载：后补注册立即进目录（本会话即可被调用）
          agentBridge.registerExternalChartTools(incoming)
          console.info(`[preview] external agent tools registered: ${incoming.map((t) => t.config?.name).join(', ')} (${url})`)
        }
      } catch (error) {
        console.warn(`[preview] external renderer load failed: ${url}`, error)
      }
    }
  }

  provideFullscreenTeleportTarget(embedContainerRef)

  const teleportTarget = computed<HTMLElement | string>(() => embedContainerRef.value ?? 'body')

  // ── 自定义数据源 Demo ──
  const useCustomData = ref(false)
  const customData = ref<CustomDataSource>()

  function onToggleCustomData() {
    useCustomData.value = !useCustomData.value
    if (useCustomData.value) {
      customData.value = {
        symbol: 'CUSTOM.DEMO',
        market: 'CN',
        period: 'daily',
        data: DEMO_MAIN_DATA,
        comparisons: {
          'COMP.A': DEMO_COMP_A_DATA,
          'COMP.B': DEMO_COMP_B_DATA,
        },
      }
    } else {
      customData.value = undefined
    }
  }
</script>

<style>
  .app-container {
    width: 100%;
    height: 100dvh;
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .embed-container {
    width: 95%;
    flex: 1;
    min-height: 0;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
    --kmap-chart-height: 100%;
    --kmap-chart-width: 100%;
  }

  .embed-container:fullscreen,
  .embed-container.is-fullscreen {
    border: none;
    margin: 0;
    width: 100vw !important;
    height: 100dvh !important;
    background: #fff;
  }

  .modal-overlay {
    position: fixed;
    inset: 0;
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(4px);
  }

  .modal-container {
    width: 90%;
    height: 80%;
    max-width: 1200px;
    display: flex;
    flex-direction: column;
    background: #fff;
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 20px;
    background: #fafafa;
    border-bottom: 1px solid #e8e8e8;
    font-weight: 600;
  }

  .close-btn {
    width: 32px;
    height: 32px;
    border: none;
    background: transparent;
    font-size: 24px;
    cursor: pointer;
    border-radius: 4px;
    color: #666;
  }

  .close-btn:hover {
    background: #f0f0f0;
    color: #333;
  }

  .modal-body {
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }

  .modal-enter-active,
  .modal-leave-active {
    transition: opacity 0.3s ease;
  }

  .modal-enter-active .modal-container,
  .modal-leave-active .modal-container {
    transition:
      transform 0.3s ease,
      opacity 0.3s ease;
  }

  .modal-enter-from,
  .modal-leave-to {
    opacity: 0;
  }

  .modal-enter-from .modal-container,
  .modal-leave-to .modal-container {
    transform: scale(0.95) translateY(20px);
    opacity: 0;
  }

  /* ── 深色模式 ── */
  .app-container[data-theme='dark'] {
    background: #000000;
    color: #e5e7eb;
  }

  .app-container[data-theme='dark'] .embed-container {
    border-color: #374151;
  }

  .app-container[data-theme='dark'] .embed-container:fullscreen,
  .app-container[data-theme='dark'] .embed-container.is-fullscreen {
    background: #000000;
  }

  .app-container[data-theme='dark'] .modal-container {
    background: #1f2937;
  }

  .app-container[data-theme='dark'] .modal-header {
    background: #374151;
    border-color: #4b5563;
    color: #e5e7eb;
  }

  .app-container[data-theme='dark'] .close-btn {
    color: #9ca3af;
  }

  .app-container[data-theme='dark'] .close-btn:hover {
    background: #4b5563;
    color: #f3f4f6;
  }

  .custom-tooltip {
    padding: 8px 12px;
    border-radius: 8px;
    background: rgba(30, 30, 30, 0.92);
    border: 1px solid rgba(255, 255, 255, 0.15);
    color: #fff;
    font-size: 12px;
    line-height: 1.5;
    backdrop-filter: blur(6px);
    pointer-events: none;
  }

  .my-legend {
    display: flex;
    flex-direction: column;
    gap: 2px;
    max-width: min(760px, calc(100vw - 96px));
    font-variant-numeric: tabular-nums;
    line-height: 18px;
  }

  .my-legend__row {
    display: flex;
    flex-wrap: wrap;
    gap: 0 10px;
    align-items: center;
  }

  .my-legend__dot {
    align-self: center;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex: none;
    margin-right: -6px;
  }

  .my-legend__signal {
    color: #f59e0b;
    font-weight: 600;
  }

  .custom-tooltip__title {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    font-weight: 600;
    margin-bottom: 4px;
  }

  .custom-tooltip__price {
    font-size: 18px;
    font-weight: 700;
    margin-bottom: 4px;
  }

  .custom-tooltip__detail {
    opacity: 0.7;
  }
</style>
