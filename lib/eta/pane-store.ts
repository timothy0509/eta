'use client'

import { create } from 'zustand'
import type { KmbPaneState } from '@/components/eta/panes/kmb-pane'
import type { MtrPaneState } from '@/components/eta/panes/mtr-pane'
import type { LrtPaneState } from '@/components/eta/panes/lrt-pane'
import type { KmbStopSearchItem } from '@/lib/eta/types'

type PaneStore = {
  kmb: KmbPaneState | null
  mtr: MtrPaneState | null
  lrt: LrtPaneState | null
  kmbStops: KmbStopSearchItem[]
  setKmbStops: (stops: KmbStopSearchItem[]) => void
}

export const usePaneStore = create<PaneStore>()((set) => ({
  kmb: null,
  mtr: null,
  lrt: null,
  kmbStops: [],
  // The full stop list is ~6k entries. Only replace it when the contents
  // actually changed so refetches never rewrite the last query's list
  // and rerender every kmbStops subscriber (favorites, nearby).
  setKmbStops: (stops) =>
    set((prev) => {
      const prevStops = prev.kmbStops
      if (
        prevStops.length === stops.length &&
        prevStops[0]?.stopId === stops[0]?.stopId &&
        prevStops[prevStops.length - 1]?.stopId === stops[stops.length - 1]?.stopId
      ) {
        return prev
      }
      return { kmbStops: stops }
    }),
}))

function shallowPaneEqual<T extends Record<string, unknown>>(prev: T | null, next: T): boolean {
  if (!prev) return false
  const prevKeys = Object.keys(prev)
  const nextKeys = Object.keys(next)
  if (prevKeys.length !== nextKeys.length) return false
  for (const key of nextKeys) {
    if (!Object.is(prev[key], next[key])) return false
  }
  return true
}

export function setKmbPaneState(next: KmbPaneState): void {
  usePaneStore.setState((prev) => {
    if (shallowPaneEqual(prev.kmb, next)) return prev
    return { kmb: next }
  })
}

export function setMtrPaneState(next: MtrPaneState): void {
  usePaneStore.setState((prev) => {
    if (shallowPaneEqual(prev.mtr, next)) return prev
    return { mtr: next }
  })
}

export function setLrtPaneState(next: LrtPaneState): void {
  usePaneStore.setState((prev) => {
    if (shallowPaneEqual(prev.lrt, next)) return prev
    return { lrt: next }
  })
}
