// 模板系统面板骨架：消费 DrawingTemplateStore 端口（可选注入），未注入时展示空态。
// 套用/保存的引擎接线为后续里程碑；存储实现可路由 localStorage 或宿主后端。

import { useEffect, useState } from 'react'
import type { DrawingTemplateRecord, DrawingTemplateStore } from '../shell/ports'
import { SHELL_LABELS } from '../shell/labels'

interface TemplatePanelProps {
  store: DrawingTemplateStore | null
}

/** 模板系统面板。 */
export function TemplatePanel({ store }: TemplatePanelProps) {
  const [records, setRecords] = useState<ReadonlyArray<DrawingTemplateRecord>>([])

  // 存储注入后拉取模板清单；空态兜底，拉取失败不阻塞壳。
  useEffect(() => {
    if (!store) return
    store
      .list()
      .then(setRecords)
      .catch(() => setRecords([]))
  }, [store])

  return (
    <section className="nx-side-panel__section">
      <h2 className="nx-side-panel__title">{SHELL_LABELS.templateSectionTitle}</h2>
      {records.length === 0 ? (
        <p className="nx-side-panel__empty">{SHELL_LABELS.templateEmpty}</p>
      ) : (
        records.map((record) => (
          <div key={`${record.tool}/${record.name}`} className="nx-side-panel__row">
            <span>
              {record.name} · {record.tool}
            </span>
            <button type="button" className="nx-btn">
              {SHELL_LABELS.templateApply}
            </button>
          </div>
        ))
      )}
    </section>
  )
}
