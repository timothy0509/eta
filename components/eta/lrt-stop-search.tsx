'use client'

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import type { LrtStationSearchItem, UiLanguage } from '@/lib/eta/types'
import { cn } from '@/lib/utils'
import * as React from 'react'
import Fuse from 'fuse.js'
import { Search, TramFront } from 'lucide-react'

type Props = {
  lang: UiLanguage
  stations: LrtStationSearchItem[]
  selectedStationId?: string
  onSelect: (station: LrtStationSearchItem) => void
}

function formatStationName(station: LrtStationSearchItem, lang: UiLanguage) {
  if (lang === 'en') return station.nameEn
  return station.nameZh
}

function formatStationSecondary(station: LrtStationSearchItem, lang: UiLanguage) {
  if (lang === 'en') return station.nameZh
  return station.nameEn
}

function isStationIdQuery(query: string) {
  return /^\d+$/.test(query.trim())
}

export function LrtStationSearch({ lang, stations, selectedStationId, onSelect }: Props) {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState('')
  const listId = React.useId()

  const trimmedQuery = query.trim()
  const showStationId = isStationIdQuery(trimmedQuery)

  const stationsById = React.useMemo(() => {
    return new Map(stations.map((station) => [station.stationId, station]))
  }, [stations])

  const selected = React.useMemo(() => {
    if (!selectedStationId) return undefined
    return stationsById.get(selectedStationId)
  }, [selectedStationId, stationsById])

  const fuse = React.useMemo(() => {
    return new Fuse(stations, {
      threshold: 0.35,
      ignoreLocation: true,
      minMatchCharLength: 2,
      keys: [
        { name: 'nameEn', weight: 0.55 },
        { name: 'nameZh', weight: 0.45 },
      ],
    })
  }, [stations])

  const results = React.useMemo(() => {
    if (!trimmedQuery) return [] as LrtStationSearchItem[]

    if (showStationId) {
      return stations.filter((s) => s.stationId.startsWith(trimmedQuery)).slice(0, 40)
    }

    const hits = fuse.search(trimmedQuery).slice(0, 40)
    return hits.map((h: { item: LrtStationSearchItem }) => h.item)
  }, [fuse, showStationId, stations, trimmedQuery])

  const displayResults = trimmedQuery ? results : stations.slice(0, 12)

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
            !selected && 'text-on-surface-variant'
          )}
        >
          <Search className="text-on-surface-variant mr-2 h-4 w-4" />
          <span className="m3-body-md truncate">
            {selected
              ? formatStationName(selected, lang)
              : lang === 'en'
                ? 'Search LRT stop…'
                : lang === 'sc'
                  ? '搜索轻铁站…'
                  : '搜尋輕鐵站…'}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(560px,calc(100vw-2rem))] p-0" align="start">
        <Command shouldFilter={false} className="bg-surface-container-low rounded-2xl">
          <CommandInput
            placeholder={
              lang === 'en'
                ? 'Type a stop name…'
                : lang === 'sc'
                  ? '输入车站名称…'
                  : '輸入車站名稱…'
            }
            aria-label={
              lang === 'en' ? 'Search LRT stop' : lang === 'sc' ? '搜索轻铁站' : '搜尋輕鐵站'
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
              heading={lang === 'en' ? 'Stops' : lang === 'sc' ? '车站' : '車站'}
              className="text-on-surface-variant m3-label-md px-3 pt-0 pb-2"
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
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
