import { beforeEach, describe, expect, it } from 'vitest'

import type { KmbPaneState } from '@/components/eta/panes/kmb-pane'
import type { KmbStopSearchItem } from '@/lib/eta/types'
import { setKmbPaneState, usePaneStore } from './pane-store'

const makeStop = (stopId: string): KmbStopSearchItem => ({
  stopId,
  nameEn: stopId,
  nameTc: stopId,
  nameSc: stopId,
  lat: 22.3,
  lng: 114.1,
  isKmb: true,
})

// Shared references mirror the real pane, where paneState is a useMemo: object
// identities only change when the underlying data changes. Each makePane call
// still creates fresh refresh/onLoadMore closures, so the skip test isolates
// function-identity churn.
const SHARED_ROUTE_FILTER = {}
const SHARED_RECORD: Record<string, never> = {}
const SHARED_LIST: never[] = []
const SHARED_GROUPS = { byStopId: {}, flat: [] }

const makePane = (overrides?: Partial<Pick<KmbPaneState, 'loading' | 'title'>>): KmbPaneState => ({
  lang: 'tc',
  routeFilter: SHARED_ROUTE_FILTER,
  querySummary: null,
  routeInfos: SHARED_RECORD,
  faresByVariantKey: SHARED_RECORD,
  eta: SHARED_LIST,
  etaByStopId: SHARED_RECORD,
  loadedStopIds: SHARED_LIST,
  loading: overrides?.loading ?? false,
  error: null,
  stale: false,
  hasQuery: false,
  multipleStops: false,
  isKeyphraseMode: false,
  title: overrides?.title ?? '',
  stopCode: null,
  stops: SHARED_LIST,
  refresh: () => Promise.resolve(),
  hasMoreStops: false,
  allStopIds: SHARED_LIST,
  onLoadMore: () => {},
  precomputedGroups: SHARED_GROUPS,
})

function setStops(stops: KmbStopSearchItem[]): void {
  usePaneStore.getState().setKmbStops(stops)
}

describe('setKmbStops', () => {
  beforeEach(() => {
    usePaneStore.setState({ kmbStops: [] })
  })

  it('keeps the reference for an identical list', () => {
    setStops([makeStop('A'), makeStop('B'), makeStop('C')])
    const first = usePaneStore.getState().kmbStops
    setStops([makeStop('A'), makeStop('B'), makeStop('C')])
    expect(usePaneStore.getState().kmbStops).toBe(first)
  })

  it('replaces when a middle entry changes with the same ends', () => {
    setStops([makeStop('A'), makeStop('B'), makeStop('C')])
    const first = usePaneStore.getState().kmbStops
    setStops([makeStop('A'), makeStop('X'), makeStop('C')])
    const next = usePaneStore.getState().kmbStops
    expect(next).not.toBe(first)
    expect(next[1].stopId).toBe('X')
  })

  it('replaces on reorder with identical ids', () => {
    setStops([makeStop('A'), makeStop('B'), makeStop('C')])
    const first = usePaneStore.getState().kmbStops
    setStops([makeStop('C'), makeStop('B'), makeStop('A')])
    expect(usePaneStore.getState().kmbStops).not.toBe(first)
  })
})

describe('setKmbPaneState', () => {
  beforeEach(() => {
    usePaneStore.setState({ kmb: null })
  })

  it('skips the write when only function identities change', () => {
    setKmbPaneState(makePane())
    const first = usePaneStore.getState().kmb
    // Same data, brand-new refresh/onLoadMore closures.
    setKmbPaneState(makePane())
    expect(usePaneStore.getState().kmb).toBe(first)
  })

  it('writes when data actually changes', () => {
    setKmbPaneState(makePane())
    const first = usePaneStore.getState().kmb
    setKmbPaneState(makePane({ loading: true }))
    const next = usePaneStore.getState().kmb
    expect(next).not.toBe(first)
    expect(next?.loading).toBe(true)
  })
})
