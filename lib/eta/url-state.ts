import type { SubView, TransportMode, UiLanguage } from '@/lib/eta/types'
import type { FavoritesItem, RouteFilterMode } from '@/lib/store'

const SUB_VIEWS = new Set<SubView>(['routes', 'stops', 'nearby', 'saved', 'settings'])

export type KmbQuerySummary =
  | {
      mode: 'stop'
      stopId: string
    }
  | {
      mode: 'stops'
      stopIds: string[]
    }
  | {
      mode: 'contains'
      query: string
    }

export type UrlEncodeInput = {
  mode: TransportMode
  subView: SubView
  lang: UiLanguage
  routeFilterMode: RouteFilterMode
  autoRefreshSeconds: number
  kmb?: {
    query: KmbQuerySummary | null
    routeFilter?: {
      routes?: string
      entries?: { variantKey: string }[]
    } | null
  } | null
  mtr?: {
    sta: string | null
  } | null
  lrt?: {
    stationId: string | null
  } | null
}

export type UrlDecodeResult = {
  state: {
    mode?: TransportMode
    subView?: SubView
    lang?: UiLanguage
    routeFilterMode?: RouteFilterMode
    autoRefreshSeconds?: number
  }
  selectedItem: FavoritesItem | null
}

const DEFAULTS = {
  mode: 'kmb' as TransportMode,
  subView: 'stops' as SubView,
  lang: 'tc' as UiLanguage,
  routeFilterMode: 'simple' as RouteFilterMode,
  autoRefreshSeconds: 15,
}

const AUTO_REFRESH_OPTIONS = new Set([0, 10, 15, 30, 60])

function parseTransportMode(value: string | null): TransportMode | null {
  if (value === 'kmb' || value === 'mtr' || value === 'lrt') return value
  return null
}

function parseSubView(value: string | null): SubView | null {
  if (value && SUB_VIEWS.has(value as SubView)) return value as SubView
  return null
}

function parseUiLanguage(value: string | null): UiLanguage | null {
  if (value === 'en' || value === 'tc' || value === 'sc') return value
  return null
}

function parseRouteFilterMode(value: string | null): RouteFilterMode | null {
  if (value === 'simple' || value === 'advanced') return value
  return null
}

function parseAutoRefreshSeconds(value: string | null): number | null {
  if (!value) return null
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed)) return null
  if (!AUTO_REFRESH_OPTIONS.has(parsed)) return null
  return parsed
}

function parseCommaList(value: string | null): string[] {
  if (!value) return []
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
}

function normalizeVariantKeys(entries: string[]): string[] {
  return entries
    .map((entry) => {
      if (!entry) return ''
      const parts = entry.split('|')
      if (parts.length === 3) return `kmb|${entry}`
      if (parts.length === 4) return entry
      // Invalid format: ensure this entry is filtered out
      return ''
    })
    .filter(Boolean)
}

function buildKmbSelectedItem(input: {
  query: KmbQuerySummary
  route?: string | null
  routeFilterMode: RouteFilterMode
  entries?: { variantKey: string }[] | null
}): FavoritesItem {
  const queryToken =
    input.query.mode === 'stop'
      ? input.query.stopId
      : input.query.mode === 'stops'
        ? input.query.stopIds.join(',')
        : input.query.query

  const routeToken =
    input.routeFilterMode === 'advanced'
      ? (input.entries ?? [])
          .map((entry) => entry.variantKey)
          .filter(Boolean)
          .join(',')
      : (input.route ?? '')

  const idSuffix = routeToken ? `:${routeToken}` : ':all'
  const id = `url:kmb:${input.query.mode}:${queryToken}${idSuffix}`

  const base = {
    id,
    mode: 'kmb' as const,
    title: 'Shared search',
    routeFilterMode: input.routeFilterMode,
    entries: input.routeFilterMode === 'advanced' ? (input.entries ?? []) : undefined,
    route: input.routeFilterMode === 'simple' ? (input.route ?? undefined) : undefined,
  }

  if (input.query.mode === 'stop') {
    return {
      ...base,
      stopId: input.query.stopId,
    }
  }

  if (input.query.mode === 'stops') {
    return {
      ...base,
      stopIds: input.query.stopIds,
    }
  }

  return {
    ...base,
    query: input.query.query,
  }
}

