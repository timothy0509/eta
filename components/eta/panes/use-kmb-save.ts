import * as React from 'react'

import { parseKmbStopNameCached } from '@/lib/eta/kmb-stop-name'
import { translations } from '@/lib/eta/i18n'
import { pickLang } from '@/lib/eta/pick-lang'
import { isStopDropOffOnlyForVariants } from '@/lib/eta/td-bus'
import { isKmbStop } from '@/lib/eta/types'
import type { KmbRouteStopLite } from '@/lib/eta/client'
import type { KmbStopSearchItem, UiLanguage } from '@/lib/eta/types'
import type { FavoritesItem, RouteFilterMode } from '@/lib/store'
import type { RouteFilterState } from '@/components/eta/route-filter'

type KmbQuery =
  | { mode: 'stop'; stopId: string; route?: string; serviceType?: string }
  | { mode: 'stops'; stopIds: string[]; route?: string; serviceType?: string }
  | { mode: 'contains'; query: string; route?: string; serviceType?: string }

type StopSearchSelection =
  | { type: 'stop'; stopId: string }
  | { type: 'stops'; stopIds: string[] }
  | { type: 'contains'; query: string }

type UseKmbSaveOptions = {
  lang: UiLanguage
  routeFilterMode: RouteFilterMode
  routeFilter: RouteFilterState
  kmbQuery: KmbQuery | null
  kmbDraftStopSelection: StopSearchSelection | undefined
  kmbStopsById: Map<string, KmbStopSearchItem>
  /** Route-stop table for drop-off-only checks. Empty means no warning. */
  routeStops?: readonly KmbRouteStopLite[]
  canFavorite: boolean
  onAddFavorite: (item: FavoritesItem) => void
  onAddRecent: (item: FavoritesItem) => void
}

/**
 * Variant keys serving a stop, optionally restricted to the simple-mode
 * route filter. Used to decide whether the stop is drop-off only in the
 * saved context.
 */
function variantKeysForStop(
  stopId: string,
  routeStops: readonly KmbRouteStopLite[],
  entryKeys: string[] | null,
  routeFilterRoutes: Set<string> | null
): string[] {
  if (entryKeys) return entryKeys
  const needle = String(stopId ?? '').trim()
  const keys = new Set<string>()
  for (const rs of routeStops) {
    if (String(rs.stopId ?? '').trim() !== needle) continue
    if (routeFilterRoutes && !routeFilterRoutes.has(String(rs.route ?? '').toUpperCase())) {
      continue
    }
    keys.add(`${rs.co}|${String(rs.route).toUpperCase()}|${rs.bound}|${rs.serviceType}`)
  }
  return Array.from(keys)
}

export function useKmbSave({
  lang,
  routeFilterMode,
  routeFilter,
  kmbQuery,
  kmbDraftStopSelection,
  kmbStopsById,
  routeStops = [],
  canFavorite,
  onAddFavorite,
  onAddRecent,
}: UseKmbSaveOptions) {
  return React.useCallback(() => {
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
        ? ` \u00b7 ${routeCount} ${routeCount === 1 ? translations.kmb.routeSingular[lang] : translations.kmb.routes[lang]}`
        : route
          ? ` \u00b7 ${route}`
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
      const fullName = stop
        ? pickLang({ en: stop.nameEn, tc: stop.nameTc, sc: stop.nameSc }, lang)
        : translations.kmb.bus[lang]
      const { name } = parseKmbStopNameCached(fullName, {
        isKmb: isKmbStop(stop),
        lang,
      })
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
      const fullName = firstStop
        ? pickLang({ en: firstStop.nameEn, tc: firstStop.nameTc, sc: firstStop.nameSc }, lang)
        : translations.kmb.selectedStops[lang]
      const { name } = parseKmbStopNameCached(fullName, {
        isKmb: isKmbStop(firstStop),
        lang,
      })
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
      const title = `${translations.common.searchContainsPrefix[lang]}${containsQuery}${routeSuffix}`

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

    // Warn when every saved stop is drop-off only on the saved routes:
    // boarding is impossible there, so the favorite would stay empty.
    const entryKeys =
      isAdvanced && routeFilter.entries?.length
        ? routeFilter.entries.map((e) => e.variantKey)
        : null
    const routeFilterRoutes =
      !isAdvanced && route
        ? new Set(
            route
              .split(',')
              .map((r) => r.trim().toUpperCase())
              .filter(Boolean)
          )
        : null
    const savedStopIds = stopId ? [stopId] : (stopIds ?? [])
    const allDropOffOnly =
      savedStopIds.length > 0 &&
      savedStopIds.every((id) =>
        isStopDropOffOnlyForVariants(
          id,
          variantKeysForStop(id, routeStops, entryKeys, routeFilterRoutes),
          routeStops
        )
      )
    if (allDropOffOnly) {
      void import('sonner').then(({ toast }) =>
        toast.warning(translations.kmb.dropOffOnlySaveWarning[lang])
      )
    }
  }, [
    lang,
    routeFilterMode,
    routeFilter,
    kmbQuery,
    kmbDraftStopSelection,
    kmbStopsById,
    routeStops,
    canFavorite,
    onAddFavorite,
    onAddRecent,
  ])
}
