import type { KmbEtaEntryWithLeg } from '@/lib/eta/client'
import type { KmbFareInfo } from '@/lib/eta/kmb-fares'

export type EtaState = {
  byStopId: Record<string, KmbEtaEntryWithLeg[]>
  loadedStopIds: string[]
  faresByVariantKey: Record<string, KmbFareInfo>
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
        faresByVariantKey?: Record<string, KmbFareInfo>
        staleByStopId?: Record<string, { stale: boolean; ageMs: number | null }>
        /** Skip the lastUpdatedAt bump when the refresh was fully served from cache. */
        keepTimestamp?: boolean
      }
    }
  | { type: 'REFRESH_ERROR'; error: string }
  | {
      type: 'APPEND_STOPS'
      payload: {
        byStopId: Record<string, KmbEtaEntryWithLeg[]>
        newStopIds: string[]
        faresByVariantKey?: Record<string, KmbFareInfo>
        staleByStopId?: Record<string, { stale: boolean; ageMs: number | null }>
      }
    }
  | {
      type: 'FARES_SUCCESS'
      payload: {
        faresByVariantKey: Record<string, KmbFareInfo>
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
    case 'REFRESH_SUCCESS':
      return {
        ...state,
        byStopId: action.payload.byStopId,
        loadedStopIds: action.payload.loadedStopIds,
        faresByVariantKey: action.payload.faresByVariantKey ?? state.faresByVariantKey,
        loading: false,
        error: null,
        stale: Boolean(
          action.payload.staleByStopId &&
          Object.values(action.payload.staleByStopId).some((entry) => entry.stale)
        ),
        staleByStopId: action.payload.staleByStopId ?? {},
        // Cache hits carry data as old as the entry, not this poll tick.
        // Keep the previous timestamp so "just now" and the age-based
        // stale check reflect the data, not the poll.
        lastUpdatedAt: action.payload.keepTimestamp ? state.lastUpdatedAt : Date.now(),
      }
    case 'REFRESH_ERROR':
      return {
        ...state,
        loading: false,
        error: action.error,
        stale: true,
        staleByStopId: {},
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
