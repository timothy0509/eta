'use client'

import { CommandItem } from '@/components/ui/command'
import { StationSearchCombobox } from '@/components/eta/station-search-combobox'
import { useTranslations } from '@/lib/eta/i18n'
import type { LrtStationSearchItem, UiLanguage } from '@/lib/eta/types'
import { pickLangZh, pickSecondaryName } from '@/lib/eta/pick-lang'
import * as React from 'react'
import { TramFront } from 'lucide-react'

type LrtFuseInstance = import('fuse.js').default<LrtStationSearchItem>

type Props = {
  lang: UiLanguage
  stations: LrtStationSearchItem[]
  selectedStationId?: string
  onSelect: (station: LrtStationSearchItem) => void
}

function formatStationName(station: LrtStationSearchItem, lang: UiLanguage) {
  return pickLangZh({ en: station.nameEn, zh: station.nameZh }, lang)
}

function formatStationSecondary(station: LrtStationSearchItem, lang: UiLanguage) {
  return pickSecondaryName({ en: station.nameEn, tc: station.nameZh }, lang)
}

function isStationIdQuery(query: string) {
  return /^\d+$/.test(query.trim())
}

export function LrtStationSearch({ lang, stations, selectedStationId, onSelect }: Props) {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState('')
  const [debouncedQuery, setDebouncedQuery] = React.useState('')
  const listId = React.useId()
  const { t } = useTranslations(lang)

  React.useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query.trim()), 150)
    return () => clearTimeout(timer)
  }, [query])

  const trimmedQuery = debouncedQuery
  const showStationId = isStationIdQuery(trimmedQuery)

  const stationsById = React.useMemo(() => {
    return new Map(stations.map((station) => [station.stationId, station]))
  }, [stations])

  const selected = React.useMemo(() => {
    if (!selectedStationId) return undefined
    return stationsById.get(selectedStationId)
  }, [selectedStationId, stationsById])

  // Fuse loads only when the popover opens so the index stays out of the
  // initial bundle. ID prefix matches stay synchronous.
  const [fuse, setFuse] = React.useState<LrtFuseInstance | null>(null)
  React.useEffect(() => {
    if (!open || fuse) return
    let cancelled = false
    void import('fuse.js').then((mod) => {
      if (cancelled) return
      setFuse(
        new mod.default(stations, {
          threshold: 0.35,
          ignoreLocation: true,
          minMatchCharLength: 2,
          keys: [
            { name: 'nameEn', weight: 0.55 },
            { name: 'nameZh', weight: 0.45 },
          ],
        })
      )
    })
    return () => {
      cancelled = true
    }
  }, [open, fuse, stations])
  React.useEffect(() => {
    if (!open || !fuse) return
    fuse.setCollection(stations)
  }, [open, fuse, stations])

  const results = React.useMemo(() => {
    if (!trimmedQuery) return [] as LrtStationSearchItem[]

    if (showStationId) {
      return stations.filter((s) => s.stationId.startsWith(trimmedQuery)).slice(0, 40)
    }

    const needle = trimmedQuery.toLowerCase()
    const prefix = stations
      .filter((s) => s.nameEn.toLowerCase().startsWith(needle) || s.nameZh.startsWith(trimmedQuery))
      .slice(0, 40)
    if (prefix.length >= 20 || !fuse) return prefix

    const hits = fuse.search(trimmedQuery).slice(0, 40)
    return hits.map((h: { item: LrtStationSearchItem }) => h.item)
  }, [fuse, showStationId, stations, trimmedQuery])

  const displayResults = trimmedQuery ? results : stations.slice(0, 12)

  return (
    <StationSearchCombobox
      open={open}
      onOpenChange={setOpen}
      listId={listId}
      triggerLabel={selected ? formatStationName(selected, lang) : null}
      triggerPlaceholder={t('common.searchLrtTrigger')}
      inputPlaceholder={t('common.searchLrtInput')}
      inputAriaLabel={t('common.searchLrtAria')}
      query={query}
      onQueryChange={setQuery}
      emptyText={t('common.noResults')}
      groupHeading={t('common.searchGroupStops')}
    >
      {displayResults.map((station: LrtStationSearchItem) => (
        <CommandItem
          key={station.stationId}
          value={station.stationId}
          onSelect={() => {
            onSelect(station)
            setOpen(false)
          }}
          className="m3-body-md hover:bg-surface-container-high data-[selected=true]:bg-primary-container/20 mx-2 flex items-start gap-3 rounded-2xl px-3 py-3"
        >
          <div className="bg-surface text-on-surface-variant mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full">
            <TramFront className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-on-surface truncate font-medium">
              {formatStationName(station, lang)}
            </div>
            <div className="text-on-surface-variant m3-label-md truncate">
              {formatStationSecondary(station, lang)}
              {showStationId ? ` · ${station.stationId}` : null}
            </div>
          </div>
        </CommandItem>
      ))}
    </StationSearchCombobox>
  )
}
