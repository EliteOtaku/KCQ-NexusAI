// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createCanvasGetContextMock,
  ResizeObserverMock,
  stubAnimationFrame,
} from '@/engine/__tests__/helpers/chartDomTestKit'

import { loadBuiltinIndicators } from '../../engine/indicators/registerBuiltins'
import type { RendererPlugin } from '../../foundation/plugin/types'
import { createChartController } from '../createChartController'
import type { KLineData } from '../types'

function createBars(length = 30): KLineData[] {
  return Array.from({ length }, (_, index) => ({
    timestamp: (index + 1) * 60_000,
    open: index + 1,
    high: index + 2,
    low: index,
    close: index + 1,
    volume: 100,
  }))
}

function createStubPlugin(name: string): RendererPlugin {
  return {
    name,
    version: '1.0.0',
    debugName: 'StubRenderer',
    paneId: 'main',
    priority: 9999,
    draw: () => {},
  }
}

async function mountController() {
  const container = document.createElement('div')
  Object.defineProperty(container, 'clientWidth', { value: 800, configurable: true })
  Object.defineProperty(container, 'clientHeight', { value: 600, configurable: true })
  document.body.appendChild(container)
  const ctrl = await createChartController({ container, data: createBars() })
  return {
    ctrl,
    cleanup: () => {
      ctrl.dispose()
      container.remove()
    },
  }
}

describe('createChartController renderer plugin registration', () => {
  beforeAll(async () => {
    await loadBuiltinIndicators()
  })

  beforeEach(() => {
    vi.stubGlobal('ResizeObserver', ResizeObserverMock)
    stubAnimationFrame()
    HTMLCanvasElement.prototype.getContext = createCanvasGetContextMock()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('useRenderer registers and getRenderer returns the same plugin instance', async () => {
    const { ctrl, cleanup } = await mountController()
    const plugin = createStubPlugin('test_overlay')

    ctrl.useRenderer(plugin)

    expect(ctrl.getRenderer('test_overlay')).toBe(plugin)
    cleanup()
  })

  it('useRenderer is idempotent by name (existing instance is kept)', async () => {
    const { ctrl, cleanup } = await mountController()
    const first = createStubPlugin('dup_overlay')
    const second = createStubPlugin('dup_overlay')

    ctrl.useRenderer(first)
    ctrl.useRenderer(second)

    expect(ctrl.getRenderer('dup_overlay')).toBe(first)
    cleanup()
  })

  it('removeRenderer unregisters the plugin by name', async () => {
    const { ctrl, cleanup } = await mountController()

    ctrl.useRenderer(createStubPlugin('removable'))
    ctrl.removeRenderer('removable')

    expect(ctrl.getRenderer('removable')).toBeUndefined()
    cleanup()
  })

  it('scheduleDraw requests a redraw without throwing', async () => {
    const { ctrl, cleanup } = await mountController()

    expect(() => ctrl.scheduleDraw()).not.toThrow()
    ctrl.useRenderer(createStubPlugin('scheduled'))
    expect(() => ctrl.scheduleDraw()).not.toThrow()
    cleanup()
  })
})