export function decodeUrlState(search: string): UrlDecodeResult {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)

  const explicitMode = parseTransportMode(params.get('m'))
  const subView = parseSubView(params.get('v'))
  const lang = parseUiLanguage(params.get('l'))
  const routeFilterModeParam = parseRouteFilterMode(params.get('rfm'))
  const autoRefreshSeconds = parseAutoRefreshSeconds(params.get('ar'))

  const kmbMode = params.get('km')
  const kmbRoute = params.get('kr')
  const kmbEntries = normalizeVariantKeys(parseCommaList(params.get('ke'))).map((variantKey) => ({
    variantKey,
  }))

  let kmbQuery: KmbQuerySummary | null = null
  if (kmbMode === 'stop') {
    const stopId = params.get('ks')
    if (stopId) kmbQuery = { mode: 'stop', stopId }
  } else if (kmbMode === 'stops') {
    const stopIds = parseCommaList(params.get('kss'))
    if (stopIds.length) kmbQuery = { mode: 'stops', stopIds }
  } else if (kmbMode === 'contains') {
    const query = params.get('kq')
    if (query) kmbQuery = { mode: 'contains', query }
  }

  const mtrSta = params.get('ms')
  const lrtStationId = params.get('ls')

  const inferredMode: TransportMode | null =
    explicitMode ?? (mtrSta ? 'mtr' : lrtStationId ? 'lrt' : kmbQuery ? 'kmb' : null)

  const state: UrlDecodeResult['state'] = {}
  if (inferredMode) state.mode = inferredMode
  if (subView) state.subView = subView
  if (lang) state.lang = lang
  if (autoRefreshSeconds !== null) state.autoRefreshSeconds = autoRefreshSeconds

  const derivedRouteFilterMode = routeFilterModeParam ?? (kmbEntries.length ? 'advanced' : null)
  if (derivedRouteFilterMode) state.routeFilterMode = derivedRouteFilterMode

  let selectedItem: FavoritesItem | null = null

  if (inferredMode === 'kmb' && kmbQuery) {
    const filterMode = derivedRouteFilterMode ?? DEFAULTS.routeFilterMode
    selectedItem = buildKmbSelectedItem({
      query: kmbQuery,
      route: kmbRoute,
      routeFilterMode: filterMode,
      entries: kmbEntries,
    })
  } else if (inferredMode === 'mtr' && mtrSta) {
    selectedItem = {
      id: `url:mtr:${mtrSta}`,
      mode: 'mtr',
      title: 'Shared search',
      line: '',
      sta: mtrSta,
    }
  } else if (inferredMode === 'lrt' && lrtStationId) {
    selectedItem = {
      id: `url:lrt:${lrtStationId}`,
      mode: 'lrt',
      title: 'Shared search',
      stationId: lrtStationId,
    }
  }

  return { state, selectedItem }
}

export function encodeUrlState(input: UrlEncodeInput): string {
  const params = new URLSearchParams()

  if (input.mode !== DEFAULTS.mode) params.set('m', input.mode)
  if (input.subView !== DEFAULTS.subView) params.set('v', input.subView)
  if (input.lang !== DEFAULTS.lang) params.set('l', input.lang)
  if (input.routeFilterMode !== DEFAULTS.routeFilterMode) {
    params.set('rfm', input.routeFilterMode)
  }
  if (input.autoRefreshSeconds !== DEFAULTS.autoRefreshSeconds) {
    params.set('ar', String(input.autoRefreshSeconds))
  }

  if (input.mode === 'kmb' && input.kmb?.query) {
    const { query, routeFilter } = input.kmb
    params.set('km', query.mode)
    if (query.mode === 'stop') {
      params.set('ks', query.stopId)
    } else if (query.mode === 'stops') {
      if (query.stopIds.length) params.set('kss', query.stopIds.join(','))
    } else if (query.mode === 'contains') {
      if (query.query) params.set('kq', query.query)
    }

    if (input.routeFilterMode === 'advanced') {
      const entries = routeFilter?.entries ?? []
      if (entries.length) {
        const normalized = entries.map((entry) => {
          const key = entry.variantKey
          if (!key) return ''
          const parts = key.split('|')
          return parts.length === 4 ? parts.slice(1).join('|') : key
        })
        const compact = normalized.filter(Boolean).join(',')
        if (compact) params.set('ke', compact)
      }
    } else {
      const routes = routeFilter?.routes?.trim()
      if (routes) params.set('kr', routes)
    }
  }

  if (input.mode === 'mtr' && input.mtr?.sta) {
    params.set('ms', input.mtr.sta)
  }

  if (input.mode === 'lrt' && input.lrt?.stationId) {
    params.set('ls', input.lrt.stationId)
  }

  return params.toString()
}
