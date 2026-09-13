// NexusAI Shell 与外部能力的端口定义：壳只依赖这些接口，具体实现由宿主注入。
// （绘图模板存储已由 shell/drawingTemplates.ts 落地 localStorage，端口待宿主后端化时再引入。）

/** 顶栏周期档位描述：值对齐 core KLinePeriod。 */
export interface PeriodDescriptor {
  value: string
  label: string
}
