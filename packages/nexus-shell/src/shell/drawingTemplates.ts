// 绘图模板库：localStorage（nexus.drawing-templates）存储 + 最近使用记忆。
// 行为对齐 Vue 版模板系统（useDrawingTemplates.ts），键空间按 fork 规约走 nexus.*。

import type { DrawingStyle } from '@363045841yyt/klinechart-core/plugin'
import { readJson, STORAGE_KEYS, writeJson } from './storage'

/** 模板清单条目。 */
export interface DrawingTemplateRecord {
  name: string
  kind: string
}

/** 模板库持久化形状：kind → name → 样式片段。 */
type TemplateStoreShape = Record<string, Record<string, Partial<DrawingStyle>>>

/** “各 kind 最近使用的模板名”持久化形状（自动套用数据源）。 */
type LastUsedShape = Record<string, string>

function readStore(): TemplateStoreShape {
  return readJson<TemplateStoreShape>(STORAGE_KEYS.templates, {})
}

function writeStore(store: TemplateStoreShape): void {
  writeJson(STORAGE_KEYS.templates, store)
}

/** 列出全部模板（kind+name 升序）。 */
export function listTemplates(): ReadonlyArray<DrawingTemplateRecord> {
  const store = readStore()
  const items: DrawingTemplateRecord[] = []
  for (const [kind, templates] of Object.entries(store)) {
    for (const name of Object.keys(templates)) items.push({ kind, name })
  }
  return items.sort((a, b) => a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name))
}

/** 读取指定模板；不存在返回 null。 */
export function loadTemplate(kind: string, name: string): Partial<DrawingStyle> | null {
  return readStore()[kind]?.[name] ?? null
}

/** 保存（覆盖同名）模板。 */
export function saveTemplate(kind: string, name: string, style: Partial<DrawingStyle>): void {
  const store = readStore()
  const group = store[kind] ?? {}
  group[name] = style
  store[kind] = group
  writeStore(store)
}

/** 重命名模板（同名冲突时覆盖）。 */
export function renameTemplate(kind: string, name: string, nextName: string): void {
  const store = readStore()
  const group = store[kind]
  const style = group?.[name]
  if (!group || style === undefined) return
  delete group[name]
  group[nextName] = style
  writeStore(store)
}

/** 删除模板。 */
export function removeTemplate(kind: string, name: string): void {
  const store = readStore()
  if (!store[kind]) return
  delete store[kind][name]
  if (Object.keys(store[kind]).length === 0) delete store[kind]
  writeStore(store)
}

/** 读取某 kind 最近使用的模板样式（自动套用数据源）。 */
export function loadLastUsedTemplate(kind: string): Partial<DrawingStyle> | null {
  const lastUsed = readJson<LastUsedShape>(STORAGE_KEYS.lastTemplates, {})
  const name = lastUsed[kind]
  if (!name) return null
  return loadTemplate(kind, name)
}

/** 读取某 kind 最近使用的模板名（空字符串表示无）。 */
export function loadLastUsedTemplateName(kind: string): string {
  return readJson<LastUsedShape>(STORAGE_KEYS.lastTemplates, {})[kind] ?? ''
}

/** 记录某 kind 最近使用的模板名。 */
export function markTemplateUsed(kind: string, name: string): void {
  const lastUsed = readJson<LastUsedShape>(STORAGE_KEYS.lastTemplates, {})
  lastUsed[kind] = name
  writeJson(STORAGE_KEYS.lastTemplates, lastUsed)
}
