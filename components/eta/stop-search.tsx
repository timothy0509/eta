'use client'

import { MapPin, Search } from 'lucide-react'
import * as React from 'react'

import { CommandItem } from '@/components/ui/command'
import { StationSearchCombobox } from '@/components/eta/station-search-combobox'
import { RouteBadge } from '@/components/eta/route-badge'
import type { StopSearchIndex } from '@/components/eta/panes/kmb-stop-search'
import {
  areCodesSequential,
  createStopSearchSession,
  formatCodeRange,
  groupStopsByName,
  searchStopGroups,
  type StopGroup,
  type StopSearchDoc,
  type StopSearchSession,
  type StopSearchWorkerEvent,
} from '@/lib/eta/stop-search-pipeline'
import { formatKmbStopSecondary, parseKmbStopNameCached } from '@/lib/eta/kmb-stop-name'
import { useTranslations } from '@/lib/eta/i18n'
import { pickLang } from '@/lib/eta/pick-lang'
import {
  getRoutesForStopIds,
  sliceStopRoutesForDisplay,
  type StopRouteBadge,
} from '@/lib/eta/stop-routes'
import { isKmbStop } from '@/lib/eta/types'
import type { KmbStopSearchItem, UiLanguage } from '@/lib/eta/types'

export type StopSearchSelection =
  | { type: 'stop'; stopId: string }
  | { type: 'stops'; stopIds: string[] }
  | { type: 'contains'; query: string }

type Props = {
  lang: UiLanguage
  stops: KmbStopSearchItem[]
  value?: StopSearchSelection
  onSelectStop: (stop: KmbStopSearchItem) => void
  onSelectStops: (stops: KmbStopSearchItem[]) => void
  onSelectContains: (query: string) => void
  /** stopId -> distinct routes, built once per route-stop load in the pane. */
  stopRoutesById?: Map<string, StopRouteBadge[]>
  /** Settings operator for joint-route badge colors. */
  preferredJointOperator?: string | null
}

type StopComputed = StopSearchDoc

// --- Utility functions for stop name/code parsing ---

function formatStopName(stop: KmbStopSearchItem, lang: UiLanguage) {
  return pickLang({ en: stop.nameEn, tc: stop.nameTc, sc: stop.nameSc }, lang)
}

function StopRouteBadges({
  stopIds,
  stopRoutesById,
  preferredJointOperator,
}: {
  stopIds: string[]
  stopRoutesById?: Map<string, StopRouteBadge[]>
  preferredJointOperator?: string | null
}) {
  if (!stopRoutesById) return null
  // Unioning a few stops' badge lists is microseconds; the full-table
  // index above is what stays memoized.
  const { visible, overflow } = sliceStopRoutesForDisplay(
    getRoutesForStopIds(stopRoutesById, stopIds, preferredJointOperator)
  )
  if (!visible.length) return null
  return (
    <div className="flex basis-full flex-wrap gap-1 pl-12 sm:mt-0 sm:max-w-[55%] sm:basis-auto sm:content-start sm:justify-end sm:pl-0">
      {visible.map((badge) => (
        <RouteBadge
          key={`${badge.co}:${badge.route}`}
          route={badge.route}
          company={badge.co}
          size="sm"
        />
      ))}
      {overflow > 0 ? (
        <span className="border-outline-variant/30 bg-surface-container text-on-surface-variant inline-flex shrink-0 items-center justify-center rounded-lg border px-2 py-0.5 text-xs font-semibold whitespace-nowrap">
          +{overflow}
        </span>
      ) : null}
    </div>
  )
}

