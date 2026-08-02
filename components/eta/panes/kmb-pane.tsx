'use client'

import { Heart, Loader2 } from 'lucide-react'
import * as React from 'react'

import {
  RouteFilter,
  type RouteFilterOption,
  type RouteFilterState,
} from '@/components/eta/route-filter'
import { StopSearch, type StopSearchSelection } from '@/components/eta/stop-search'
import { Button } from '@/components/ui/button'
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
import { parseKmbStopNameCached } from '@/lib/eta/kmb-stop-name'
import type { KmbStopSearchItem, UiLanguage } from '@/lib/eta/types'
import type { Company } from 'hk-bus-eta'
import { useInfiniteScroll, useVisibleItems } from '@/lib/eta/use-infinite-scroll'
import type { FavoritesItem, RouteFilterMode } from '@/lib/store'
import { precomputeRenderGroups, type PrecomputedGroups } from '@/lib/eta/kmb-eta-groups'
import { initialEtaState, etaReducer } from '@/components/eta/panes/kmb-reducer'
import {
  buildKmbQueryFromDraft,
  buildRouteFilterString,
  getVariantKeysForStops,
  hasKmbQueryContextChanged,
  type KmbQuery,
  type KmbQueryContext,
} from '@/components/eta/panes/use-kmb-route-filter'
import {
  buildStopSearchIndex,
  searchStopsByContains,
  type StopSearchIndex,
} from '@/components/eta/panes/kmb-stop-search'
import { useKmbSave } from '@/components/eta/panes/use-kmb-save'
import { usePaneStore } from '@/lib/eta/pane-store'

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
}

function isKmbRouteFavorite(
  item: FavoritesItem
): item is Extract<FavoritesItem, { mode: 'kmb'; type: 'route' }> {
  return item.mode === 'kmb' && 'type' in item && item.type === 'route'
}

function pickKmbStopTitle(stop: KmbStopSearchItem, lang: UiLanguage) {
  if (lang === 'en') return stop.nameEn
  if (lang === 'sc') return stop.nameSc
  return stop.nameTc
}

/** Stops per page for infinite scroll */
const STOPS_PER_PAGE = 10

