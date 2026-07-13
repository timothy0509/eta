'use client'

import { Search, TrainFront } from 'lucide-react'
import * as React from 'react'

import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import type { MtrStationSearchItem, UiLanguage } from '@/lib/eta/types'
import { cn } from '@/lib/utils'
import Fuse from 'fuse.js'

type Props = {
  lang: UiLanguage
  stations: MtrStationSearchItem[]
  selectedSta?: string
  onSelect: (station: MtrStationSearchItem) => void
}

function formatStationName(station: MtrStationSearchItem, lang: UiLanguage) {
  if (lang === 'tc') return station.nameTc
  return station.nameEn
}

function formatStationSecondary(station: MtrStationSearchItem, lang: UiLanguage) {
  if (lang === 'en') return station.nameTc
  return station.nameEn
}

function isStationCodeQuery(query: string) {
  return /^[A-Z]{3}$/i.test(query.trim())
}

export function MtrStationSearch({ lang, stations, selectedSta, onSelect }: Props) {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState('')
  const listId = React.useId()

  const trimmedQuery = query.trim()
  const showStationCode = isStationCodeQuery(trimmedQuery)

  const stationsById = React.useMemo(() => {
    return new Map(stations.map((station) => [station.sta, station]))
  }, [stations])

  const selectedStation = React.useMemo(() => {
    if (!selectedSta) return undefined
    return stationsById.get(selectedSta)
  }, [selectedSta, stationsById])

  const fuse = React.useMemo(() => {
    return new Fuse(stations, {
      threshold: 0.35,
      ignoreLocation: true,
      minMatchCharLength: 2,
      keys: [
        { name: 'nameEn', weight: 0.55 },
        { name: 'nameTc', weight: 0.45 },
      ],
    })
  }, [stations])

  const results = React.useMemo(() => {
    if (!trimmedQuery) return [] as MtrStationSearchItem[]

    if (showStationCode) {
      return stations
        .filter((s) => s.sta.toUpperCase().startsWith(trimmedQuery.toUpperCase()))
        .slice(0, 40)
    }

    const hits = fuse.search(trimmedQuery).slice(0, 40)
    return hits.map((h: { item: MtrStationSearchItem }) => h.item)
  }, [fuse, showStationCode, stations, trimmedQuery])

  const displayResults = React.useMemo(() => {
    return trimmedQuery ? results : stations.slice(0, 12)
  }, [results, stations, trimmedQuery])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-controls={open ? listId : undefined}
          aria-haspopup="listbox"
          className={cn(
            'bg-surface-container-high/70 text-on-surface w-full justify-start rounded-full border-0 py-5 text-left shadow-sm',
            'hover:bg-surface-container-high',
            !selectedStation && 'text-on-surface-variant'
          )}
        >
          <Search className="text-on-surface-variant mr-2 h-4 w-4" />
          <span className="m3-body-md truncate">
            {selectedStation
              ? formatStationName(selectedStation, lang)
              : lang === 'en'
                ? 'Search station name…'
                : lang === 'sc'
                  ? '搜索车站…'
                  : '搜尋車站…'}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="bg-surface-container-low w-[min(560px,calc(100vw-2rem))] overflow-hidden rounded-2xl p-0"
        align="start"
      >
        <Command shouldFilter={false} className="rounded-none bg-transparent">
          <CommandInput
            placeholder={
              lang === 'en'
                ? 'Type a station name…'
                : lang === 'sc'
                  ? '输入车站名称…'
                  : '輸入車站名稱…'
            }
            aria-label={
              lang === 'en' ? 'Search station name' : lang === 'sc' ? '搜索车站' : '搜尋車站'
            }
            value={query}
            onValueChange={setQuery}
            className="m3-body-md border-b-0"
          />
          <CommandList id={listId} className="max-h-[400px] py-2">
            <CommandEmpty className="text-on-surface-variant m3-body-md py-8 text-center">
              {lang === 'en' ? 'No results.' : '無結果。'}
            </CommandEmpty>
            <CommandGroup
              heading={lang === 'en' ? 'Stations' : lang === 'sc' ? '车站' : '車站'}
              className="text-on-surface-variant m3-label-md px-3 pt-0 pb-2"
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
                      {` · ${lang === 'en' ? 'Lines' : lang === 'sc' ? '线路' : '路線'}: ${station.lines.join('/')}`}
                      {showStationCode
                        ? ` · ${lang === 'en' ? 'Code' : lang === 'sc' ? '代号' : '代號'}: ${station.sta}`
                        : null}
                    </div>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
