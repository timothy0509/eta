'use client'

import { Heart } from 'lucide-react'
import * as React from 'react'

import { MtrStationSearch } from '@/components/eta/station-search'
import { Button } from '@/components/ui/button'
import type { MtrStationSearchItem, UiLanguage } from '@/lib/eta/types'
import { getMtrLineName } from '@/lib/eta/line-colors'
import { useMtrSchedule } from '@/lib/eta/use-mtr-schedule'
import type { FavoritesItem } from '@/lib/store'
import { usePaneStore } from '@/lib/eta/pane-store'

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
    const name = station ? (lang === 'en' ? station.nameEn : station.nameTc) : ''
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
    usePaneStore.setState({ mtr: paneState })
  }, [paneState])

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
            title: `${lang === 'en' ? station.nameEn : station.nameTc} · ${station.lines.map((l) => getMtrLineName(l, lang)).join('/')}/${station.sta}`,
            line: station.lines[0] ?? '',
            sta: station.sta,
          }
          onAddRecent(item)
          void refresh({ toastOnError: false })
        }}
      />

      <div className="flex items-center justify-between gap-3 pt-1">
        <Button size="sm" className="rounded-full" onClick={() => void onSave()} disabled={!sta}>
          <Heart className="mr-1.5 h-4 w-4" />
          {lang === 'en' ? 'Save' : '收藏'}
        </Button>
      </div>
    </div>
  )
}
