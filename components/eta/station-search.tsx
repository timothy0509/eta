'use client'

import { TrainFront } from 'lucide-react'
import * as React from 'react'

import { CommandItem } from '@/components/ui/command'
import { StationSearchCombobox } from '@/components/eta/station-search-combobox'
import { useTranslations } from '@/lib/eta/i18n'
import type { MtrStationSearchItem, UiLanguage } from '@/lib/eta/types'
import { pickLangZh, pickSecondaryName } from '@/lib/eta/pick-lang'
import { getMtrLineName } from '@/lib/eta/line-colors'

type MtrFuseInstance = import('fuse.js').default<MtrStationSearchItem>

type Props = {
  lang: UiLanguage
  stations: MtrStationSearchItem[]
  selectedSta?: string
  onSelect: (station: MtrStationSearchItem) => void
}

function formatStationName(station: MtrStationSearchItem, lang: UiLanguage) {
  return pickLangZh({ en: station.nameEn, zh: station.nameTc }, lang)
}

function formatStationSecondary(station: MtrStationSearchItem, lang: UiLanguage) {
  return pickSecondaryName({ en: station.nameEn, tc: station.nameTc }, lang)
}

function isStationCodeQuery(query: string) {
  return /^[A-Z]{3}$/i.test(query.trim())
}

export function MtrStationSearch({ lang, stations, selectedSta, onSelect }: Props) {
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
  const showStationCode = isStationCodeQuery(trimmedQuery)

  const stationsById = React.useMemo(() => {
    return new Map(stations.map((station) => [station.sta, station]))
  }, [stations])

  const selectedStation = React.useMemo(() => {
    if (!selectedSta) return undefined
    return stationsById.get(selectedSta)
  }, [selectedSta, stationsById])

  // Fuse loads only when the popover opens so the index stays out of the
  // initial bundle. Code prefix matches stay synchronous.
  const [fuse, setFuse] = React.useState<MtrFuseInstance | null>(null)
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
            { name: 'nameTc', weight: 0.45 },
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
    if (!trimmedQuery) return [] as MtrStationSearchItem[]

    if (showStationCode) {
      return stations
        .filter((s) => s.sta.toUpperCase().startsWith(trimmedQuery.toUpperCase()))
        .slice(0, 40)
    }

    const needle = trimmedQuery.toLowerCase()
    const prefix = stations
      .filter((s) => s.nameEn.toLowerCase().startsWith(needle) || s.nameTc.startsWith(trimmedQuery))
      .slice(0, 40)
    if (prefix.length >= 20 || !fuse) return prefix

    const hits = fuse.search(trimmedQuery).slice(0, 40)
    return hits.map((h: { item: MtrStationSearchItem }) => h.item)
  }, [fuse, showStationCode, stations, trimmedQuery])

  const displayResults = React.useMemo(() => {
    return trimmedQuery ? results : stations.slice(0, 12)
  }, [results, stations, trimmedQuery])

  return (
    <StationSearchCombobox
      open={open}
      onOpenChange={setOpen}
      listId={listId}
      triggerLabel={selectedStation ? formatStationName(selectedStation, lang) : null}
      triggerPlaceholder={t('common.searchStationTrigger')}
      inputPlaceholder={t('common.searchStationInput')}
      inputAriaLabel={t('common.searchStationAria')}
      query={query}
      onQueryChange={setQuery}
      emptyText={t('common.noResults')}
      groupHeading={t('common.searchGroupStations')}
    >
      {displayResults.map((station: MtrStationSearchItem) => (
        <CommandItem
          key={station.labelId}
          value={station.labelId}
          onSelect={() => {
            onSelect(station)
            setOpen(false)
          }}
          className="m3-body-md hover:bg-surface-container-high data-[selected=true]:bg-primary-container/20 mx-2 flex items-start gap-3 rounded-2xl px-3 py-3"
        >
          <div className="bg-surface text-on-surface-variant mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full">
            <TrainFront className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-on-surface truncate font-medium">
              {formatStationName(station, lang)}
            </div>
            <div className="text-on-surface-variant m3-label-md truncate">
              {formatStationSecondary(station, lang)}
              {` · ${t('common.stationLines')}: ${station.lines.map((l) => getMtrLineName(l, lang)).join('/')}`}
              {showStationCode ? ` · ${t('common.stationCode')}: ${station.sta}` : null}
            </div>
          </div>
        </CommandItem>
      ))}
    </StationSearchCombobox>
  )
}
