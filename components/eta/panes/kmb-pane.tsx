'use client'

import { ChevronDown, ChevronUp, RefreshCw } from 'lucide-react'
import * as React from 'react'

import {
  countActiveFilters,
  RouteFilter,
  type RouteFilterOption,
  type RouteFilterState,
} from '@/components/eta/route-filter'
import { StopSearch, type StopSearchSelection } from '@/components/eta/stop-search'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
  fetchKmbFares,
  fetchKmbRouteInfo,
  fetchKmbRouteStops,
  fetchKmbStopEtas,
  fetchKmbStops,
  type KmbEtaEntryWithLeg,
  type KmbFareVariant,
  type KmbRouteInfoLite,
  type KmbRouteStopLite,
} from '@/lib/eta/client'
import { isStaleByFlagOrAge } from '@/lib/eta/stale'
import { parseKmbStopName } from '@/lib/eta/kmb-stop-name'
import type { KmbStopSearchItem, UiLanguage } from '@/lib/eta/types'
import type { Company } from 'hk-bus-eta'
import { useInfiniteScroll, useVisibleItems } from '@/lib/eta/use-infinite-scroll'
import { useMediaQuery } from '@/lib/hooks/use-media-query'
import { cn } from '@/lib/utils'
import type { FavoritesItem, RouteFilterMode } from '@/lib/store'

// ============================================================================
// ETA State Reducer - Batch updates to minimize renders
// ============================================================================

type EtaState = {
  byStopId: Record<string, KmbEtaEntryWithLeg[]>
  loadedStopIds: string[]
  faresByVariantKey: Record<string, { hkd: number; dayCode?: number; source: 'hk-bus-eta' }>
  loading: boolean
  error: string | null
  stale: boolean
  staleByStopId: Record<string, { stale: boolean; ageMs: number | null }>
  lastUpdatedAt: number | null
}

type EtaAction =
  | { type: 'REFRESH_START' }
  | {
      type: 'REFRESH_SUCCESS'
      payload: {
        byStopId: Record<string, KmbEtaEntryWithLeg[]>
        loadedStopIds: string[]
        faresByVariantKey?: Record<string, { hkd: number; dayCode?: number; source: 'hk-bus-eta' }>
        staleByStopId?: Record<string, { stale: boolean; ageMs: number | null }>
      }
    }
  | { type: 'REFRESH_ERROR'; error: string }
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

const initialEtaState: EtaState = {
  byStopId: {},
  loadedStopIds: [],
  faresByVariantKey: {},
  loading: false,
  error: null,
  stale: false,
  staleByStopId: {},
  lastUpdatedAt: null,
}

