'use client'

import * as React from 'react'

import { LrtStationSearch } from '@/components/eta/lrt-stop-search'
import { StationPane } from '@/components/eta/station-pane'
import type { LrtStationSearchItem, UiLanguage } from '@/lib/eta/types'
import { pickLangZh } from '@/lib/eta/pick-lang'
import { useLrtSchedule } from '@/lib/eta/use-lrt-schedule'
import type { FavoritesItem } from '@/lib/store'
import { usePaneStore } from '@/lib/eta/pane-store'

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
}

export function LrtPane({
  lang,
  stations,
  onAddRecent,
  onAddFavorite,
  canFavoriteRef,
  onRegisterRefresh,
  selectedItem,
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
    usePaneStore.setState({ lrt: paneState })
  }, [paneState])

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
    const name = station ? pickLangZh({ en: station.nameEn, zh: station.nameZh }, lang) : ''
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
    <StationPane
      lang={lang}
      hasSelection={Boolean(stationId)}
      onSave={onSave}
      search={
        <LrtStationSearch
          lang={lang}
          stations={stations}
          selectedStationId={stationId}
          onSelect={(station) => {
            setStationId(station.stationId)
            onAddRecent({
              id: `lrt:${station.stationId}`,
              mode: 'lrt',
              title: `${pickLangZh({ en: station.nameEn, zh: station.nameZh }, lang)} · ${station.stationId}`,
              stationId: station.stationId,
            })
            void refresh({ toastOnError: false, stationId: station.stationId })
          }}
        />
      }
    />
  )
}
