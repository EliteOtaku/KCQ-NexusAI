// core 信号 → React 桥：useSyncExternalStore 适配。
// core 信号文档明示支持该用法（subscribe 返回取消函数 + 快照引用稳定）。

import { useCallback, useSyncExternalStore } from 'react'
import type { ReadonlySignal } from '@363045841yyt/klinechart-core/reactivity'

/**
 * 订阅一个 core 信号；信号未就绪（图表尚未挂载）时返回 fallback。
 * @param signal core 只读信号；null 表示图表未就绪
 * @param fallback 稳定引用的兜底值（调用方必须传模块级常量或 memo 值）
 */
export function useSignal<T>(signal: ReadonlySignal<T> | null | undefined, fallback: T): T {
  const subscribe = useCallback(
    (onChange: () => void) => signal?.subscribe(onChange) ?? (() => {}),
    [signal],
  )
  const getSnapshot = useCallback(() => signal?.peek() ?? fallback, [signal, fallback])
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}

/** 常用空集合兜底（避免每次渲染新数组导致 getSnapshot 抖动）。 */
export const EMPTY_IDS: ReadonlyArray<string> = []
