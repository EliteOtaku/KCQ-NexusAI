// 图表舞台：经 react 适配器挂载引擎 Web Component。
// 数据接线（宿主 datafeed / 数据源注册）为后续里程碑，当前仅挂载元素占位。

import { KLineChartWC } from '@363045841yyt/klinechart-react'

/** 图表区骨架：铺满剩余空间，元素注册由适配器内部延迟完成。 */
export function ChartStage() {
  return (
    <div className="nx-chart-stage">
      <KLineChartWC />
    </div>
  )
}
