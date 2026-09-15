// NexusAI Shell 界面文案集中定义：组件内禁止散落字符串字面量。
// 工具条工具名属工具目录数据（drawingTools.ts），不在此重复。

export const SHELL_LABELS = {
  brand: 'NexusAI',
  symbolPlaceholder: '品种',
  themeLight: '亮色',
  themeDark: '暗色',
  drawingSectionTitle: '绘图',
  indicatorSectionTitle: '指标',
  templateSectionTitle: '模板',
  templateApply: '套用',
  templateSave: '保存',
  templateEmpty: '暂无模板',
  indicatorEmpty: '暂无指标',

  // ── 左工具条 ──
  toolFavoritesTitle: '收藏工具',
  magnetOff: '磁吸：关闭',
  magnetWeak: '磁吸：弱',
  magnetStrong: '磁吸：强',
  stayModeTitle: '保持绘图模式',
  stayModeActive: '保持绘图模式：开',
  zoomInTitle: '放大',
  zoomOutTitle: '缩小',
  favoriteToggle: '收藏',
  unfavoriteToggle: '取消收藏',

  // ── 属性浮条 ──
  flybarColorTitle: '颜色',
  flybarMixedColor: '多色',
  flybarWidthTitle: '线宽',
  flybarStyleTitle: '线型',
  flybarFillTitle: '填充',
  flybarFillOpacityTitle: '填充不透明度',
  flybarLockTitle: '锁定',
  flybarUnlockTitle: '解锁',
  flybarDeleteTitle: '删除',
  flybarTemplateTitle: '模板',
  flybarTemplateSave: '保存为模板',
  flybarSelectedCount: (count: number) => `已选 ${count}`,
  flybarMixedValue: '混合',
  strokeSolid: '实线',
  strokeDashed: '虚线',
  strokeDotted: '点线',

  // ── 模板面板 ──
  templateAutoApply: '下次绘制自动套用',
  templateRename: '重命名',
  templateRemove: '删除',
  templateRenameConfirm: '确定',
  templateRenameCancel: '取消',
  templateSaveTitle: '保存为模板',
  templateNamePlaceholder: '模板名称',
  templateSaveConfirm: '保存',
  templateCancel: '取消',
  templateNameRequired: '请输入模板名称',

  // ── 测量浮层 ──
  measureBars: (count: number) => `${count} 根K线`,

  // ── 周期 ──
  periodLabel: '周期',

  // ── 品种搜索器 ──
  symbolSearchTitle: '品种搜索',
  symbolSearchPlaceholder: '搜索品种代码或名称…',
  symbolRecentGroup: '最近使用',
  symbolAllGroup: '全部品种',
  symbolNoResults: '无匹配品种',
  symbolSearchLoading: '搜索中…',
  symbolSearchFailed: '搜索失败，请检查 MT5 连接器',

  // ── 图例栏 ──
  legendOhlcOpen: 'O',
  legendOhlcHigh: 'H',
  legendOhlcLow: 'L',
  legendOhlcClose: 'C',
  legendVolumeLabel: '量',
  legendEyeHide: '隐藏指标',
  legendEyeShow: '显示指标',
  legendSettingsTitle: '指标参数',
  legendDeleteTitle: '删除指标',
  legendParamsConfirm: '确定',

  // ── 图表右键菜单 ──
  ctxStyleTitle: '样式',
  ctxLockTitle: '锁定',
  ctxUnlockTitle: '解锁',
  ctxDeleteTitle: '删除',
  ctxThemeTitle: '切换主题',
  ctxPeriodTitle: '周期',
  ctxAddIndicatorTitle: '添加指标',

  // ── 右栏面板 ──
  watchlistSectionTitle: '自选',
  objectSectionTitle: '对象树',
  objectShowTitle: '显示',
  objectHideTitle: '隐藏',
  objectEmpty: '暂无图元',

  // ── 设置对话框 ──
  settingsTitle: '设置',
  settingsThemeLabel: '主题',
  settingsThemeDark: '暗色',
  settingsThemeLight: '亮色',
  settingsSourceLabel: '数据源',
  settingsSourceMock: 'Mock',
  settingsSourceMt5: 'MT5 (Exness)',
  settingsSourceMt5Unavailable: 'MT5 不可达（连接器未启动或终端未登录），已保持 Mock',
  settingsSourceMt5Fallback: 'MT5 连接中断，已回退 Mock',
  settingsMagnetLabel: '磁吸',
  settingsMagnetOff: '关闭',
  settingsMagnetWeak: '弱',
  settingsMagnetStrong: '强',
  settingsStayLabel: '画完保持绘图工具',
  settingsAutoApplyLabel: '新绘制自动套用模板',
  settingsClose: '关闭',
  shortcutsTitle: '快捷键',
} as const
