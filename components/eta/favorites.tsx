'use client'

import {
  ArrowDown,
  ArrowUp,
  FolderPlus,
  Heart,
  History,
  Pencil,
  Pin,
  PinOff,
  Trash2,
} from 'lucide-react'
import * as React from 'react'
import { useShallow } from 'zustand/shallow'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { LRT_STATIONS, type LrtStation } from '@/lib/data/lrt-stations'
import { MTR_STATIONS, type MtrStation } from '@/lib/data/mtr-stations'
import { getLineColor } from '@/lib/eta/line-colors'
import { parseKmbStopName } from '@/lib/eta/kmb-stop-name'
import type { KmbStopSearchItem, UiLanguage } from '@/lib/eta/types'
import { getReadableForeground } from '@/lib/ui/color'
import { cn } from '@/lib/utils'
import { type FavoritesGroup, type FavoritesItem, useAppStore } from '@/lib/store'

type Props = {
  lang: UiLanguage
  kmbStops?: KmbStopSearchItem[]
  onSelect: (item: FavoritesItem) => void
}

function pickKmbStopTitle(stop: KmbStopSearchItem, lang: UiLanguage) {
  if (lang === 'en') return stop.nameEn
  if (lang === 'sc') return stop.nameSc
  return stop.nameTc
}

/**
 * Generate display content for a favorite item based on current language.
 */
function FavoriteItemDisplay({
  item,
  lang,
  kmbStopsById,
  kmbStopIndexById,
  mtrStationsBySta,
  lrtStationsById,
}: {
  item: FavoritesItem
  lang: UiLanguage
  kmbStopsById: Map<string, KmbStopSearchItem>
  kmbStopIndexById: Map<string, number>
  mtrStationsBySta: Map<string, MtrStation>
  lrtStationsById: Map<string, LrtStation>
}) {
  if (item.mode === 'mtr') {
    const station = mtrStationsBySta.get(item.sta)
    if (!station) return <span>{item.title}</span>

    const name = lang === 'en' ? station.nameEn : station.nameTc
    return (
      <span className="flex items-center gap-1.5">
        <span className="truncate">{name}</span>
        <span className="flex shrink-0 items-center gap-0.5">
          {station.lines.map((line) => (
            <span
              key={line}
              className={cn(
                'inline-flex h-4 items-center rounded px-1 text-[10px] font-semibold ring-1 ring-black/10',
                getReadableForeground(getLineColor(line))
              )}
              style={{ backgroundColor: getLineColor(line) }}
            >
              {line}
            </span>
          ))}
        </span>
      </span>
    )
  }

  if (item.mode === 'lrt') {
    const station = lrtStationsById.get(item.stationId)
    if (!station) return <span>{item.title}</span>

    const name = lang === 'en' ? station.nameEn : station.nameZh
    return <span className="truncate">{name}</span>
  }

  // KMB mode - regenerate title based on current language
  if (item.mode === 'kmb') {
    // For "contains" queries, keep the static title
    if ('query' in item) {
      return <span className="truncate">{item.title}</span>
    }

    // Single stop
    if ('stopId' in item) {
      const stop = kmbStopsById.get(item.stopId)
      if (stop) {
        const fullName = pickKmbStopTitle(stop, lang)
        const { name } = parseKmbStopName(fullName)

        // Build suffix from saved data
        let suffix = ''
        if (item.routeFilterMode === 'advanced' && item.entries?.length) {
          const count = item.entries.length
          suffix = ` · ${count} ${lang === 'en' ? (count === 1 ? 'route' : 'routes') : '條路線'}`
        } else if (item.route) {
          suffix = ` · ${item.route}`
        }

        return (
          <span className="truncate">
            {name}
            {suffix}
          </span>
        )
      }
    }

    // Grouped stops
    if ('stopIds' in item) {
      let firstStop: KmbStopSearchItem | undefined
      let firstStopIndex = Number.POSITIVE_INFINITY
      for (const stopId of item.stopIds) {
        const index = kmbStopIndexById.get(stopId)
        if (index !== undefined && index < firstStopIndex) {
          const candidate = kmbStopsById.get(stopId)
          if (candidate) {
            firstStop = candidate
            firstStopIndex = index
          }
        }
      }
      if (firstStop) {
        const fullName = pickKmbStopTitle(firstStop, lang)
        const { name } = parseKmbStopName(fullName)

        // Build suffix from saved data
        let suffix = ''
        if (item.routeFilterMode === 'advanced' && item.entries?.length) {
          const count = item.entries.length
          suffix = ` · ${count} ${lang === 'en' ? (count === 1 ? 'route' : 'routes') : '條路線'}`
        } else if (item.route) {
          suffix = ` · ${item.route}`
        }

        return (
          <span className="truncate">
            {name}
            {suffix}
          </span>
        )
      }
    }
  }

  // Fallback to stored title
  return <span className="truncate">{item.title}</span>
}

