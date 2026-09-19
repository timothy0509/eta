import * as React from 'react'

import { parseKmbStopNameCached } from '@/lib/eta/kmb-stop-name'
import { translations } from '@/lib/eta/i18n'
import { pickLang } from '@/lib/eta/pick-lang'
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
  canFavorite: boolean
  onAddFavorite: (item: FavoritesItem) => void
  onAddRecent: (item: FavoritesItem) => void
}

export function useKmbSave({
  lang,
  routeFilterMode,
  routeFilter,
  kmbQuery,
  kmbDraftStopSelection,
  kmbStopsById,
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
        isKmb: stop?.isKmb ?? false,
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
        isKmb: firstStop?.isKmb ?? false,
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
  }, [
    lang,
    routeFilterMode,
    routeFilter,
    kmbQuery,
    kmbDraftStopSelection,
    kmbStopsById,
    canFavorite,
    onAddFavorite,
    onAddRecent,
  ])
}
