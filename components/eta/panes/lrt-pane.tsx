'use client'

import * as React from 'react'

import { LrtStationSearch } from '@/components/eta/lrt-stop-search'
import { Button } from '@/components/ui/button'
import type { LrtStationSearchItem, UiLanguage } from '@/lib/eta/types'
import { useLrtSchedule } from '@/lib/eta/use-lrt-schedule'
import type { FavoritesItem } from '@/lib/store'

export type LrtPaneState = {
  title: string
  lang: UiLanguage
  stationId?: string
  schedule: ReturnType<typeof useLrtSchedule>['schedule']
  error?: string | null
  stale?: boolean
  lastUpdatedAt?: number | null
  onRefresh: () => void
  loading: boolean
}

type Props = {
  lang: UiLanguage
  stations: LrtStationSearchItem[]
  onAddRecent: (item: FavoritesItem) => void
  onAddFavorite: (item: FavoritesItem) => void
  canFavoriteRef: React.MutableRefObject<boolean>
  onRegisterRefresh: (refresh: () => Promise<void>) => void
  selectedItem?: FavoritesItem | null
  onStateChange?: (state: LrtPaneState) => void
}

export function LrtPane({
  lang,
  stations,
  onAddRecent,
  onAddFavorite,
  canFavoriteRef,
  onRegisterRefresh,
  selectedItem,
  onStateChange,
}: Props) {
  const {
    stationId,
    setStationId,
    schedule,
    loading,
    refresh,
    title,
    error,
    stale,
    lastUpdatedAt,
  } = useLrtSchedule({
    stations,
    lang,
  })

  React.useEffect(() => {
    onRegisterRefresh(refresh)
  }, [onRegisterRefresh, refresh])

  const paneState = React.useMemo<LrtPaneState>(
    () => ({
      title,
      lang,
      stationId,
      schedule,
      loading,
      error,
      stale,
      lastUpdatedAt,
      onRefresh: () => void refresh({ toastOnError: true }),
    }),
    [error, lang, lastUpdatedAt, loading, refresh, schedule, stale, stationId, title]
  )

  React.useEffect(() => {
    onStateChange?.(paneState)
  }, [onStateChange, paneState])

  React.useEffect(() => {
    if (!selectedItem || selectedItem.mode !== 'lrt') return
    setStationId(selectedItem.stationId)
  }, [selectedItem, setStationId])

  React.useEffect(() => {
    canFavoriteRef.current = Boolean(stationId)
  }, [canFavoriteRef, stationId])

  const onSave = () => {
    if (!stationId) return
    const station = stations.find((s) => s.stationId === stationId)
    const name = station ? (lang === 'en' ? station.nameEn : station.nameZh) : ''
    const title = station ? `${name} · ${station.stationId}` : `LRT · ${stationId}`

    const item: FavoritesItem = {
      id: `lrt:${stationId}`,
      mode: 'lrt',
      title,
      stationId,
    }

    onAddFavorite(item)
    onAddRecent(item)
  }

  return (
    <div className="space-y-4">
      <LrtStationSearch
        lang={lang}
        stations={stations}
        selectedStationId={stationId}
        onSelect={(station) => {
          setStationId(station.stationId)
          onAddRecent({
            id: `lrt:${station.stationId}`,
            mode: 'lrt',
            title: `${lang === 'en' ? station.nameEn : station.nameZh} · ${station.stationId}`,
            stationId: station.stationId,
          })
          void refresh({ toastOnError: false })
        }}
      />

      <div className="flex items-center gap-2">
        <Button className="rounded-xl" onClick={() => void onSave()} disabled={!stationId}>
          {lang === 'en' ? 'Save' : '收藏'}
        </Button>
      </div>
    </div>
  )
}