export function StopSearch({
  lang,
  stops,
  value,
  onSelectStop,
  onSelectStops,
  onSelectContains,
  searchIndex,
  stopRoutesById,
  preferredJointOperator,
}: Props & { searchIndex?: StopSearchIndex }) {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState('')
  const listId = React.useId()
  const { t } = useTranslations(lang)

  // Debounce the search query (150ms) to reduce Fuse.js invocations
  const [debouncedQuery, setDebouncedQuery] = React.useState('')
  React.useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query.trim()), 150)
    return () => clearTimeout(timer)
  }, [query])
  const isDebouncing = query.trim() !== debouncedQuery && query.trim().length > 0

  // Track if popover is open for performance optimization
  const isOpen = open

  const stopById = React.useMemo(() => {
    return new Map(stops.map((stop) => [stop.stopId, stop]))
  }, [stops])

  // Find selected stop(s) for display in the button
  const selectedLabel = React.useMemo(() => {
    if (!value) return null
    if (value.type === 'stop') {
      const stop = stopById.get(value.stopId)
      if (stop) {
        const fullName = formatStopName(stop, lang)
        const parsed = parseKmbStopNameCached(fullName, { isKmb: isKmbStop(stop), lang })
        return parsed.stopCode ? `${parsed.name} (${parsed.stopCode})` : parsed.name
      }
      return null
    }
    if (value.type === 'stops') {
      // Find first stop to get base name
      const firstStop = value.stopIds.map((stopId) => stopById.get(stopId)).find(Boolean)
      if (!firstStop) return null

      const fullName = formatStopName(firstStop, lang)
      const { name: baseName } = parseKmbStopNameCached(fullName, {
        isKmb: isKmbStop(firstStop),
        lang,
      })

      // Collect all codes for selected stops
      const codes: string[] = []
      for (const stopId of value.stopIds) {
        const stop = stopById.get(stopId)
        if (stop) {
          const parsed = parseKmbStopNameCached(formatStopName(stop, lang), {
            isKmb: isKmbStop(stop),
            lang,
          })
          if (parsed.stopCode) codes.push(parsed.stopCode)
        }
      }

      if (codes.length > 1 && areCodesSequential(codes)) {
        return `${baseName} (${formatCodeRange(codes)})`
      }
      return baseName
    }
    if (value.type === 'contains') {
      return t('common.searchContainsPrefix') + value.query
    }
    return null
  }, [value, stopById, lang, t])

  const stopComputed = React.useMemo<StopComputed[]>(() => {
    // The pane pre-parses every stop once when the language-specific index
    // is built. Fall back to the local parse only when the pane did not
    // hand one down (tests, other callers).
    return stops.map((stop) => {
      const pre = searchIndex?.computedById.get(stop.stopId)
      if (pre) return { stopId: stop.stopId, ...pre, stop }
      const fullName = formatStopName(stop, lang)
      const parsed = parseKmbStopNameCached(fullName, { isKmb: isKmbStop(stop), lang })
      const baseName = parsed.name
      const stopCode = parsed.stopCode
      const displayName = baseName
      const displaySecondary = formatKmbStopSecondary(stop, lang)

      const searchName = displayName.toLowerCase().trim()
      const searchSecondary = displaySecondary.toLowerCase().trim()
      const searchCode = (stopCode ?? '').toLowerCase().trim()

      const normalized =
        `${stop.nameEn}|${stop.nameTc}|${stop.nameSc}|${baseName}|${stopCode ?? ''}`
          .toLowerCase()
          .trim()

      return {
        stopId: stop.stopId,
        baseName,
        stopCode,
        displaySecondary,
        displayName,
        searchName,
        searchSecondary,
        searchCode,
        normalized,
        stop,
      }
    })
  }, [stops, lang, searchIndex])

  // The ranking pipeline lives in `stop-search-pipeline` and runs in a
  // worker (main-thread fallback where workers are unavailable), so the
  // expensive fuzzy search never blocks typing. Both paths execute the
  // same code, so results are identical either way. Only the resulting
  // groups cross back to the UI thread.
  //
  // Cheap synchronous slices stay in render: the empty-query default and
  // the prefix-only interim shown dimmed while the worker answers (the
  // same prefix-only rows the old code showed while Fuse loaded). The
  // worker's full results land in state and take over once live.
  const defaultGroups = React.useMemo(
    () => groupStopsByName(stopComputed.slice(0, 30)).slice(0, 12),
    [stopComputed]
  )
  const interimGroups = React.useMemo(
    () =>
      !isOpen || !debouncedQuery.trim()
        ? null
        : searchStopGroups(stopComputed, null, debouncedQuery),
    [isOpen, debouncedQuery, stopComputed]
  )
  const [resolved, setResolved] = React.useState<{
    query: string
    docs: StopComputed[]
    groups: StopGroup[]
  } | null>(null)
  const workerRef = React.useRef<Worker | null>(null)
  const [workerFailed, setWorkerFailed] = React.useState(false)
  const workerSessionRef = React.useRef(0)
  const queryIdRef = React.useRef(0)
  const fallbackSessionRef = React.useRef<Promise<StopSearchSession> | null>(null)
  // Docs captured at send time, for tagging the matching response.
  const sendDocsRef = React.useRef<StopComputed[]>(stopComputed)
  // Docs the worker session was last built from. Compared by identity so
  // reopening with unchanged docs reuses the warm index.
  const initDocsRef = React.useRef<StopComputed[] | null>(null)

  // A response is live when it answers the current query over the current
  // docs. Docs identity is render-safe; the session counter stays inside
  // effects and handlers for worker bookkeeping.
  const liveResolved =
    resolved !== null && resolved.query === debouncedQuery && resolved.docs === stopComputed
      ? resolved
      : null
  let groupedResults: StopGroup[]
  if (!isOpen) groupedResults = []
  else if (!debouncedQuery.trim()) groupedResults = defaultGroups
  else groupedResults = liveResolved?.groups ?? interimGroups ?? []
  const showPending = isOpen && debouncedQuery.trim().length > 0 && liveResolved === null

  React.useEffect(() => {
    if (typeof Worker === 'undefined') return
    let worker: Worker | null = null
    try {
      worker = new Worker(new URL('../../lib/eta/stop-search.worker', import.meta.url))
    } catch {
      // No worker: the search effect below already falls back to the
      // main-thread session when workerRef is null.
      workerRef.current = null
      return
    }
    workerRef.current = worker
    worker.onmessage = (event: MessageEvent<StopSearchWorkerEvent>) => {
      const msg = event.data
      if (msg.session !== workerSessionRef.current || msg.id !== queryIdRef.current) return
      setResolved({ query: msg.query, docs: sendDocsRef.current, groups: msg.groups })
    }
    worker.onerror = () => {
      try {
        worker?.terminate()
      } catch {
        // Termination is best effort; the fallback covers the query.
      }
      if (workerRef.current === worker) workerRef.current = null
      workerSessionRef.current += 1
      setWorkerFailed(true)
    }
    const active = worker
    return () => {
      active.terminate()
      if (workerRef.current === active) workerRef.current = null
    }
  }, [])

  // Build the search session lazily on first open and rebuild it when the
  // docs change while open, matching the old Fuse lifecycle (never built
  // until the popover opens). The worker builds off-thread; the fallback
  // session is rebuilt lazily on the next search instead.
  React.useEffect(() => {
    if (!isOpen) return
    if (initDocsRef.current === stopComputed) return
    initDocsRef.current = stopComputed
    workerSessionRef.current += 1
    fallbackSessionRef.current = null
    const worker = workerRef.current
    if (worker) {
      worker.postMessage({
        type: 'init',
        session: workerSessionRef.current,
        docs: stopComputed,
      })
    }
  }, [stopComputed, isOpen])

  // Ask the worker (or the fallback) for full results. Render already
  // shows the interim rows, so this effect only sends and never sets
  // state synchronously.
  React.useEffect(() => {
    if (!isOpen || !debouncedQuery.trim()) return

    const session = workerSessionRef.current
    queryIdRef.current += 1
    const id = queryIdRef.current
    const query = debouncedQuery
    sendDocsRef.current = stopComputed

    const worker = workerFailed ? null : workerRef.current
    if (worker) {
      try {
        worker.postMessage({ type: 'search', session, id, query })
        return
      } catch {
        // Posting failed: drop the dead worker and fall through to the
        // main-thread session with the same session id.
        if (workerRef.current === worker) workerRef.current = null
      }
    }

    if (!fallbackSessionRef.current) {
      fallbackSessionRef.current = createStopSearchSession(stopComputed)
    }
    const docs = stopComputed
    let cancelled = false
    const answer = (groups: StopGroup[]): void => {
      if (cancelled || session !== workerSessionRef.current || id !== queryIdRef.current) return
      setResolved({ query, docs, groups })
    }
    void fallbackSessionRef.current.then(
      (fallback) => answer(fallback.search(query)),
      // Fuse chunk failed to load: prefix-only results, like the old
      // `fuse === null` branch, so the UI never waits forever.
      () => answer(searchStopGroups(docs, null, query))
    )
    return () => {
      cancelled = true
    }
  }, [isOpen, debouncedQuery, stopComputed, workerFailed])

  const trimmedQuery = query.trim()
  const canSearchContains = trimmedQuery.length >= 3

  const handleSelectGroup = React.useCallback(
    (group: StopGroup) => {
      if (group.stops.length === 1) {
        onSelectStop(group.stops[0])
      } else {
        onSelectStops(group.stops)
      }
      setOpen(false)
    },
    [onSelectStop, onSelectStops]
  )

  return (
    <StationSearchCombobox
      open={open}
      onOpenChange={setOpen}
      listId={listId}
      triggerLabel={selectedLabel}
      triggerPlaceholder={t('common.searchStopTrigger')}
      inputPlaceholder={t('common.searchStopInput')}
      inputAriaLabel={t('common.searchStopAria')}
      query={query}
      onQueryChange={setQuery}
      emptyText={t('common.noResults')}
      groupHeading={t('common.searchGroupStops')}
      listClassName={isDebouncing || showPending ? 'opacity-60 transition-opacity' : undefined}
    >
      {canSearchContains ? (
        <CommandItem
          key={`contains:${trimmedQuery}`}
          value={`contains:${trimmedQuery}`}
          onSelect={() => {
            onSelectContains(trimmedQuery)
            setOpen(false)
          }}
          className="m3-body-md hover:bg-surface-container-high data-[selected=true]:bg-primary-container/20 mx-2 flex items-start gap-3 rounded-2xl px-3 py-3"
        >
          <div className="bg-surface text-on-surface-variant mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full">
            <Search className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="text-on-surface truncate font-medium">
              {t('common.searchContainsPrefix') + trimmedQuery}
            </div>
            <div className="text-on-surface-variant m3-label-md truncate">
              {t('common.searchContainsHint')}
            </div>
          </div>
        </CommandItem>
      ) : trimmedQuery.length ? (
        <div className="text-on-surface-variant m3-label-md px-3 py-1">
          {t('common.searchContainsHelp')}
        </div>
      ) : null}

      {groupedResults.map((group) => (
        <CommandItem
          key={group.id}
          value={group.id}
          onSelect={() => handleSelectGroup(group)}
          className="m3-body-md hover:bg-surface-container-high data-[selected=true]:bg-primary-container/20 mx-2 flex flex-wrap items-start gap-3 rounded-2xl px-3 py-3 sm:flex-nowrap"
        >
          <div className="bg-surface text-on-surface-variant mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full">
            <MapPin className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-on-surface truncate font-medium">
              {group.displayName}{' '}
              {group.displayCodes ? (
                <span className="text-on-surface-variant font-normal">{group.displayCodes}</span>
              ) : null}
            </div>
            <div className="text-on-surface-variant m3-label-md truncate">
              {group.displaySecondary}
            </div>
          </div>
          <StopRouteBadges
            stopIds={group.stops.map((s) => s.stopId)}
            stopRoutesById={stopRoutesById}
            preferredJointOperator={preferredJointOperator}
          />
        </CommandItem>
      ))}
    </StationSearchCombobox>
  )
}