type RouteStopIndex = {
  byStopId: Map<string, Set<string>>
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

  // Compute all stop IDs for the current query
  const allStopIds = React.useMemo(() => {
    if (!kmbQuery) return []
    if (kmbQuery.mode === 'stop') return [kmbQuery.stopId]
    if (kmbQuery.mode === 'stops') return kmbQuery.stopIds
    if (kmbQuery.mode === 'contains') {
      const trimmed = kmbQuery.query.trim()
      if (trimmed.length < 3) return []
      return searchStopsByContains(kmbStops, stopSearchIndex, trimmed)
    }
    return []
  }, [kmbQuery, kmbStops, stopSearchIndex])

  // Infinite scroll hook for keyphrase mode
  const infiniteScroll = useInfiniteScroll({
    totalItems: allStopIds.length,
    initialPageSize: STOPS_PER_PAGE,
    pageSize: STOPS_PER_PAGE,
    rootMargin: '300px',
  })
  const infiniteScrollResetRef = React.useRef(infiniteScroll.reset)
  React.useEffect(() => {
    infiniteScrollResetRef.current = infiniteScroll.reset
  }, [infiniteScroll.reset])

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

    return searchStopsByContains(kmbStops, stopSearchIndex, trimmed).slice(0, 20)
  }, [kmbDraftStopSelection, kmbStops, stopSearchIndex])

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

    const missing = variantKeys.filter((key) => !kmbRouteInfos[key]).slice(0, 30)
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
    if (!(routeFilter.entries ?? []).length) return
    if (!kmbRouteStops.length) return

    const nextEntries = (routeFilter.entries ?? []).filter((entry) =>
      kmbAvailableRouteVariants.some((opt) => opt.key === entry.variantKey)
    )

    if (nextEntries.length === (routeFilter.entries ?? []).length) return

    const id = setTimeout(() => {
      setRouteFilter((prev) => ({ ...prev, entries: nextEntries }))
      setKmbQuery(null)
      dispatchEta({ type: 'RESET' })
    }, 0)
    return () => clearTimeout(id)
  }, [kmbAvailableRouteVariants, kmbRouteStops.length, routeFilter.entries])

  // AbortController for cancelling in-flight requests
  const abortControllerRef = React.useRef<AbortController | null>(null)

  // Coordination ref to prevent overlapping refresh triggers from multiple effects
  const pendingRefreshTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  const getRouteFilterString = React.useCallback(
    (query: KmbQuery) => {
      return buildRouteFilterString(routeFilter, routeFilterMode, query.route)
    },
    [routeFilter, routeFilterMode]
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

      // Apply variant filter client-side when direction-specific entries are selected
      const currentFilterEntries = routeFilterEntriesRef.current ?? []
      const variantFilterKeys = currentFilterEntries.length
        ? new Set(currentFilterEntries.map((e) => e.variantKey).filter(Boolean))
        : null

      const filteredByStopId: Record<string, KmbEtaEntryWithLeg[]> = {}
      for (const stopId of stopIds) {
        let etas = result.byStopId[stopId] ?? []
        if (variantFilterKeys) {
          etas = etas.filter((eta) => {
            // Use base key (without leg) for variant filter matching
            const key = `${String(eta.co ?? 'kmb')}|${(eta.route ?? '').toUpperCase()}|${eta.dir}|${String(eta.service_type)}`
            return variantFilterKeys.has(key)
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

      // Resolve stop IDs for contains mode
      const queryStopIds =
        query.mode === 'stop'
          ? [query.stopId]
          : query.mode === 'stops'
            ? query.stopIds
            : (() => {
                const trimmed = query.query.trim()
                if (trimmed.length < 3) return []
                return searchStopsByContains(kmbStops, stopSearchIndex, trimmed)
              })()

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
      kmbStops,
      stopSearchIndex,
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
    if (!selectedItem || selectedItem.mode !== 'kmb') {
      lastSelectedIdRef.current = null
      return
    }
    if (isKmbRouteFavorite(selectedItem)) return
    if (selectedItem.id === lastSelectedIdRef.current) return

    const nextRouteFilterMode = selectedItem.routeFilterMode ?? 'simple'
    const restoredEntries = (selectedItem.entries ?? []).map((entry, idx) => ({
      id: `restored-${idx}`,
      variantKey:
        entry.variantKey.split('|').length === 3 ? `kmb|${entry.variantKey}` : entry.variantKey,
    }))

    const nextDraftSelection =
      'stopId' in selectedItem
        ? { type: 'stop' as const, stopId: selectedItem.stopId }
        : 'stopIds' in selectedItem
          ? { type: 'stops' as const, stopIds: selectedItem.stopIds }
          : 'query' in selectedItem
            ? { type: 'contains' as const, query: selectedItem.query }
            : null

    let cancelled = false
    queueMicrotask(() => {
      if (cancelled) return

      if (nextRouteFilterMode !== routeFilterMode) {
        onRouteFilterModeChange(nextRouteFilterMode)
      }
      setRouteFilter({
        routes: selectedItem.route ?? '',
        entries: restoredEntries,
      })
      if (nextDraftSelection) {
        setKmbDraftStopSelection(nextDraftSelection)
      }
      setKmbQuery(null)
      dispatchEta({ type: 'RESET' })
      infiniteScrollResetRef.current()
      lastSelectedIdRef.current = selectedItem.id
    })

    return () => {
      cancelled = true
    }
  }, [onRouteFilterModeChange, routeFilterMode, selectedItem])

  const prevQueryContextRef = React.useRef<KmbQueryContext | undefined>(undefined)
  React.useEffect(() => {
    if (!kmbDraftStopSelection) return
    if (!kmbRouteStops.length) return

    const currentContext: KmbQueryContext = {
      selection: kmbDraftStopSelection,
      routeFilter,
      routeFilterMode,
    }
    const prev = prevQueryContextRef.current
    prevQueryContextRef.current = currentContext

    if (!hasKmbQueryContextChanged(prev, currentContext)) return

    const nextQuery = buildKmbQueryFromDraft(kmbDraftStopSelection, routeFilter, routeFilterMode)

    dispatchEta({ type: 'RESET' })
    infiniteScrollResetRef.current()

    setKmbQuery(nextQuery)
    void refreshKmbEtaRef.current(nextQuery, { toastOnError: false, isInitialLoad: true })
  }, [
    kmbDraftStopSelection,
    kmbRouteStops.length,
    routeFilter,
    routeFilterMode,
    routeFilter.entries,
  ])

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
        const parsed = parseKmbStopNameCached(fullName)
        return { title: parsed.name, code: parsed.stopCode }
      }
      return { title: `Stop ${kmbQuery.stopId}`, code: null }
    }
    if (kmbQuery.mode === 'stops') {
      const firstStop = kmbQuery.stopIds.map((stopId) => kmbStopsById.get(stopId)).find(Boolean)
      if (firstStop) {
        const fullName = pickKmbStopTitle(firstStop, lang)
        const parsed = parseKmbStopNameCached(fullName)
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

  const onSave = useKmbSave({
    lang,
    routeFilterMode,
    routeFilter,
    kmbQuery,
    kmbDraftStopSelection,
    kmbStopsById,
    canFavorite: Boolean(canFavorite),
    onAddFavorite,
    onAddRecent,
  })

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
    usePaneStore.setState({ kmb: paneState })
  }, [paneState])

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
            const { name } = parseKmbStopNameCached(fullName)
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

      <RouteFilter
        lang={lang}
        mode={routeFilterMode}
        onModeChange={onRouteFilterModeChange}
        value={routeFilter}
        options={kmbRouteStops.length ? kmbAvailableRouteVariants : []}
        onChange={(next) => setRouteFilter(next)}
      />

      {stopsError ? <p className="text-error m3-body-md">{stopsError}</p> : null}
      {routeStopsError ? <p className="text-error m3-body-md">{routeStopsError}</p> : null}

      <div className="flex items-center justify-between gap-3 pt-1">
        <Button size="sm" className="rounded-full" disabled={!canFavorite} onClick={onSave}>
          <Heart className="mr-1.5 h-4 w-4" />
          {lang === 'en' ? 'Save' : '收藏'}
        </Button>
        <span className="text-on-surface-variant m3-label-md text-right">
          {loadingStops || loadingRouteStops ? (
            <span className="inline-flex items-center gap-1.5">
              <Loader2 className="h-3 w-3 animate-spin" />
              {lang === 'en' ? 'Loading…' : lang === 'sc' ? '载入中…' : '載入中…'}
            </span>
          ) : (
            `${kmbStops.length.toLocaleString()} ${lang === 'en' ? 'stops' : '個車站'} · ${kmbRouteStops.length.toLocaleString()} ${lang === 'en' ? 'route-stops' : '個路線車站'}`
          )}
        </span>
      </div>
    </div>
  )
}
