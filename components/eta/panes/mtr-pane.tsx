'use client'

import * as React from 'react'

import { MtrStationSearch } from '@/components/eta/station-search'
import { StationPane } from '@/components/eta/station-pane'
import type { MtrStationSearchItem, UiLanguage } from '@/lib/eta/types'
import { pickLangZh } from '@/lib/eta/pick-lang'
import { getMtrLineName } from '@/lib/eta/line-colors'
import { useMtrSchedule } from '@/lib/eta/use-mtr-schedule'
import type { FavoritesItem } from '@/lib/store'
import { setMtrPaneState } from '@/lib/eta/pane-store'

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
}

export function MtrPane({
  lang,
  stations,
  onAddRecent,
  onAddFavorite,
  canFavoriteRef,
  onRegisterRefresh,
  selectedItem,
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
    const name = station ? pickLangZh({ en: station.nameEn, zh: station.nameTc }, lang) : ''
    const title = station
      ? `${name} · ${station.lines.map((l) => getMtrLineName(l, lang)).join('/')}/${station.sta}`
      : `MTR · ${sta}`

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

  const refreshRef = React.useRef(refresh)
  React.useEffect(() => {
    refreshRef.current = refresh
  }, [refresh])
  const stableOnRefresh = React.useCallback(() => {
    void refreshRef.current({ toastOnError: true })
  }, [])

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
      onRefresh: stableOnRefresh,
    }),
    [error, lang, lastUpdatedAt, loading, stableOnRefresh, schedule, sta, stale, title]
  )

  React.useEffect(() => {
    onRegisterRefresh(() => refreshRef.current({ toastOnError: false }))
  }, [onRegisterRefresh])

  React.useEffect(() => {
    setMtrPaneState(paneState)
  }, [paneState])

  return (
    <StationPane
      lang={lang}
      hasSelection={Boolean(sta)}
      onSave={onSave}
      search={
        <MtrStationSearch
          lang={lang}
          stations={stations}
          selectedSta={sta}
          onSelect={(station) => {
            setSta(station.sta)
            const item: FavoritesItem = {
              id: `mtr:${station.sta}`,
              mode: 'mtr',
              title: `${pickLangZh({ en: station.nameEn, zh: station.nameTc }, lang)} · ${station.lines.map((l) => getMtrLineName(l, lang)).join('/')}/${station.sta}`,
              line: station.lines[0] ?? '',
              sta: station.sta,
            }
            onAddRecent(item)
            void refresh({ toastOnError: false })
          }}
        />
      }
    />
  )
}
