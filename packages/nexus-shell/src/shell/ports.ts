// NexusAI Shell 与外部能力的端口定义：壳只依赖这些接口，具体实现由宿主注入。
// 通用绘图模板存储端口：与 vue 包 KLineChart 的 drawingTemplateStore prop 同构，
// 壳层实现可路由到 localStorage 或宿主后端（本脚手架尚未接线）。

import type { DrawingStyle } from '@363045841yyt/klinechart-core/plugin'

export interface DrawingTemplateRecord {
  name: string
  tool: string
}

export interface DrawingTemplateStore {
  list(): Promise<ReadonlyArray<DrawingTemplateRecord>>
  load(tool: string, name: string): Promise<Partial<DrawingStyle> | null>
  save(tool: string, name: string, style: Partial<DrawingStyle>): Promise<void>
  remove(tool: string, name: string): Promise<void>
}

/** 绘图工具描述：图标以文字占位，后续接 unplugin-icons。 */
export interface DrawingToolDescriptor {
  id: string
  icon: string
  label: string
}

/** 顶栏周期档位描述：值对齐 core KLinePeriod。 */
export interface PeriodDescriptor {
  value: string
  label: string
}
