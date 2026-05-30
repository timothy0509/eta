'use client'

import * as React from 'react'

import type { KmbEtaEntryWithLeg, KmbRouteInfoLite } from '@/lib/eta/client'
import type { PrecomputedGroups } from '@/components/eta/panes/kmb-pane'
import type { KmbStopSearchItem } from '@/lib/eta/types'
import type { RouteFilterState } from '@/components/eta/route-filter'

export type KmbPaneUrlState = {
  querySummary:
    | { mode: 'stop'; stopId: string }
    | { mode: 'stops'; stopIds: string[] }
    | { mode: 'contains'; query: string }
    | null
  routeFilter: RouteFilterState
}

export type KmbPaneRenderState = {
  lang: string
  title: string
  stopCode: string | null
  eta: KmbEtaEntryWithLeg[]
  routeInfos: Record<string, KmbRouteInfoLite>
  faresByVariantKey: Record<string, { hkd: number; dayCode?: number; source: 'hk-bus-eta' }>
  hasQuery: boolean
  loading: boolean
  error: string | null
  stale: boolean
  staleByStopId?: Record<string, { stale: boolean; ageMs: number | null }>
  lastUpdatedAt?: number
  stops: KmbStopSearchItem[]
  multipleStops: boolean
  isKeyphraseMode: boolean
  etaByStopId: Record<string, KmbEtaEntryWithLeg[]>
  loadedStopIds: string[]
  sentinelRef: React.RefObject<HTMLDivElement | null>
  hasMoreStops: boolean
  precomputedGroups: PrecomputedGroups
  visibleStopIds: Set<string>
  registerStopRef?: (stopId: string) => (el: HTMLElement | null) => void
  refresh: (options?: { toastOnError?: boolean }) => Promise<void>
}

type KmbPaneContextValue = {
  urlState: KmbPaneUrlState
  renderState: KmbPaneRenderState | null
}

const KmbPaneContext = React.createContext<KmbPaneContextValue | null>(null)

type KmbPaneProviderProps = {
  children: React.ReactNode
  urlState: KmbPaneUrlState
  renderState: KmbPaneRenderState | null
}

export function KmbPaneProvider({ children, urlState, renderState }: KmbPaneProviderProps) {
  const value = React.useMemo(() => ({ urlState, renderState }), [urlState, renderState])

  return React.createElement(KmbPaneContext.Provider, { value }, children)
}

export function useKmbPaneContext() {
  const ctx = React.useContext(KmbPaneContext)
  if (!ctx) {
    throw new Error('useKmbPaneContext must be used within KmbPaneProvider')
  }
  return ctx
}
