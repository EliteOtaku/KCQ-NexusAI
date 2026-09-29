// 编程式指标定义注册：外部宿主/插件 bundle 的注册入口（与 #272 registerToolHost
// /registerChartTool 同族）。

import { Type } from 'typebox'
import { describe, expect, it } from 'vitest'

import {
  clearRegisteredIndicatorDefinitionsForTest,
  getRegisteredIndicatorDefinitions,
  Indicator,
  registerIndicatorDefinition,
} from '../../engine/indicators/indicatorDefinitionRegistry.js'
import { allIndicators } from '../../engine/renderers/Indicator/indicatorCatalog.js'


describe('registerIndicatorDefinition (programmatic)', () => {
  it('registers an external definition visible via the catalog', () => {
    registerIndicatorDefinition(
      {
        name: 'sample_external_indicator',
        displayName: 'Sample External',
        kind: 'indicator',
        category: 'main',
        indicatorType: 'trend',
        defaultPaneId: 'main',
        mainPane: { rendererName: 'sample_external_renderer' },
      },
      () => ({}) as never,
    )

    const fromRegistry = getRegisteredIndicatorDefinitions().find(
      (d) => d.name === 'sample_external_indicator',
    )
    expect(fromRegistry).toBeDefined()
    expect(fromRegistry?.displayName).toBe('Sample External')
    expect(allIndicators().some((i) => i.id === 'Sample External')).toBe(true)
  })

  it('rejects duplicate registration of the same name', () => {
    const config = {
      name: 'dup_external_indicator',
      displayName: 'Dup External',
      kind: 'indicator',
      category: 'main',
      indicatorType: 'trend',
      defaultPaneId: 'main',
      mainPane: { rendererName: 'dup_renderer' },
    } as const
    registerIndicatorDefinition(config, () => ({}) as never)

    expect(() => registerIndicatorDefinition(config, () => ({}) as never)).toThrow(
      /already registered/,
    )
  })

  it('accepts params schema via definition config', () => {
    registerIndicatorDefinition(
      {
        name: 'sample_param_indicator',
        displayName: 'Sample Params',
        kind: 'indicator',
        category: 'main',
        indicatorType: 'trend',
        defaultPaneId: 'main',
        mainPane: { rendererName: 'sample_param_renderer' },
        ui: {
          params: [{ key: 'period', label: '周期', type: 'number', min: 1, max: 500, default: 14 }],
        },
      },
      () => ({}) as never,
    )

    const def = allIndicators().find((i) => i.id === 'Sample Params')
    expect(def?.params?.[0]?.key).toBe('period')
  })

  it('multiple programmatic definitions coexist in one registry', () => {
    expect(
      getRegisteredIndicatorDefinitions().some((d) => d.name === 'sample_external_indicator'),
    ).toBe(true)
    expect(
      getRegisteredIndicatorDefinitions().some((d) => d.name === 'sample_param_indicator'),
    ).toBe(true)
  })
})

void Type
void clearRegisteredIndicatorDefinitionsForTest
