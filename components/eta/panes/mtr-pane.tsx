'use client'

import * as React from 'react'

import { MtrStationSearch } from '@/components/eta/station-search'
import { Button } from '@/components/ui/button'
import type { MtrStationSearchItem, UiLanguage } from '@/lib/eta/types'
import { useMtrSchedule } from '@/lib/eta/use-mtr-schedule'
import type { FavoritesItem } from '@/lib/store'

export type MtrPaneState = {
  title: string
  lang: UiLanguage
  sta?: string
  schedule: ReturnType<typeof useMtrSchedule>['schedule']
  error?: string | null
  stale?: boolean
  lastUpdatedAt?: number | null
  onRefresh: () => void
  loading: boolean
}

type Props = {
  lang: UiLanguage
  stations: MtrStationSearchItem[]
  onAddRecent: (item: FavoritesItem) => void
  onAddFavorite: (item: FavoritesItem) => void
  canFavoriteRef: React.MutableRefObject<boolean>
  onRegisterRefresh: (refresh: () => Promise<void>) => void
  selectedItem?: FavoritesItem | null
  onStateChange?: (state: MtrPaneState) => void
}

export function MtrPane({
  lang,
  stations,
  onAddRecent,
  onAddFavorite,
  canFavoriteRef,
  onRegisterRefresh,
  selectedItem,
  onStateChange,
}: Props) {
  const { sta, setSta, schedule, loading, refresh, title, error, stale, lastUpdatedAt } =
    useMtrSchedule({
      lang,
      stations,
    })

  React.useEffect(() => {
    if (!selectedItem || selectedItem.mode !== 'mtr') return
    setSta(selectedItem.sta)
  }, [selectedItem, setSta])

  React.useEffect(() => {
    canFavoriteRef.current = Boolean(sta)
  }, [sta, canFavoriteRef])

  const onSave = () => {
    if (!sta) return
    const station = stations.find((s) => s.sta === sta)
    const name = station ? (lang === 'en' ? station.nameEn : station.nameTc) : ''
    const title = station ? `${name} · ${station.lines.join('/')}/${station.sta}` : `MTR · ${sta}`

    const item: FavoritesItem = {
      id: `mtr:${sta}`,
      mode: 'mtr',
      title,
      line: station?.lines[0] ?? '',
      sta,
    }

    onAddFavorite(item)
    onAddRecent(item)
  }

  const paneState = React.useMemo<MtrPaneState>(
    () => ({
      title,
      lang,
      sta,
      schedule,
      loading,
      error,
      stale,
      lastUpdatedAt,
      onRefresh: () => void refresh({ toastOnError: true }),
    }),
    [error, lang, lastUpdatedAt, loading, refresh, schedule, sta, stale, title]
  )

  React.useEffect(() => {
    onRegisterRefresh(refresh)
  }, [onRegisterRefresh, refresh])

  React.useEffect(() => {
    onStateChange?.(paneState)
  }, [onStateChange, paneState])

  return (
    <div className="space-y-4">
      <MtrStationSearch
        lang={lang}
        stations={stations}
        selectedSta={sta}
        onSelect={(station) => {
          setSta(station.sta)
          const item: FavoritesItem = {
            id: `mtr:${station.sta}`,
            mode: 'mtr',
            title: `${lang === 'en' ? station.nameEn : station.nameTc} · ${station.lines.join('/')}/${station.sta}`,
            line: station.lines[0] ?? '',
            sta: station.sta,
          }
          onAddRecent(item)
          void refresh({ toastOnError: false })
        }}
      />

      <div className="flex items-center gap-2">
        <Button className="rounded-xl" onClick={() => void onSave()} disabled={!sta}>
          {lang === 'en' ? 'Save' : '收藏'}
        </Button>
      </div>
    </div>
  )
}
