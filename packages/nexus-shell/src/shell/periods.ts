// 周期目录：TopBar 分组下拉、图例周期显示、批4 数字键快捷切换共用此唯一定义。
// 值对齐 core KLinePeriod，4h 为 fork 补丁能力。

/** 周期分组：分钟 / 小时 / 日周月。 */
export const PERIOD_GROUPS: ReadonlyArray<{
  label: string
  items: ReadonlyArray<{ value: string; label: string }>
}> = [
  {
    label: '分钟',
    items: [
      { value: '1min', label: '1分' },
      { value: '5min', label: '5分' },
      { value: '15min', label: '15分' },
      { value: '30min', label: '30分' },
    ],
  },
  {
    label: '小时',
    items: [
      { value: '60min', label: '1小时' },
      { value: '4h', label: '4小时' },
    ],
  },
  {
    label: '日周月',
    items: [
      { value: 'daily', label: '日线' },
      { value: 'weekly', label: '周线' },
      { value: 'monthly', label: '月线' },
    ],
  },
]

/** 全部周期条目的扁平清单（快捷键映射用）。 */
export const ALL_PERIODS: ReadonlyArray<{ value: string; label: string }> = PERIOD_GROUPS.flatMap(
  (group) => group.items,
)

/** 周期值 → 显示名；未知值原样返回。 */
export function periodLabel(value: string): string {
  return ALL_PERIODS.find((item) => item.value === value)?.label ?? value
}
