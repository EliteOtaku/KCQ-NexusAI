// nexus.* localStorage 键空间统一入口：所有持久化必须引用此处键名常量，
// 禁止在组件里散落字符串键。服务端化时只需替换本模块实现。

/** 壳层持久化键名约定（docs/action-checklist.md 批4 条目同步维护）。 */
export const STORAGE_KEYS = {
  /** 收藏的绘图工具 id 列表。 */
  favorites: 'nexus.shell.drawing-favorites',
  /** 绘图模板库：{ [kind]: { [name]: Partial<DrawingStyle> } }。 */
  templates: 'nexus.drawing-templates',
  /** 各 kind 最近使用的模板名：{ [kind]: name }。 */
  lastTemplates: 'nexus.shell.last-templates',
  /** 壳偏好：磁吸/stay/自动套模板/各组最近使用的工具。 */
  prefs: 'nexus.shell.prefs',
  /** 最近使用的品种（批2 消费）。 */
  recentSymbols: 'nexus.shell.recent-symbols',
  /** 主题（'light' | 'dark'，B4-05 持久化）。 */
  theme: 'nexus.theme',
  /** 右栏分区折叠状态（B4-05 持久化）。 */
  panel: 'nexus.panel',
  /** 当前数据源（'mock' | 'mt5'）。 */
  dataSource: 'nexus.shell.data-source',
  /** MT5 模式最近使用的品种描述（InstrumentDescriptor JSON 数组）。 */
  recentMt5Instruments: 'nexus.shell.recent-mt5-instruments',
} as const

/** 读取 JSON；解析失败或键不存在时返回 fallback，不向上抛错。 */
export function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (raw === null) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

/** 写入 JSON；配额溢出等异常吞掉（持久化失败不阻塞交互）。 */
export function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* quota exceeded — 忽略 */
  }
}