function etaReducer(state: EtaState, action: EtaAction): EtaState {
  switch (action.type) {
    case 'REFRESH_START':
      return { ...state, loading: true, error: null }
    case 'REFRESH_SUCCESS':
      return {
        ...state,
        byStopId: action.payload.byStopId,
        loadedStopIds: action.payload.loadedStopIds,
        // Keep existing fares if payload doesn't include new ones (deferred loading)
        faresByVariantKey: action.payload.faresByVariantKey ?? state.faresByVariantKey,
        loading: false,
        error: null,
        stale: Boolean(
          action.payload.staleByStopId &&
          Object.values(action.payload.staleByStopId).some((entry) => entry.stale)
        ),
        staleByStopId: action.payload.staleByStopId ?? {},
        lastUpdatedAt: Date.now(),
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

// ============================================================================
// Stop Search Index - Precompute for O(1) contains lookups
// ============================================================================

type StopSearchIndex = {
  /** Lowercased concatenation of all name fields for each stop */
  normalizedNames: Map<string, string>
  /** Version counter to detect when stops change */
  version: number
}

function buildStopSearchIndex(stops: KmbStopSearchItem[]): StopSearchIndex {
  const normalizedNames = new Map<string, string>()
  for (const stop of stops) {
    const normalized = `${stop.nameEn.toLowerCase()}|${stop.nameTc.toLowerCase()}|${stop.nameSc.toLowerCase()}`
    normalizedNames.set(stop.stopId, normalized)
  }
  return { normalizedNames, version: stops.length }
}

function searchStopsByContains(
  stops: KmbStopSearchItem[],
  index: StopSearchIndex,
  query: string
): string[] {
  const needle = query.trim().toLowerCase()
  if (!needle) return []

  const result: string[] = []
  for (const stop of stops) {
    const normalized = index.normalizedNames.get(stop.stopId)
    if (normalized && normalized.includes(needle)) {
      result.push(stop.stopId)
    }
  }
  return result
}

// ============================================================================
// Route-Stop Index - O(1) lookup of variant keys by stop ID
// ============================================================================

type RouteStopIndex = {
  /** stopId -> Set of variant keys (co|route|bound|serviceType) */
  byStopId: Map<string, Set<string>>
  /** Version counter */
  version: number
}

function buildRouteStopIndex(routeStops: KmbRouteStopLite[]): RouteStopIndex {
  const byStopId = new Map<string, Set<string>>()
  for (const entry of routeStops) {
    const key = `${entry.co}|${entry.route.toUpperCase()}|${entry.bound}|${entry.serviceType}`
    let set = byStopId.get(entry.stopId)
    if (!set) {
      set = new Set()
      byStopId.set(entry.stopId, set)
    }
    set.add(key)
  }
  return { byStopId, version: routeStops.length }
}

function getVariantKeysForStops(index: RouteStopIndex, stopIds: string[]): string[] {
  const result = new Set<string>()
  for (const stopId of stopIds) {
    const keys = index.byStopId.get(stopId)
    if (keys) {
      for (const key of keys) {
        result.add(key)
      }
    }
  }
  return Array.from(result)
}

// ============================================================================
// Precomputed Render Groups - Avoid recomputing during render
// ============================================================================

export type EtaGroup = {
  key: string
  /** Base variant key without leg suffix (co|route|dir|service_type) for fare lookup */
  baseKey: string
  items: KmbEtaEntryWithLeg[]
  hasEta: boolean
  /** Whether this group should display a fare badge (true for non-arriving legs) */
  hasFare: boolean
  /** Whether this is the "arriving/returning" leg (leg B) - should show origin instead of destination */
  isArrivingLeg: boolean
}

export type PrecomputedGroups = {
  /** Groups by stop ID for sectioned rendering */
  byStopId: Record<string, EtaGroup[]>
  /** Flat groups for legacy rendering (non-keyphrase mode) */
  flat: EtaGroup[]
}

function hasValidEta(items: KmbEtaEntryWithLeg[]): boolean {
  return items.some((entry) => entry.eta && !isNaN(Date.parse(entry.eta)))
}

function groupEtasByVariant(
  eta: KmbEtaEntryWithLeg[],
  faresByVariantKey: Record<string, { hkd: number; dayCode?: number; source: 'hk-bus-eta' }>
): EtaGroup[] {
  const byVariant = new Map<string, KmbEtaEntryWithLeg[]>()
  for (const entry of eta) {
    const co = String(entry.co ?? 'kmb')
    const route = (entry.route ?? '').toUpperCase()
    const dir = String(entry.dir ?? '')
    const serviceType = String(entry.service_type ?? '')
    // Include leg in key to separate departing/arriving ETAs for circular routes
    const legSuffix = entry.leg ?? '_'
    const key = `${co}|${route}|${dir}|${serviceType}|${legSuffix}`

    const items = byVariant.get(key) ?? []
    items.push(entry)
    byVariant.set(key, items)
  }

  const groups = Array.from(byVariant.entries()).map(([key, items]) => {
    const sorted = [...items].sort((a, b) => a.eta_seq - b.eta_seq)
    const hasEta = hasValidEta(sorted)

    // Extract base key (co|route|dir|service_type) for fare lookup
    const parts = key.split('|')
    const baseKey = parts.slice(0, 4).join('|')
    const legPart = parts[4]
    const isArrivingLeg = legPart === 'B'
    const [co = 'kmb'] = parts

    // hasFare = should show fare badge (true for non-arriving legs)
    // The actual fare may or may not be loaded yet (deferred loading)
    const hasFare = !isArrivingLeg

    return { key, baseKey, items: sorted, hasEta, hasFare, isArrivingLeg }
  })

  // Sort with 3-tier ordering:
  // 1) ETA + fare loaded (hasEta && hasFare && fare exists in faresByVariantKey)
  // 2) ETA only (hasEta && (!hasFare || fare not loaded))
  // 3) No ETA
  // Within each tier, sort alphabetically by route number
  const sortByRoute = (a: { key: string }, b: { key: string }) => {
    const [, routeA = ''] = a.key.split('|')
    const [, routeB = ''] = b.key.split('|')
    return routeA.localeCompare(routeB, undefined, { numeric: true })
  }

  const hasFareLoaded = (g: EtaGroup) => g.hasFare && Boolean(faresByVariantKey[g.baseKey])

  // Tier 1: ETA + fare loaded
  const withEtaAndFare = groups.filter((g) => g.hasEta && hasFareLoaded(g)).sort(sortByRoute)
  // Tier 2: ETA only (no fare or fare not loaded yet)
  const withEtaOnly = groups.filter((g) => g.hasEta && !hasFareLoaded(g)).sort(sortByRoute)
  // Tier 3: No ETA
  const withoutEtas = groups.filter((g) => !g.hasEta).sort(sortByRoute)

  return [...withEtaAndFare, ...withEtaOnly, ...withoutEtas]
}

function precomputeRenderGroups(
  etaByStopId: Record<string, KmbEtaEntryWithLeg[]>,
  loadedStopIds: string[],
  faresByVariantKey: Record<string, { hkd: number; dayCode?: number; source: 'hk-bus-eta' }>
): PrecomputedGroups {
  // Precompute groups by stop ID
  const byStopId: Record<string, EtaGroup[]> = {}
  for (const stopId of loadedStopIds) {
    const eta = etaByStopId[stopId] ?? []
    byStopId[stopId] = groupEtasByVariant(eta, faresByVariantKey)
  }

  // Precompute flat groups (for non-keyphrase mode)
  const allEtas = loadedStopIds.flatMap((stopId) => etaByStopId[stopId] ?? [])
  const flat = groupEtasByVariant(allEtas, faresByVariantKey)

  return { byStopId, flat }
}

// ============================================================================
// Types and Helpers
// ============================================================================

type Props = {
  lang: UiLanguage
  routeFilterMode: RouteFilterMode
  onRouteFilterModeChange: (mode: RouteFilterMode) => void
  onAddRecent: (item: FavoritesItem) => void
  onAddFavorite: (item: FavoritesItem) => void
  canFavoriteRef: React.MutableRefObject<boolean>
  selectedItem?: FavoritesItem | null
  onRegisterRefresh?: (refresh: () => Promise<void>) => void
  onStopsChange?: (stops: KmbStopSearchItem[]) => void
  onStateChange?: (state: KmbPaneState) => void
}

type KmbQuery =
  | {
      mode: 'stop'
      stopId: string
      route?: string
      serviceType?: string
    }
  | {
      mode: 'stops'
      stopIds: string[]
      route?: string
      serviceType?: string
    }
  | {
      mode: 'contains'
      query: string
      route?: string
      serviceType?: string
    }

/** Cached result for contains query resolution */
type ContainsCache = {
  query: string
  stopIds: string[]
  stopsVersion: number
}

function pickKmbStopTitle(stop: KmbStopSearchItem, lang: UiLanguage) {
  if (lang === 'en') return stop.nameEn
  if (lang === 'sc') return stop.nameSc
  return stop.nameTc
}

function normalizeKmbRoutesInput(input: string) {
  const requestedRoutes = input
    ? input
        .split(',')
        .map((r) => r.trim())
        .filter(Boolean)
        .map((r) => r.toUpperCase())
    : null

  return requestedRoutes?.length ? requestedRoutes : null
}

/** Legacy function - still used for small filter operations where index isn't needed */
function stopNameContains(stop: KmbStopSearchItem, query: string) {
  const needle = query.trim().toLowerCase()
  if (!needle) return false

  return (
    stop.nameEn.toLowerCase().includes(needle) ||
    stop.nameTc.toLowerCase().includes(needle) ||
    stop.nameSc.toLowerCase().includes(needle)
  )
}

/** Stops per page for infinite scroll */
const STOPS_PER_PAGE = 10

export type KmbPaneState = {
  lang: UiLanguage
  routeFilter: RouteFilterState
  querySummary:
    | { mode: 'stop'; stopId: string }
    | { mode: 'stops'; stopIds: string[] }
    | { mode: 'contains'; query: string }
    | null
  routeInfos: Record<string, KmbRouteInfoLite>
  faresByVariantKey: Record<string, { hkd: number; dayCode?: number; source: 'hk-bus-eta' }>
  eta: KmbEtaEntryWithLeg[]
  /** ETAs grouped by stop ID for sectioned rendering */
  etaByStopId: Record<string, KmbEtaEntryWithLeg[]>
  /** Ordered list of stop IDs that have been loaded */
  loadedStopIds: string[]
  loading: boolean
  error?: string | null
  stale?: boolean
  staleByStopId?: Record<string, { stale: boolean; ageMs: number | null }>
  lastUpdatedAt?: number
  hasQuery: boolean
  multipleStops: boolean
  /** Whether this is a keyphrase search (contains mode) */
  isKeyphraseMode: boolean
  title: string
  stopCode: string | null
  stops: KmbStopSearchItem[]
  refresh: (options?: { toastOnError?: boolean }) => Promise<void>
  /** Sentinel ref for infinite scroll */
  sentinelRef: React.RefObject<HTMLDivElement | null>
  /** Whether there are more stops to load */
  hasMoreStops: boolean
  /** Precomputed render groups to avoid recomputation during render */
  precomputedGroups: PrecomputedGroups
  /** Currently visible stop IDs in the list */
  visibleStopIds: Set<string>
  /** Register ref for stop sections (visible tracking) */
  registerStopRef?: (stopId: string) => (el: HTMLElement | null) => void
}

export function KmbPane({
  lang,
  routeFilterMode,
  onRouteFilterModeChange,
  onAddRecent,
  onAddFavorite,
  canFavoriteRef,
  selectedItem,
  onRegisterRefresh,
  onStopsChange,
  onStateChange,
}: Props) {
  const [kmbStops, setKmbStops] = React.useState<KmbStopSearchItem[]>([])
  const [loadingStops, setLoadingStops] = React.useState(false)
  const [stopsError, setStopsError] = React.useState<string | null>(null)

  const kmbStopsById = React.useMemo(() => {
    return new Map(kmbStops.map((stop) => [stop.stopId, stop]))
  }, [kmbStops])

  const [kmbRouteStops, setKmbRouteStops] = React.useState<KmbRouteStopLite[]>([])
  const [loadingRouteStops, setLoadingRouteStops] = React.useState(false)
  const [routeStopsError, setRouteStopsError] = React.useState<string | null>(null)

  const [kmbRouteInfos, setKmbRouteInfos] = React.useState<Record<string, KmbRouteInfoLite>>({})

  const [kmbDraftStopSelection, setKmbDraftStopSelection] = React.useState<
    StopSearchSelection | undefined
  >()

  const [kmbQuery, setKmbQuery] = React.useState<KmbQuery | null>(null)
  const [routeFilter, setRouteFilter] = React.useState<RouteFilterState>({
    routes: '',
    entries: [],
  })

  const isMobile = !useMediaQuery('(min-width: 1024px)')
  const [filterExpanded, setFilterExpanded] = React.useState(false)

  const activeFilterCount = React.useMemo(() => countActiveFilters(routeFilter), [routeFilter])

  // ========== OPTIMIZATION: Use reducer for batched ETA state updates ==========
  const [etaState, dispatchEta] = React.useReducer(etaReducer, initialEtaState)

  // Aliases for backwards compatibility with existing code
  const kmbEtaByStopId = etaState.byStopId
  const loadedStopIds = etaState.loadedStopIds
  const kmbEtaLoading = etaState.loading
  const kmbEtaError = etaState.error
  const kmbEtaLastUpdatedAt = etaState.lastUpdatedAt
  const kmbEtaStale = etaState.stale
  const kmbEtaStaleByStopId = etaState.staleByStopId
  const kmbFaresByVariantKey = etaState.faresByVariantKey

  // Keep refs for stable callback access without triggering recreations
  const routeFilterEntriesRef = React.useRef(routeFilter.entries)
  const routeFilterModeRef = React.useRef(routeFilterMode)
  const etaStateRef = React.useRef(etaState)

  React.useEffect(() => {
    routeFilterEntriesRef.current = routeFilter.entries
  }, [routeFilter.entries])

  React.useEffect(() => {
    routeFilterModeRef.current = routeFilterMode
  }, [routeFilterMode])

  React.useEffect(() => {
    etaStateRef.current = etaState
  }, [etaState])

  // ========== OPTIMIZATION: Build search index once when stops load ==========
  const stopSearchIndex = React.useMemo<StopSearchIndex>(() => {
    return buildStopSearchIndex(kmbStops)
  }, [kmbStops])

  // ========== OPTIMIZATION: Build route-stop index once when routeStops load ==========
  const routeStopIndex = React.useMemo<RouteStopIndex>(() => {
    return buildRouteStopIndex(kmbRouteStops)
  }, [kmbRouteStops])

  // ========== OPTIMIZATION: Cache contains query resolution ==========
  // This avoids re-scanning all stops on every refresh/auto-refresh
  const containsCacheRef = React.useRef<ContainsCache | null>(null)

  const resolveContainsStopIds = React.useCallback(
    (query: string): string[] => {
      const trimmed = query.trim()
      if (trimmed.length < 3) return []

      const cache = containsCacheRef.current
      // Return cached result if query and stops haven't changed
      if (cache && cache.query === trimmed && cache.stopsVersion === stopSearchIndex.version) {
        return cache.stopIds
      }

      // Compute using indexed search
      const stopIds = searchStopsByContains(kmbStops, stopSearchIndex, trimmed)

      // Cache the result
      containsCacheRef.current = {
        query: trimmed,
        stopIds,
        stopsVersion: stopSearchIndex.version,
      }

      return stopIds
    },
    [kmbStops, stopSearchIndex]
  )

  // Compute all stop IDs for the current query (uses cached resolution for contains)
  const allStopIds = React.useMemo(() => {
    if (!kmbQuery) return []
    if (kmbQuery.mode === 'stop') return [kmbQuery.stopId]
    if (kmbQuery.mode === 'stops') return kmbQuery.stopIds
    if (kmbQuery.mode === 'contains') {
      return resolveContainsStopIds(kmbQuery.query)
    }
    return []
  }, [kmbQuery, resolveContainsStopIds])

  // Infinite scroll hook for keyphrase mode
  const infiniteScroll = useInfiniteScroll({
    totalItems: allStopIds.length,
    initialPageSize: STOPS_PER_PAGE,
    pageSize: STOPS_PER_PAGE,
    rootMargin: '300px',
  })

  const { visibleIds: visibleStopIds, registerRef: registerStopRef } = useVisibleItems(
    loadedStopIds,
    { rootMargin: '200px' }
  )

  // Derived flat eta array for backwards compatibility
  const kmbEta = React.useMemo(() => {
    return loadedStopIds.flatMap((stopId) => kmbEtaByStopId[stopId] ?? [])
  }, [kmbEtaByStopId, loadedStopIds])

  React.useEffect(() => {
    let cancelled = false

    const load = async () => {
      setLoadingStops(true)
      setStopsError(null)
      try {
        const stops = await fetchKmbStops()
        if (cancelled) return
        setKmbStops(stops)
        onStopsChange?.(stops)
      } catch (error) {
        if (!cancelled)
          setStopsError(error instanceof Error ? error.message : 'Failed to load stops')
      } finally {
        if (!cancelled) setLoadingStops(false)
      }
    }

    if (!kmbStops.length) void load()

    return () => {
      cancelled = true
    }
  }, [kmbStops.length, onStopsChange])

  React.useEffect(() => {
    let cancelled = false

    const load = async () => {
      setLoadingRouteStops(true)
      setRouteStopsError(null)
      try {
        const data = await fetchKmbRouteStops()
        if (!cancelled) setKmbRouteStops(data)
      } catch (error) {
        if (!cancelled)
          setRouteStopsError(error instanceof Error ? error.message : 'Failed to load route-stop')
      } finally {
        if (!cancelled) setLoadingRouteStops(false)
      }
    }

    if (!kmbRouteStops.length) void load()

    return () => {
      cancelled = true
    }
  }, [kmbRouteStops.length])

  const availableStopIdsForFilter = React.useMemo(() => {
    if (!kmbDraftStopSelection) return [] as string[]

    if (kmbDraftStopSelection.type === 'stop') {
      return [kmbDraftStopSelection.stopId]
    }

    if (kmbDraftStopSelection.type === 'stops') {
      return kmbDraftStopSelection.stopIds
    }

    const trimmed = kmbDraftStopSelection.query.trim()
    if (trimmed.length < 3) return []

    return resolveContainsStopIds(trimmed).slice(0, 20)
  }, [kmbDraftStopSelection, resolveContainsStopIds])

  const pickRouteVariantLabel = React.useCallback(
    (info: KmbRouteInfoLite | undefined) => {
      if (!info) return ''
      const origin =
        lang === 'en' ? info.origin.en : lang === 'sc' ? info.origin.sc : info.origin.tc
      const destination =
        lang === 'en'
          ? info.destination.en
          : lang === 'sc'
            ? info.destination.sc
            : info.destination.tc
      if (!origin || !destination) return ''
      return `${origin} → ${destination}`
    },
    [lang]
  )

  // ========== OPTIMIZATION: Use index for available route variants ==========
  const kmbAvailableRouteVariants: RouteFilterOption[] = React.useMemo(() => {
    if (!availableStopIdsForFilter.length) return []

    // Use the route-stop index instead of filtering the entire array
    const variantKeys = getVariantKeysForStops(routeStopIndex, availableStopIdsForFilter)

    return variantKeys
      .map((key) => {
        const [, route = ''] = key.split('|')
        const label = pickRouteVariantLabel(kmbRouteInfos[key])
        return {
          key,
          route,
          label: label || '—',
        }
      })
      .filter((opt) => opt.route)
  }, [availableStopIdsForFilter, kmbRouteInfos, routeStopIndex, pickRouteVariantLabel])

  React.useEffect(() => {
    if (!availableStopIdsForFilter.length) return
    if (!routeStopIndex.version) return

    // Use the route-stop index instead of filtering the entire array
    const variantKeys = getVariantKeysForStops(routeStopIndex, availableStopIdsForFilter)

    const missing = variantKeys.filter((key) => !kmbRouteInfos[key])
    if (!missing.length) return

    let cancelled = false
    const load = async () => {
      const fetched = await Promise.allSettled(
        missing.map(async (key) => {
          const [co = 'kmb', route = '', direction = '', serviceType = ''] = key.split('|')
          const info = await fetchKmbRouteInfo({ co: co as Company, route, direction, serviceType })
          return { key, info }
        })
      )

      if (cancelled) return

      const updates: Record<string, KmbRouteInfoLite> = {}
      for (const item of fetched) {
        if (item.status !== 'fulfilled') continue
        updates[item.value.key] = item.value.info
      }

      if (Object.keys(updates).length) {
        setKmbRouteInfos((prev) => ({ ...prev, ...updates }))
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [availableStopIdsForFilter, kmbRouteInfos, routeStopIndex])

  React.useEffect(() => {
    if (routeFilterMode !== 'advanced') return
    if (!(routeFilter.entries ?? []).length) return

    const nextEntries = (routeFilter.entries ?? []).filter((entry) =>
      kmbAvailableRouteVariants.some((opt) => opt.key === entry.variantKey)
    )

    if (nextEntries.length === (routeFilter.entries ?? []).length) return

    setRouteFilter((prev) => ({ ...prev, entries: nextEntries }))
    setKmbQuery(null)
    dispatchEta({ type: 'RESET' })
  }, [kmbAvailableRouteVariants, routeFilter.entries, routeFilterMode])

  // AbortController for cancelling in-flight requests
  const abortControllerRef = React.useRef<AbortController | null>(null)

  // Coordination ref to prevent overlapping refresh triggers from multiple effects
  const pendingRefreshTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  // Build route filter string based on current filter state
  const getRouteFilterString = React.useCallback(
    (query: KmbQuery) => {
      const advancedEntries = routeFilterMode === 'advanced' ? (routeFilter.entries ?? []) : []
      const requestedRoutes = normalizeKmbRoutesInput(query.route?.trim() ?? '')

      if (advancedEntries.length) {
        const routesFromAdvanced = new Set(
          advancedEntries.map((e) => e.variantKey.split('|')[1]).filter(Boolean)
        )
        return Array.from(routesFromAdvanced).join(',')
      } else if (requestedRoutes) {
        return requestedRoutes.join(',')
      }
      return undefined
    },
    [routeFilter.entries, routeFilterMode]
  )

  // Fetch ETAs for a specific set of stop IDs and merge into state
  // Fares are fetched in a separate background request for faster initial load
  // Uses refs for stable callback to avoid stale closure issues
  const fetchStopEtas = React.useCallback(
    async (
      stopIds: string[],
      options: {
        routeFilterString?: string
        signal?: AbortSignal
        append?: boolean
        mergeExisting?: boolean
        replaceLoadedStopIds?: string[]
      }
    ) => {
      if (!stopIds.length) return

      // Fetch ETAs without fares (fast path)
      const result = await fetchKmbStopEtas(stopIds, {
        routeFilter: options.routeFilterString,
        signal: options.signal,
        includeFares: false,
      })

      if (options.signal?.aborted) return

      if (result.truncatedStopIds?.length) {
        console.warn(
          `KMB ETA truncated ${result.truncatedStopIds.length} stop(s) (limit 100 per request).`
        )
      }

      // Apply advanced filter client-side if needed (using refs for stable access)
      const currentFilterMode = routeFilterModeRef.current
      const currentFilterEntries = routeFilterEntriesRef.current
      const advancedEntries = currentFilterMode === 'advanced' ? (currentFilterEntries ?? []) : []
      const advancedKeys = advancedEntries.length
        ? new Set(advancedEntries.map((e) => e.variantKey).filter(Boolean))
        : null

      const filteredByStopId: Record<string, KmbEtaEntryWithLeg[]> = {}
      for (const stopId of stopIds) {
        let etas = result.byStopId[stopId] ?? []
        if (advancedKeys) {
          etas = etas.filter((eta) => {
            // Use base key (without leg) for advanced filter matching
            const key = `${String(eta.co ?? 'kmb')}|${(eta.route ?? '').toUpperCase()}|${eta.dir}|${String(eta.service_type)}`
            return advancedKeys.has(key)
          })
        }
        filteredByStopId[stopId] = etas
      }

      const staleByStopId = result.staleByStopId
        ? Object.fromEntries(
            Object.entries(result.staleByStopId).map(([stopId, entry]) => [
              stopId,
              {
                ...entry,
                stale: isStaleByFlagOrAge({
                  upstreamStale: entry.stale,
                  ageMs: entry.ageMs,
                  mode: 'kmb',
                }),
              },
            ])
          )
        : undefined

      // Get current state from refs to avoid stale closure issues
      const currentEtaState = etaStateRef.current

      // Dispatch ETAs immediately (without fares)
      if (options.append) {
        // Append mode: merge with existing state
        const existingSet = new Set(currentEtaState.loadedStopIds)
        const newStopIds = stopIds.filter((id) => !existingSet.has(id))
        dispatchEta({
          type: 'APPEND_STOPS',
          payload: {
            byStopId: filteredByStopId,
            newStopIds,
            staleByStopId,
          },
        })
      } else {
        // Replace mode: full refresh
        const mergedByStopId = options.mergeExisting
          ? { ...currentEtaState.byStopId, ...filteredByStopId }
          : filteredByStopId
        const nextLoadedStopIds = options.replaceLoadedStopIds ?? stopIds
        dispatchEta({
          type: 'REFRESH_SUCCESS',
          payload: {
            byStopId: mergedByStopId,
            loadedStopIds: nextLoadedStopIds,
            staleByStopId,
          },
        })
      }

      // Fire background request for fares
      // Build list of unique variants that need fares
      const allEtas = Object.entries(filteredByStopId).flatMap(([stopId, etas]) =>
        etas.map((eta) => ({ stopId, eta }))
      )
      const seenVariants = new Set<string>()
      const fareVariants: KmbFareVariant[] = []

      for (const { stopId, eta } of allEtas) {
        const co = String(eta.co ?? 'kmb') as Company
        const route = (eta.route ?? '').toUpperCase()
        const dir = String(eta.dir ?? '')
        const serviceType = String(eta.service_type ?? '')
        const vKey = `${co}|${route}|${dir}|${serviceType}`

        // Skip if we already have this fare or already queued it (use ref for latest state)
        const currentFares = etaStateRef.current.faresByVariantKey
        if (currentFares[vKey] || seenVariants.has(vKey)) continue
        seenVariants.add(vKey)

        fareVariants.push({
          co,
          route,
          dir,
          serviceType,
          stopId,
          destCandidates: [eta.dest_en, eta.dest_tc, eta.dest_sc].filter(Boolean) as string[],
        })
      }

      // Fetch fares in background if there are any missing
      if (fareVariants.length > 0 && !options.signal?.aborted) {
        fetchKmbFares(fareVariants, { signal: options.signal })
          .then((faresResult) => {
            if (!options.signal?.aborted) {
              dispatchEta({
                type: 'FARES_SUCCESS',
                payload: { faresByVariantKey: faresResult.faresByVariantKey },
              })
            }
          })
          .catch((err) => {
            if (!options.signal?.aborted) {
              console.warn('Failed to load fares:', err)
            }
          })
      }

      return { filteredByStopId, result }
    },
    []
  )

  // Main refresh function - handles both initial load and refresh of loaded stops
  const refreshKmbEta = React.useCallback(
    async (
      queryOverride?: KmbQuery | null,
      options?: { toastOnError?: boolean; isInitialLoad?: boolean; isAutoRefresh?: boolean }
    ) => {
      const query = queryOverride ?? kmbQuery
      if (!query) return

      // Cancel any pending debounced refresh
      if (pendingRefreshTimeoutRef.current) {
        clearTimeout(pendingRefreshTimeoutRef.current)
        pendingRefreshTimeoutRef.current = null
      }

      // Cancel any in-flight request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
      const controller = new AbortController()
      abortControllerRef.current = controller

      const routeFilterString = getRouteFilterString(query)

      // ========== OPTIMIZATION: Use cached stopId resolution for contains mode ==========
      const queryStopIds =
        query.mode === 'stop'
          ? [query.stopId]
          : query.mode === 'stops'
            ? query.stopIds
            : resolveContainsStopIds(query.query)

      if (!queryStopIds.length) return

      // For initial load or query change, fetch first page
      // For refresh, fetch all currently loaded stops
      const isNewQuery = options?.isInitialLoad || loadedStopIds.length === 0
      const stopIdsToFetch = isNewQuery ? queryStopIds.slice(0, STOPS_PER_PAGE) : loadedStopIds

      const shouldLimitToVisible =
        Boolean(options?.isAutoRefresh) && !isNewQuery && loadedStopIds.length > STOPS_PER_PAGE

      const visibleStopIdsList = shouldLimitToVisible
        ? loadedStopIds.filter((stopId) => visibleStopIds.has(stopId))
        : []

      const refreshStopIds =
        shouldLimitToVisible && visibleStopIdsList.length > 0 ? visibleStopIdsList : stopIdsToFetch

      dispatchEta({ type: 'REFRESH_START' })
      try {
        const fetchResult = await fetchStopEtas(refreshStopIds, {
          routeFilterString,
          signal: controller.signal,
          append: false, // Always replace on refresh
          mergeExisting: shouldLimitToVisible,
          replaceLoadedStopIds: stopIdsToFetch,
        })

        if (controller.signal.aborted) return

        // Note: fetchStopEtas already dispatches REFRESH_SUCCESS

        // ========== OPTIMIZATION: Use route-stop index for variant key lookup ==========
        if (fetchResult) {
          const allEtas = Object.values(fetchResult.filteredByStopId).flat()
          const variantKeysFromEtas = Array.from(
            new Set(
              allEtas.map(
                (eta) =>
                  `${String(eta.co ?? 'kmb')}|${(eta.route ?? '').toUpperCase()}|${eta.dir}|${String(eta.service_type)}`
              )
            )
          )

          // Use index instead of filtering entire kmbRouteStops array
          const candidateKeysFromStops = getVariantKeysForStops(routeStopIndex, refreshStopIds)

          const allVariantKeys = new Set([...variantKeysFromEtas, ...candidateKeysFromStops])
          const missingKeys = Array.from(allVariantKeys).filter((key) => !kmbRouteInfos[key])

          if (missingKeys.length && !controller.signal.aborted) {
            const fetched = await Promise.allSettled(
              missingKeys.slice(0, 30).map(async (key) => {
                const [co = 'kmb', route = '', direction = '', serviceType = ''] = key.split('|')
                const info = await fetchKmbRouteInfo({
                  co: co as Company,
                  route,
                  direction,
                  serviceType,
                })
                return { key, info }
              })
            )

            if (!controller.signal.aborted) {
              const updates: Record<string, KmbRouteInfoLite> = {}
              for (const item of fetched) {
                if (item.status !== 'fulfilled') continue
                updates[item.value.key] = item.value.info
              }

              if (Object.keys(updates).length) {
                setKmbRouteInfos((prev) => ({ ...prev, ...updates }))
              }
            }
          }
        }
      } catch (error) {
        const isAbort =
          controller.signal.aborted ||
          (error instanceof DOMException && error.name === 'AbortError') ||
          (error instanceof Error && error.message.toLowerCase().includes('aborted'))
        if (isAbort) return

        const message = error instanceof Error ? error.message : 'Failed to load ETAs'
        dispatchEta({ type: 'REFRESH_ERROR', error: message })

        if (options?.toastOnError) {
          const { toast } = await import('sonner')
          toast.error(message)
        }
      }
      // Note: loading state is managed by REFRESH_START/REFRESH_SUCCESS/REFRESH_ERROR
    },
    [
      kmbQuery,
      kmbRouteInfos,
      loadedStopIds,
      getRouteFilterString,
      fetchStopEtas,
      resolveContainsStopIds,
      routeStopIndex,
      visibleStopIds,
    ]
  )

  const loadMoreLoadingRef = React.useRef(false)

  // Load more stops when infinite scroll triggers
  const loadMoreStops = React.useCallback(async () => {
    if (!kmbQuery || kmbEtaLoading || loadMoreLoadingRef.current) return
    loadMoreLoadingRef.current = true

    const currentLoaded = new Set(loadedStopIds)
    const nextStopIds = allStopIds.filter((id) => !currentLoaded.has(id)).slice(0, STOPS_PER_PAGE)

    if (!nextStopIds.length) {
      loadMoreLoadingRef.current = false
      return
    }

    const controller = new AbortController()
    abortControllerRef.current = controller

    const routeFilterString = getRouteFilterString(kmbQuery)

    dispatchEta({ type: 'REFRESH_START' })
    try {
      await fetchStopEtas(nextStopIds, {
        routeFilterString,
        signal: controller.signal,
        append: true,
      })
      // Note: fetchStopEtas dispatches APPEND_STOPS on success
    } catch (error) {
      const isAbort =
        controller.signal.aborted ||
        (error instanceof DOMException && error.name === 'AbortError') ||
        (error instanceof Error && error.message.toLowerCase().includes('aborted'))
      if (isAbort) return

      const message = error instanceof Error ? error.message : 'Failed to load more stops'
      dispatchEta({ type: 'REFRESH_ERROR', error: message })
    } finally {
      loadMoreLoadingRef.current = false
    }
  }, [kmbQuery, kmbEtaLoading, loadedStopIds, allStopIds, getRouteFilterString, fetchStopEtas])

  // Watch infinite scroll visibleCount and load more when needed
  const prevVisibleCountRef = React.useRef(infiniteScroll.visibleCount)
  React.useEffect(() => {
    const prev = prevVisibleCountRef.current
    const curr = infiniteScroll.visibleCount
    prevVisibleCountRef.current = curr

    // Only load more if visibleCount increased and we have more stops to load
    if (curr > prev && curr > loadedStopIds.length && infiniteScroll.hasMore) {
      void loadMoreStops()
    }
  }, [infiniteScroll.visibleCount, infiniteScroll.hasMore, loadedStopIds.length, loadMoreStops])

  // Cleanup abort controller and pending refresh on unmount
  React.useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
      if (pendingRefreshTimeoutRef.current) {
        clearTimeout(pendingRefreshTimeoutRef.current)
      }
    }
  }, [])

  const refreshKmbEtaRef = React.useRef(refreshKmbEta)
  React.useEffect(() => {
    refreshKmbEtaRef.current = refreshKmbEta
  }, [refreshKmbEta])

  React.useEffect(() => {
    if (!onRegisterRefresh) return
    onRegisterRefresh(() =>
      refreshKmbEtaRef.current(kmbQuery, { toastOnError: false, isAutoRefresh: true })
    )
  }, [kmbQuery, onRegisterRefresh])

  const lastSelectedIdRef = React.useRef<string | null>(null)
  React.useEffect(() => {
    if (!selectedItem || selectedItem.mode !== 'kmb') return
    if (selectedItem.id === lastSelectedIdRef.current) return
    lastSelectedIdRef.current = selectedItem.id

    const nextRouteFilterMode = selectedItem.routeFilterMode ?? 'simple'
    if (nextRouteFilterMode !== routeFilterMode) {
      onRouteFilterModeChange(nextRouteFilterMode)
    }

    const restoredEntries = (selectedItem.entries ?? []).map((entry, idx) => ({
      id: `restored-${idx}`,
      variantKey:
        entry.variantKey.split('|').length === 3 ? `kmb|${entry.variantKey}` : entry.variantKey,
    }))

    setRouteFilter({
      routes: selectedItem.route ?? '',
      entries: restoredEntries,
    })

    if ('stopId' in selectedItem) {
      setKmbDraftStopSelection({ type: 'stop', stopId: selectedItem.stopId })
    } else if ('stopIds' in selectedItem) {
      setKmbDraftStopSelection({ type: 'stops', stopIds: selectedItem.stopIds })
    } else if ('query' in selectedItem) {
      setKmbDraftStopSelection({ type: 'contains', query: selectedItem.query })
    }

    // Clear state for new query
    setKmbQuery(null)
    dispatchEta({ type: 'RESET' })
    infiniteScroll.reset()
  }, [onRouteFilterModeChange, routeFilterMode, selectedItem, infiniteScroll])

  const prevStopSelectionRef = React.useRef<StopSearchSelection | undefined>(undefined)
  React.useEffect(() => {
    if (!kmbDraftStopSelection) return
    if (!kmbRouteStops.length) return

    const prev = prevStopSelectionRef.current
    prevStopSelectionRef.current = kmbDraftStopSelection

    const isSame =
      prev &&
      prev.type === kmbDraftStopSelection.type &&
      (prev.type === 'stop'
        ? prev.stopId === (kmbDraftStopSelection as { type: 'stop'; stopId: string }).stopId
        : prev.type === 'stops'
          ? JSON.stringify((prev as { type: 'stops'; stopIds: string[] }).stopIds) ===
            JSON.stringify((kmbDraftStopSelection as { type: 'stops'; stopIds: string[] }).stopIds)
          : (prev as { type: 'contains'; query: string }).query ===
            (kmbDraftStopSelection as { type: 'contains'; query: string }).query)

    if (isSame) return

    const routeInput = routeFilterMode === 'simple' ? (routeFilter.routes?.trim() ?? '') : ''
    const nextQuery: KmbQuery =
      kmbDraftStopSelection.type === 'stop'
        ? {
            mode: 'stop',
            stopId: kmbDraftStopSelection.stopId,
            route: routeInput || undefined,
            serviceType: '1',
          }
        : kmbDraftStopSelection.type === 'stops'
          ? {
              mode: 'stops',
              stopIds: kmbDraftStopSelection.stopIds,
              route: routeInput || undefined,
              serviceType: '1',
            }
          : {
              mode: 'contains',
              query: kmbDraftStopSelection.query,
              route: routeInput || undefined,
              serviceType: '1',
            }

    // Reset infinite scroll and state for new query
    dispatchEta({ type: 'RESET' })
    infiniteScroll.reset()

    setKmbQuery(nextQuery)
    void refreshKmbEtaRef.current(nextQuery, { toastOnError: false, isInitialLoad: true })
  }, [
    kmbDraftStopSelection,
    kmbRouteStops.length,
    routeFilter.routes,
    routeFilterMode,
    infiniteScroll,
  ])

  React.useEffect(() => {
    if (!selectedItem) return
    if (selectedItem.mode !== 'kmb') return
    if (selectedItem.id !== lastSelectedIdRef.current) return

    let nextQuery: KmbQuery | null = null

    if ('stopId' in selectedItem) {
      nextQuery = {
        mode: 'stop',
        stopId: selectedItem.stopId,
        route: selectedItem.route,
        serviceType: selectedItem.serviceType,
      }
    } else if ('stopIds' in selectedItem) {
      nextQuery = {
        mode: 'stops',
        stopIds: selectedItem.stopIds,
        route: selectedItem.route,
        serviceType: '1',
      }
    } else if ('query' in selectedItem) {
      nextQuery = {
        mode: 'contains',
        query: selectedItem.query,
        route: selectedItem.route,
        serviceType: selectedItem.serviceType,
      }
    }

    if (!nextQuery) return

    setKmbQuery(nextQuery)
    void refreshKmbEtaRef.current(nextQuery, { toastOnError: false, isInitialLoad: true })
  }, [selectedItem])

  const prevEntriesRef = React.useRef<typeof routeFilter.entries>([])
  React.useEffect(() => {
    if (routeFilterMode !== 'advanced') return
    if (!kmbDraftStopSelection) return
    if (!kmbRouteStops.length) return

    const prev = prevEntriesRef.current ?? []
    const curr = routeFilter.entries ?? []
    prevEntriesRef.current = curr

    const prevKeys = new Set(prev.map((e) => e.variantKey))
    const currKeys = new Set(curr.map((e) => e.variantKey))
    if (prevKeys.size === currKeys.size && [...prevKeys].every((k) => currKeys.has(k))) return

    const nextQuery: KmbQuery =
      kmbDraftStopSelection.type === 'stop'
        ? { mode: 'stop', stopId: kmbDraftStopSelection.stopId, serviceType: '1' }
        : kmbDraftStopSelection.type === 'stops'
          ? { mode: 'stops', stopIds: kmbDraftStopSelection.stopIds, serviceType: '1' }
          : { mode: 'contains', query: kmbDraftStopSelection.query, serviceType: '1' }

    setKmbQuery(nextQuery)
    void refreshKmbEtaRef.current(nextQuery, { toastOnError: false, isInitialLoad: true })
  }, [routeFilterMode, routeFilter.entries, kmbDraftStopSelection, kmbRouteStops.length])

  const [debouncedRoutes, setDebouncedRoutes] = React.useState(routeFilter.routes ?? '')
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedRoutes(routeFilter.routes ?? '')
    }, 1000)
    return () => clearTimeout(timer)
  }, [routeFilter.routes])

  React.useEffect(() => {
    if (routeFilterMode !== 'simple') return
    if (!kmbDraftStopSelection) return
    if (!kmbRouteStops.length) return

    const routeInput = debouncedRoutes.trim()
    const nextQuery: KmbQuery =
      kmbDraftStopSelection.type === 'stop'
        ? {
            mode: 'stop',
            stopId: kmbDraftStopSelection.stopId,
            route: routeInput || undefined,
            serviceType: '1',
          }
        : kmbDraftStopSelection.type === 'stops'
          ? {
              mode: 'stops',
              stopIds: kmbDraftStopSelection.stopIds,
              route: routeInput || undefined,
              serviceType: '1',
            }
          : {
              mode: 'contains',
              query: kmbDraftStopSelection.query,
              route: routeInput || undefined,
              serviceType: '1',
            }

    setKmbQuery(nextQuery)
    void refreshKmbEtaRef.current(nextQuery, { toastOnError: false, isInitialLoad: true })
  }, [routeFilterMode, debouncedRoutes, kmbDraftStopSelection, kmbRouteStops.length])

  const kmbResultsInfo = React.useMemo(() => {
    if (!kmbQuery) {
      return {
        title: lang === 'en' ? 'Bus ETAs' : lang === 'sc' ? '巴士到站预报' : '巴士到站預報',
        code: null,
      }
    }
    if (kmbQuery.mode === 'stop') {
      const stop = kmbStopsById.get(kmbQuery.stopId)
      if (stop) {
        const fullName = pickKmbStopTitle(stop, lang)
        const parsed = parseKmbStopName(fullName)
        return { title: parsed.name, code: parsed.stopCode }
      }
      return { title: `Stop ${kmbQuery.stopId}`, code: null }
    }
    if (kmbQuery.mode === 'stops') {
      const firstStop = kmbQuery.stopIds.map((stopId) => kmbStopsById.get(stopId)).find(Boolean)
      if (firstStop) {
        const fullName = pickKmbStopTitle(firstStop, lang)
        const parsed = parseKmbStopName(fullName)
        return { title: parsed.name, code: null }
      }
      return { title: lang === 'en' ? 'Selected stops' : '已選車站', code: null }
    }
    return {
      title:
        lang === 'en'
          ? `Stops containing "${kmbQuery.query.trim()}"`
          : `包含「${kmbQuery.query.trim()}」的車站`,
      code: null,
    }
  }, [kmbQuery, kmbStopsById, lang])

  const canFavorite =
    (kmbQuery?.mode === 'stop' && kmbQuery.stopId) ||
    (kmbQuery?.mode === 'stops' && kmbQuery.stopIds.length > 0) ||
    (kmbQuery?.mode === 'contains' && kmbQuery.query.trim().length >= 3) ||
    kmbDraftStopSelection?.type === 'stop' ||
    (kmbDraftStopSelection?.type === 'stops' && kmbDraftStopSelection.stopIds.length > 0) ||
    (kmbDraftStopSelection?.type === 'contains' && kmbDraftStopSelection.query.trim().length >= 3)

  React.useEffect(() => {
    canFavoriteRef.current = Boolean(canFavorite)
  }, [canFavorite, canFavoriteRef])

  const onSave = () => {
    if (!canFavorite) return

    const isAdvanced = routeFilterMode === 'advanced'
    const routeInput = isAdvanced ? '' : (routeFilter.routes?.trim() ?? '')
    const route = routeInput || undefined

    const entriesForSave =
      isAdvanced && routeFilter.entries?.length
        ? routeFilter.entries.map((e) => ({ variantKey: e.variantKey }))
        : undefined

    const routeCount = isAdvanced ? (routeFilter.entries?.length ?? 0) : 0
    const routeSuffix =
      isAdvanced && routeCount > 0
        ? ` · ${routeCount} ${lang === 'en' ? (routeCount === 1 ? 'route' : 'routes') : '條路線'}`
        : route
          ? ` · ${route}`
          : ''

    const stopId =
      kmbQuery?.mode === 'stop'
        ? kmbQuery.stopId
        : kmbDraftStopSelection?.type === 'stop'
          ? kmbDraftStopSelection.stopId
          : null

    const stopIds =
      kmbQuery?.mode === 'stops'
        ? kmbQuery.stopIds
        : kmbDraftStopSelection?.type === 'stops'
          ? kmbDraftStopSelection.stopIds
          : null

    const containsQuery =
      kmbQuery?.mode === 'contains'
        ? kmbQuery.query.trim()
        : kmbDraftStopSelection?.type === 'contains'
          ? kmbDraftStopSelection.query.trim()
          : ''

    let item: FavoritesItem | null = null

    if (stopId) {
      const stop = kmbStopsById.get(stopId)
      const fullName = stop ? pickKmbStopTitle(stop, lang) : lang === 'en' ? 'Bus' : '巴士'
      const { name } = parseKmbStopName(fullName)
      const title = `${name}${routeSuffix}`

      const idPart = isAdvanced ? `adv:${routeCount}` : (route ?? '__all__')
      item = {
        id: `kmb:${stopId}:${idPart}:1`,
        mode: 'kmb',
        title,
        stopId,
        routeFilterMode,
        route,
        serviceType: '1',
        entries: entriesForSave,
      }
    } else if (stopIds && stopIds.length > 0) {
      const firstStop = stopIds.map((stopId) => kmbStopsById.get(stopId)).find(Boolean)
      const fullName = firstStop ? pickKmbStopTitle(firstStop, lang) : 'Selected Stops'
      const { name } = parseKmbStopName(fullName)
      const title = `${name}${routeSuffix}`

      const idPart = isAdvanced ? `adv:${routeCount}` : (route ?? '__all__')
      item = {
        id: `kmb:stops:${stopIds.join(',')}:${idPart}`,
        mode: 'kmb',
        title,
        stopIds,
        routeFilterMode,
        route,
        entries: entriesForSave,
      }
    } else if (containsQuery.length >= 3) {
      const title = `Contains: ${containsQuery}${routeSuffix}`

      const idPart = isAdvanced ? `adv:${routeCount}` : (route ?? '__all__')
      item = {
        id: `kmb:contains:${containsQuery}:${idPart}:1`,
        mode: 'kmb',
        title,
        query: containsQuery,
        routeFilterMode,
        route,
        serviceType: '1',
        entries: entriesForSave,
      }
    }

    if (!item) return

    onAddFavorite(item)
    onAddRecent(item)
  }

  const isKeyphraseMode = kmbQuery?.mode === 'contains'
  const querySummary = React.useMemo<KmbPaneState['querySummary']>(() => {
    if (!kmbQuery) return null
    if (kmbQuery.mode === 'stop') return { mode: 'stop', stopId: kmbQuery.stopId }
    if (kmbQuery.mode === 'stops') return { mode: 'stops', stopIds: kmbQuery.stopIds }
    return { mode: 'contains', query: kmbQuery.query }
  }, [kmbQuery])

  // ========== OPTIMIZATION: Precompute render groups to avoid work during render ==========
  const precomputedGroups = React.useMemo<PrecomputedGroups>(() => {
    return precomputeRenderGroups(kmbEtaByStopId, loadedStopIds, kmbFaresByVariantKey)
  }, [kmbEtaByStopId, loadedStopIds, kmbFaresByVariantKey])

  const paneState = React.useMemo<KmbPaneState>(
    () => ({
      lang,
      routeFilter,
      querySummary,
      routeInfos: kmbRouteInfos,
      faresByVariantKey: kmbFaresByVariantKey,
      eta: kmbEta,
      etaByStopId: kmbEtaByStopId,
      loadedStopIds,
      loading: kmbEtaLoading,
      error: kmbEtaError,
      stale: kmbEtaStale,
      staleByStopId: kmbEtaStaleByStopId,
      lastUpdatedAt: kmbEtaLastUpdatedAt ?? undefined,
      hasQuery: Boolean(kmbQuery),
      multipleStops: kmbQuery?.mode === 'stops' || kmbQuery?.mode === 'contains',
      isKeyphraseMode: isKeyphraseMode ?? false,
      title: kmbResultsInfo.title,
      stopCode: kmbResultsInfo.code,
      stops: kmbStops,
      refresh: (options) => refreshKmbEta(kmbQuery, options),
      sentinelRef: infiniteScroll.sentinelRef,
      hasMoreStops: infiniteScroll.hasMore,
      precomputedGroups,
      visibleStopIds,
      registerStopRef,
    }),
    [
      kmbEta,
      kmbEtaByStopId,
      kmbFaresByVariantKey,
      loadedStopIds,
      kmbEtaLoading,
      kmbEtaError,
      kmbEtaLastUpdatedAt,
      kmbEtaStale,
      kmbEtaStaleByStopId,
      kmbQuery,
      kmbResultsInfo.code,
      kmbResultsInfo.title,
      kmbRouteInfos,
      kmbStops,
      lang,
      querySummary,
      refreshKmbEta,
      routeFilter,
      isKeyphraseMode,
      infiniteScroll.sentinelRef,
      infiniteScroll.hasMore,
      precomputedGroups,
      visibleStopIds,
      registerStopRef,
    ]
  )

  React.useEffect(() => {
    onStateChange?.(paneState)
  }, [onStateChange, paneState])

  return (
    <div className="space-y-4">
      <StopSearch
        lang={lang}
        stops={kmbStops}
        value={kmbDraftStopSelection}
        onSelectStop={(stop) => {
          setKmbDraftStopSelection({ type: 'stop', stopId: stop.stopId })
          onAddRecent({
            id: `kmb:${stop.stopId}:__stop__`,
            mode: 'kmb',
            title: pickKmbStopTitle(stop, lang),
            stopId: stop.stopId,
          })
        }}
        onSelectStops={(stops) => {
          const stopIds = stops.map((s) => s.stopId)
          setKmbDraftStopSelection({ type: 'stops', stopIds })
          if (stops.length > 0) {
            const firstStop = stops[0]!
            const fullName = pickKmbStopTitle(firstStop, lang)
            const { name } = parseKmbStopName(fullName)
            const firstStopId = stopIds[0]!
            onAddRecent({
              id: `kmb:${stopIds.join(',')}:__stops__`,
              mode: 'kmb',
              title: name,
              stopId: firstStopId,
            })
          }
        }}
        onSelectContains={(query) => {
          setKmbDraftStopSelection({ type: 'contains', query })
        }}
      />

      {isMobile ? (
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => setFilterExpanded(!filterExpanded)}
            className="bg-card/50 flex w-full items-center justify-between rounded-2xl border p-4 text-left"
            aria-expanded={filterExpanded}
          >
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">
                {lang === 'en' ? 'Route Filter' : '路線篩選'}
              </span>
              {activeFilterCount > 0 && (
                <Badge variant="secondary" className="rounded-lg px-2 py-0.5 text-xs">
                  {activeFilterCount}
                </Badge>
              )}
            </div>
            {filterExpanded ? (
              <ChevronUp className="text-muted-foreground h-4 w-4" />
            ) : (
              <ChevronDown className="text-muted-foreground h-4 w-4" />
            )}
          </button>

          <div
            className={cn(
              'grid transition-all duration-200 ease-in-out',
              filterExpanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
            )}
          >
            <div className="overflow-hidden">
              <RouteFilter
                lang={lang}
                mode={routeFilterMode}
                onModeChange={onRouteFilterModeChange}
                value={routeFilter}
                options={kmbRouteStops.length ? kmbAvailableRouteVariants : []}
                onChange={(next) => setRouteFilter(next)}
              />
            </div>
          </div>
        </div>
      ) : (
        <RouteFilter
          lang={lang}
          mode={routeFilterMode}
          onModeChange={onRouteFilterModeChange}
          value={routeFilter}
          options={kmbRouteStops.length ? kmbAvailableRouteVariants : []}
          onChange={(next) => setRouteFilter(next)}
        />
      )}

      {stopsError ? (
        <div className="bg-background/40 text-destructive rounded-2xl border p-3 text-sm">
          {stopsError}
        </div>
      ) : null}

      {routeStopsError ? (
        <div className="bg-background/40 text-destructive rounded-2xl border p-3 text-sm">
          {routeStopsError}
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-2">
        <Badge variant="secondary" className="rounded-xl">
          {loadingStops || loadingRouteStops
            ? lang === 'en'
              ? 'Indexing data…'
              : lang === 'sc'
                ? '正在索引數據…'
                : '正在索引數據…'
            : `${kmbStops.length.toLocaleString()} ${
                lang === 'en' ? 'stops' : '個車站'
              } · ${kmbRouteStops.length.toLocaleString()} ${
                lang === 'en' ? 'route-stops' : '個路線車站'
              }`}
        </Badge>
        <Button
          size="sm"
          variant="outline"
          className="rounded-xl"
          onClick={() => void refreshKmbEta(kmbQuery, { toastOnError: true })}
        >
          <RefreshCw className={cn('mr-2 h-4 w-4', kmbEtaLoading && 'ui-spin')} />
          {lang === 'en' ? 'Refresh' : '重新整理'}
        </Button>
      </div>

      <Separator />

      <div className="flex items-center justify-between gap-2">
        <Button
          className={cn('rounded-xl', !canFavorite && 'opacity-60')}
          disabled={!canFavorite}
          onClick={onSave}
        >
          {lang === 'en' ? 'Save' : '收藏'}
        </Button>
      </div>
    </div>
  )
}