export function FavoritesAndRecents({ lang, kmbStops, onSelect }: Props) {
  const { favorites, favoritesGroups, recents } = useAppStore(
    useShallow((s) => ({
      favorites: s.favorites,
      favoritesGroups: s.favoritesGroups,
      recents: s.recents,
    }))
  )
  const removeFavorite = useAppStore((s) => s.removeFavorite)
  const toggleFavoritePin = useAppStore((s) => s.toggleFavoritePin)
  const moveFavorite = useAppStore((s) => s.moveFavorite)
  const addFavoriteGroup = useAppStore((s) => s.addFavoriteGroup)
  const renameFavoriteGroup = useAppStore((s) => s.renameFavoriteGroup)
  const deleteFavoriteGroup = useAppStore((s) => s.deleteFavoriteGroup)
  const assignFavoriteGroup = useAppStore((s) => s.assignFavoriteGroup)
  const clearRecents = useAppStore((s) => s.clearRecents)
  const [newGroupName, setNewGroupName] = React.useState('')
  const [editingGroupId, setEditingGroupId] = React.useState<string | null>(null)
  const [editingGroupName, setEditingGroupName] = React.useState('')
  const dateFormatter = React.useMemo(
    () =>
      new Intl.DateTimeFormat(
        lang === 'en' ? 'en-HK' : lang === 'sc' ? 'zh-Hans-HK' : 'zh-Hant-HK',
        {
          dateStyle: 'medium',
          timeStyle: 'short',
        }
      ),
    [lang]
  )

  const mtrStationsBySta = React.useMemo(() => {
    return new Map(MTR_STATIONS.map((station) => [station.sta, station]))
  }, [])

  const lrtStationsById = React.useMemo(() => {
    return new Map(LRT_STATIONS.map((station) => [station.stationId, station]))
  }, [])

  const kmbStopsById = React.useMemo(() => {
    if (!kmbStops) return new Map<string, KmbStopSearchItem>()
    return new Map(kmbStops.map((stop) => [stop.stopId, stop]))
  }, [kmbStops])

  const kmbStopIndexById = React.useMemo(() => {
    if (!kmbStops) return new Map<string, number>()
    return new Map(kmbStops.map((stop, index) => [stop.stopId, index]))
  }, [kmbStops])

  const t = {
    saved: lang === 'en' ? 'Saved' : lang === 'sc' ? '已儲存' : '已儲存',
    favorites: lang === 'en' ? 'Favorites' : '收藏',
    recent: lang === 'en' ? 'Recent' : '最近',
    noFavorites: lang === 'en' ? 'No favorites yet.' : lang === 'sc' ? '暫無收藏。' : '暫無收藏。',
    tip:
      lang === 'en'
        ? 'Tip: results can auto-refresh while you wait.'
        : lang === 'sc'
          ? '提示：結果可在等待時自動刷新。'
          : '提示：結果可在等待時自動刷新。',
    clear: lang === 'en' ? 'Clear' : '清除',
    noRecent:
      lang === 'en' ? 'No recent searches.' : lang === 'sc' ? '暫無搜尋記錄。' : '暫無搜尋記錄。',
    pinned: lang === 'en' ? 'Pinned' : lang === 'sc' ? '已釘選' : '已釘選',
    unpinned: lang === 'en' ? 'Unpinned' : lang === 'sc' ? '取消釘選' : '取消釘選',
    moveUp: lang === 'en' ? 'Move up' : lang === 'sc' ? '上移' : '上移',
    moveDown: lang === 'en' ? 'Move down' : lang === 'sc' ? '下移' : '下移',
    group: lang === 'en' ? 'Group' : lang === 'sc' ? '分組' : '分組',
    groups: lang === 'en' ? 'Groups' : lang === 'sc' ? '分組' : '分組',
    addGroup: lang === 'en' ? 'Add group' : lang === 'sc' ? '新增分組' : '新增分組',
    rename: lang === 'en' ? 'Rename' : lang === 'sc' ? '重新命名' : '重新命名',
    delete: lang === 'en' ? 'Delete' : lang === 'sc' ? '刪除' : '刪除',
    none: lang === 'en' ? 'None' : lang === 'sc' ? '無' : '無',
  }

  const groupNameById = React.useMemo(() => {
    return new Map(favoritesGroups.map((group) => [group.id, group.name]))
  }, [favoritesGroups])

  const handleAddGroup = () => {
    if (!newGroupName.trim()) return
    addFavoriteGroup(newGroupName)
    setNewGroupName('')
  }

  const startEditGroup = (group: FavoritesGroup) => {
    setEditingGroupId(group.id)
    setEditingGroupName(group.name)
  }

  const cancelEditGroup = () => {
    setEditingGroupId(null)
    setEditingGroupName('')
  }

  const saveEditGroup = () => {
    if (!editingGroupId || !editingGroupName.trim()) return
    renameFavoriteGroup(editingGroupId, editingGroupName)
    cancelEditGroup()
  }

  const handleGroupInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter') return
    event.preventDefault()
    handleAddGroup()
  }

  const handleGroupEditKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter') return
    event.preventDefault()
    saveEditGroup()
  }

  return (
    <Card className="rounded-3xl">
      <Tabs defaultValue="favorites" className="gap-0">
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle className="text-base">{t.saved}</CardTitle>
          <TabsList withIndicator>
            <TabsTrigger value="favorites" unstyledActive className="gap-2">
              <Heart className="h-4 w-4" /> {t.favorites}
            </TabsTrigger>
            <TabsTrigger value="recent" unstyledActive className="gap-2">
              <History className="h-4 w-4" /> {t.recent}
            </TabsTrigger>
          </TabsList>
        </CardHeader>

        <CardContent className="p-0">
          <TabsContent value="favorites" className="mt-0 p-6 pt-0">
            <div className="space-y-4">
              <div className="bg-background/40 space-y-2 rounded-2xl border p-3">
                <div className="text-muted-foreground text-xs font-medium">{t.groups}</div>
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    value={newGroupName}
                    onChange={(event) => setNewGroupName(event.target.value)}
                    onKeyDown={handleGroupInputKeyDown}
                    placeholder={t.addGroup}
                    className="h-8 w-44 rounded-xl text-sm"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="rounded-xl"
                    onClick={handleAddGroup}
                    disabled={!newGroupName.trim()}
                  >
                    <FolderPlus className="h-4 w-4" />
                    <span className="ml-1.5 text-xs">{t.addGroup}</span>
                  </Button>
                </div>
                {favoritesGroups.length > 0 && (
                  <div className="space-y-1">
                    {favoritesGroups.map((group) => (
                      <div
                        key={group.id}
                        className="flex items-center justify-between gap-2 text-sm"
                      >
                        {editingGroupId === group.id ? (
                          <div className="flex w-full items-center gap-2">
                            <Input
                              value={editingGroupName}
                              onChange={(event) => setEditingGroupName(event.target.value)}
                              onKeyDown={handleGroupEditKeyDown}
                              className="h-8 flex-1 rounded-xl text-sm"
                            />
                            <Button
                              variant="ghost"
                              size="sm"
                              className="rounded-xl"
                              onClick={saveEditGroup}
                              disabled={!editingGroupName.trim()}
                            >
                              {t.rename}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="rounded-xl"
                              onClick={cancelEditGroup}
                            >
                              {t.clear}
                            </Button>
                          </div>
                        ) : (
                          <>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{group.name}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 rounded-xl"
                                aria-label={t.rename}
                                onClick={() => startEditGroup(group)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-destructive h-8 w-8 rounded-xl"
                                aria-label={t.delete}
                                onClick={() => deleteFavoriteGroup(group.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {favorites.length === 0 ? (
                <div className="text-muted-foreground text-sm">{t.noFavorites}</div>
              ) : (
                favorites.map((f, index) => (
                  <div
                    key={f.id}
                    className="ui-animate-in-fast ui-lift bg-background/40 flex items-center justify-between gap-2 rounded-2xl border px-3 py-2"
                  >
                    <button className="min-w-0 flex-1 text-left" onClick={() => onSelect(f)}>
                      <div className="text-sm font-medium">
                        <FavoriteItemDisplay
                          item={f}
                          lang={lang}
                          kmbStopsById={kmbStopsById}
                          kmbStopIndexById={kmbStopIndexById}
                          mtrStationsBySta={mtrStationsBySta}
                          lrtStationsById={lrtStationsById}
                        />
                      </div>
                      <div className="text-muted-foreground truncate text-xs">
                        <span>{f.mode.toUpperCase()}</span>
                        <span className="mx-1">·</span>
                        <span>{groupNameById.get(f.groupId ?? '') ?? t.none}</span>
                      </div>
                    </button>
                    <div className="flex items-center gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 rounded-xl"
                        aria-label={f.pinned ? t.unpinned : t.pinned}
                        onClick={() => toggleFavoritePin(f.id)}
                      >
                        {f.pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 rounded-xl"
                        aria-label={t.moveUp}
                        onClick={() => moveFavorite(f.id, 'up')}
                        disabled={
                          index === 0 || Boolean(f.pinned) !== Boolean(favorites[index - 1]?.pinned)
                        }
                      >
                        <ArrowUp className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 rounded-xl"
                        aria-label={t.moveDown}
                        onClick={() => moveFavorite(f.id, 'down')}
                        disabled={
                          index === favorites.length - 1 ||
                          Boolean(f.pinned) !== Boolean(favorites[index + 1]?.pinned)
                        }
                      >
                        <ArrowDown className="h-4 w-4" />
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 rounded-xl"
                            aria-label={t.group}
                          >
                            <span
                              className={cn(
                                'text-xs font-medium',
                                f.groupId ? 'text-foreground' : 'text-muted-foreground'
                              )}
                            >
                              {t.group}
                            </span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="min-w-[10rem]">
                          <DropdownMenuLabel>{t.group}</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => assignFavoriteGroup(f.id, null)}>
                            {t.none}
                          </DropdownMenuItem>
                          {favoritesGroups.map((group) => (
                            <DropdownMenuItem
                              key={group.id}
                              onClick={() => assignFavoriteGroup(f.id, group.id)}
                            >
                              {group.name}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 rounded-xl"
                        aria-label={
                          lang === 'en'
                            ? 'Remove favorite'
                            : lang === 'sc'
                              ? '移除收藏'
                              : '移除收藏'
                        }
                        onClick={() => removeFavorite(f.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="recent" className="mt-0 p-6 pt-0">
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="text-muted-foreground text-xs">{t.tip}</div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearRecents}
                  className="rounded-xl"
                  disabled={!recents.length}
                >
                  {t.clear}
                </Button>
              </div>

              {recents.length === 0 ? (
                <div className="text-muted-foreground text-sm">{t.noRecent}</div>
              ) : (
                recents.map((r) => (
                  <button
                    key={`${r.id}-${r.at}`}
                    className="ui-animate-in-fast ui-lift bg-background/40 hover:bg-background/60 w-full rounded-2xl border px-3 py-2 text-left"
                    onClick={() => onSelect(r)}
                  >
                    <div className="text-sm font-medium">
                      <FavoriteItemDisplay
                        item={r}
                        lang={lang}
                        kmbStopsById={kmbStopsById}
                        kmbStopIndexById={kmbStopIndexById}
                        mtrStationsBySta={mtrStationsBySta}
                        lrtStationsById={lrtStationsById}
                      />
                    </div>
                    <div className="text-muted-foreground mt-0.5 flex items-center justify-between gap-2 text-xs">
                      <span>{r.mode.toUpperCase()}</span>
                      <span>{dateFormatter.format(new Date(r.at))}</span>
                    </div>
                  </button>
                ))
              )}
            </div>

            <Separator className="my-2" />
          </TabsContent>
        </CardContent>
      </Tabs>
    </Card>
  )
}
