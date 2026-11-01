import type { KmbEtaEntryWithLeg } from '@/lib/eta/client'

export type EtaState = {
  byStopId: Record<string, KmbEtaEntryWithLeg[]>
  loadedStopIds: string[]
  faresByVariantKey: Record<string, { hkd: number; dayCode?: number; source: 'hk-bus-eta' }>
  loading: boolean
  error: string | null
  stale: boolean
  staleByStopId: Record<string, { stale: boolean; ageMs: number | null }>
  lastUpdatedAt: number | null
}

export type EtaAction =
  | { type: 'REFRESH_START' }
  | {
      type: 'REFRESH_SUCCESS'
      payload: {
        byStopId: Record<string, KmbEtaEntryWithLeg[]>
        loadedStopIds: string[]
        faresByVariantKey?: Record<string, { hkd: number; dayCode?: number; source: 'hk-bus-eta' }>
        staleByStopId?: Record<string, { stale: boolean; ageMs: number | null }>
        /** Skip the lastUpdatedAt bump when the refresh was fully served from cache. */
        keepTimestamp?: boolean
      }
    }
  | { type: 'REFRESH_ERROR'; error: string; keepPrevious?: boolean }
  | {
      type: 'APPEND_STOPS'
      payload: {
        byStopId: Record<string, KmbEtaEntryWithLeg[]>
        newStopIds: string[]
        faresByVariantKey?: Record<string, { hkd: number; dayCode?: number; source: 'hk-bus-eta' }>
        staleByStopId?: Record<string, { stale: boolean; ageMs: number | null }>
      }
    }
  | {
      type: 'FARES_SUCCESS'
      payload: {
        faresByVariantKey: Record<string, { hkd: number; dayCode?: number; source: 'hk-bus-eta' }>
      }
    }
  | { type: 'RESET' }

export const initialEtaState: EtaState = {
  byStopId: {},
  loadedStopIds: [],
  faresByVariantKey: {},
  loading: false,
  error: null,
  stale: false,
  staleByStopId: {},
  lastUpdatedAt: null,
}

export function etaReducer(state: EtaState, action: EtaAction): EtaState {
  switch (action.type) {
    case 'REFRESH_START':
      return { ...state, loading: true, error: null }
    case 'REFRESH_SUCCESS': {
      // Visible-only auto-refresh fetches a subset of stops. Merge their
      // stale flags into the existing map so off-screen stops keep theirs
      // instead of looking fresh on a timestamp they did not earn. Entries
      // for stops outside loadedStopIds are pruned so a new search does not
      // let departed stops vote on the global flag or grow the map.
      const loaded = new Set(action.payload.loadedStopIds)
      const mergedStale: EtaState['staleByStopId'] = {}
      for (const [stopId, entry] of Object.entries(state.staleByStopId)) {
        if (loaded.has(stopId)) mergedStale[stopId] = entry
      }
      Object.assign(mergedStale, action.payload.staleByStopId)
      return {
        ...state,
        byStopId: action.payload.byStopId,
        loadedStopIds: action.payload.loadedStopIds,
        faresByVariantKey: action.payload.faresByVariantKey ?? state.faresByVariantKey,
        loading: false,
        error: null,
        stale: Object.values(mergedStale).some((entry) => entry.stale),
        staleByStopId: mergedStale,
        // Cache hits carry data as old as the entry, not this poll tick.
        // Keep the previous timestamp so "just now" and the age-based
        // stale check reflect the data, not the poll.
        lastUpdatedAt: action.payload.keepTimestamp ? state.lastUpdatedAt : Date.now(),
      }
    }
    case 'REFRESH_ERROR': {
      // Transient stop failures keep their previous rows; a whole-refresh
      // failure blanks them. This branch is the whole-refresh path, so it
      // only clears rows on a genuine unknown error when told to.
      const staleAll = Object.fromEntries(
        Object.entries(state.staleByStopId).map(([stopId, entry]) => [
          stopId,
          { stale: true, ageMs: entry.ageMs ?? null },
        ])
      )
      return {
        ...state,
        loading: false,
        error: action.error,
        stale: true,
        staleByStopId: action.keepPrevious ? staleAll : {},
        byStopId: action.keepPrevious ? state.byStopId : {},
      }
    }
    case 'APPEND_STOPS':
      return {
        ...state,
        byStopId: { ...state.byStopId, ...action.payload.byStopId },
        loadedStopIds: [...state.loadedStopIds, ...action.payload.newStopIds],
        faresByVariantKey: {
          ...state.faresByVariantKey,
          ...(action.payload.faresByVariantKey ?? {}),
        },
        loading: false,
        staleByStopId: { ...state.staleByStopId, ...(action.payload.staleByStopId ?? {}) },
      }
    case 'FARES_SUCCESS':
      return {
        ...state,
        faresByVariantKey: { ...state.faresByVariantKey, ...action.payload.faresByVariantKey },
      }
    case 'RESET':
      return initialEtaState
    default:
      return state
  }
}
