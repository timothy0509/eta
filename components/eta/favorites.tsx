'use client'

import {
  Bus,
  ChevronRight,
  FolderPlus,
  GripVertical,
  Heart,
  History,
  MoreVertical,
  Pin,
  PinOff,
  Pencil,
  Search,
  TrainFront,
  TramFront,
  Trash2,
  X,
} from 'lucide-react'
import { motion, Reorder, useDragControls } from 'framer-motion'
import * as React from 'react'
import { useShallow } from 'zustand/shallow'

import { RouteBadge } from '@/components/eta/route-badge'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { LRT_STATIONS, type LrtStation } from '@/lib/data/lrt-stations'
import { MTR_STATIONS, type MtrStation } from '@/lib/data/mtr-stations'
import { getLineColor } from '@/lib/eta/line-colors'
import { useTranslations } from '@/lib/eta/i18n'
import { parseKmbStopNameCached } from '@/lib/eta/kmb-stop-name'
import type { KmbStopSearchItem, UiLanguage } from '@/lib/eta/types'
import { getReadableForeground } from '@/lib/ui/color'
import { cn } from '@/lib/utils'
import { type FavoritesGroup, type FavoritesItem, type RecentItem, useAppStore } from '@/lib/store'

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

type DisplayMaps = {
  kmbStopsById: Map<string, KmbStopSearchItem>
  kmbStopIndexById: Map<string, number>
  mtrStationsBySta: Map<string, MtrStation>
  lrtStationsById: Map<string, LrtStation>
}

/**
 * Generate display content for a favorite item based on current language.
 */
const FavoriteItemDisplay = React.memo(function FavoriteItemDisplay({
  item,
  lang,
  maps,
}: {
  item: FavoritesItem
  lang: UiLanguage
  maps: DisplayMaps
}) {
  const { kmbStopsById, kmbStopIndexById, mtrStationsBySta, lrtStationsById } = maps

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
    // Saved KMB route
    if ('type' in item && item.type === 'route') {
      const destination = item.destination
        ? lang === 'en'
          ? item.destination.en
          : lang === 'sc'
            ? item.destination.sc
            : item.destination.tc
        : item.title

      return (
        <span className="flex items-center gap-2">
          <RouteBadge route={item.route} company={item.co} size="sm" />
          <span className="truncate">{destination}</span>
        </span>
      )
    }

    // For "contains" queries, keep the static title
    if ('query' in item) {
      return <span className="truncate">{item.title}</span>
    }

    // Single stop
    if ('stopId' in item) {
      const stop = kmbStopsById.get(item.stopId)
      if (stop) {
        const fullName = pickKmbStopTitle(stop, lang)
        const { name } = parseKmbStopNameCached(fullName)

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
        const { name } = parseKmbStopNameCached(fullName)

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
})

function ModeIcon({ mode, className }: { mode: FavoritesItem['mode']; className?: string }) {
  if (mode === 'kmb') return <Bus className={className} aria-hidden="true" />
  if (mode === 'mtr') return <TrainFront className={className} aria-hidden="true" />
  return <TramFront className={className} aria-hidden="true" />
}

function StaggerContainer({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{
        visible: {
          transition: {
            staggerChildren: 0.04,
          },
        },
      }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

function StaggerItem({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 8 },
        visible: { opacity: 1, y: 0 },
      }}
      transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

function FavoriteActions({
  item,
  favoritesGroups,
  t,
  onTogglePin,
  onAssignGroup,
  onDelete,
}: {
  item: FavoritesItem
  favoritesGroups: FavoritesGroup[]
  t: (key: string) => string
  onTogglePin: (id: string) => void
  onAssignGroup: (favoriteId: string, groupId: string | null) => void
  onDelete: (id: string) => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          className="text-on-surface-variant hover:text-on-surface h-8 w-8 rounded-full"
          aria-label={t('favorites.group')}
        >
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[10rem]">
        <DropdownMenuItem onClick={() => onTogglePin(item.id)}>
          {item.pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
          {item.pinned ? t('favorites.unpin') : t('favorites.pin')}
        </DropdownMenuItem>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <FolderPlus className="h-4 w-4" />
            {t('favorites.assignToGroup')}
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuItem onClick={() => onAssignGroup(item.id, null)}>
              {t('favorites.unassigned')}
            </DropdownMenuItem>
            {favoritesGroups.map((group) => (
              <DropdownMenuItem key={group.id} onClick={() => onAssignGroup(item.id, group.id)}>
                {group.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={() => onDelete(item.id)}>
          <Trash2 className="h-4 w-4" />
          {t('favorites.delete')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

type FavoriteRowProps = {
  item: FavoritesItem
  lang: UiLanguage
  maps: DisplayMaps
  groupName: string
  favoritesGroups: FavoritesGroup[]
  t: (key: string) => string
  onSelect: (item: FavoritesItem) => void
  onTogglePin: (id: string) => void
  onAssignGroup: (favoriteId: string, groupId: string | null) => void
  onDelete: (id: string) => void
  draggable?: boolean
}

function FavoriteRow({
  item,
  lang,
  maps,
  groupName,
  favoritesGroups,
  t,
  onSelect,
  onTogglePin,
  onAssignGroup,
  onDelete,
  draggable = false,
}: FavoriteRowProps) {
  const dragControls = useDragControls()

  const content = (
    <div className="flex items-center gap-3">
      {draggable && (
        <div
          className="text-on-surface-variant hover:text-on-surface cursor-grab rounded-full p-1 active:cursor-grabbing"
          aria-label={t('favorites.drag')}
          onPointerDown={(event) => dragControls.start(event)}
          role="button"
          tabIndex={0}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault()
            }
          }}
        >
          <GripVertical className="h-4 w-4" />
        </div>
      )}
      <div className="bg-surface-container-high flex h-9 w-9 shrink-0 items-center justify-center rounded-full">
        <ModeIcon mode={item.mode} className="text-on-surface-variant h-4 w-4" />
      </div>
      <button type="button" className="min-w-0 flex-1 text-left" onClick={() => onSelect(item)}>
        <div className="m3-body-md text-on-surface truncate font-medium">
          <FavoriteItemDisplay item={item} lang={lang} maps={maps} />
        </div>
        <div className="text-on-surface-variant m3-body-md truncate">
          {item.pinned ? `${t('favorites.pinned')} · ` : ''}
          {groupName}
        </div>
      </button>
      <FavoriteActions
        item={item}
        favoritesGroups={favoritesGroups}
        t={t}
        onTogglePin={onTogglePin}
        onAssignGroup={onAssignGroup}
        onDelete={onDelete}
      />
    </div>
  )

  if (draggable) {
    return (
      <Reorder.Item
        value={item}
        dragListener={false}
        dragControls={dragControls}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
        whileDrag={{ scale: 1.02, boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}
        className="bg-surface-container-low border-outline-variant/50 rounded-2xl border px-3 py-2.5"
      >
        {content}
      </Reorder.Item>
    )
  }

  return (
    <StaggerItem className="bg-surface-container-low border-outline-variant/50 rounded-2xl border px-3 py-2.5">
      {content}
    </StaggerItem>
  )
}

type RecentRowProps = {
  item: RecentItem
  lang: UiLanguage
  maps: DisplayMaps
  dateFormatter: Intl.DateTimeFormat
  onSelect: (item: FavoritesItem) => void
}

function RecentRow({ item, lang, maps, dateFormatter, onSelect }: RecentRowProps) {
  return (
    <StaggerItem>
      <motion.button
        type="button"
        whileHover={{ scale: 1.005 }}
        whileTap={{ scale: 0.995 }}
        className="bg-surface-container-low hover:bg-surface-container border-outline-variant/50 flex w-full items-center gap-3 rounded-2xl border px-3 py-2.5 text-left transition-colors"
        onClick={() => onSelect(item)}
      >
        <div className="bg-surface-container-high flex h-9 w-9 shrink-0 items-center justify-center rounded-full">
          <ModeIcon mode={item.mode} className="text-on-surface-variant h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="m3-body-md text-on-surface truncate font-medium">
            <FavoriteItemDisplay item={item} lang={lang} maps={maps} />
          </div>
          <div className="text-on-surface-variant m3-body-md mt-0.5 flex items-center justify-between gap-2">
            <span>{item.mode.toUpperCase()}</span>
            <span>{dateFormatter.format(new Date(item.at))}</span>
          </div>
        </div>
      </motion.button>
    </StaggerItem>
  )
}

function GroupsEditor({
  favoritesGroups,
  t,
  onAdd,
  onRename,
  onDelete,
}: {
  favoritesGroups: FavoritesGroup[]
  t: (key: string) => string
  onAdd: (name: string) => void
  onRename: (id: string, name: string) => void
  onDelete: (id: string) => void
}) {
  const [open, setOpen] = React.useState(false)
  const [newGroupName, setNewGroupName] = React.useState('')
  const [editingGroupId, setEditingGroupId] = React.useState<string | null>(null)
  const [editingGroupName, setEditingGroupName] = React.useState('')

  const handleAdd = () => {
    const trimmed = newGroupName.trim()
    if (!trimmed) return
    onAdd(trimmed)
    setNewGroupName('')
  }

  const startEdit = (group: FavoritesGroup) => {
    setEditingGroupId(group.id)
    setEditingGroupName(group.name)
  }

  const cancelEdit = () => {
    setEditingGroupId(null)
    setEditingGroupName('')
  }

  const saveEdit = () => {
    if (!editingGroupId || !editingGroupName.trim()) return
    onRename(editingGroupId, editingGroupName)
    cancelEdit()
  }

  return (
    <div className="bg-surface-container border-outline-variant/50 rounded-2xl border p-3">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between gap-2 rounded-xl p-1 text-left"
      >
        <span className="m3-title-md">{t('favorites.groups')}</span>
        <ChevronRight
          className={cn(
            'text-on-surface-variant h-4 w-4 transition-transform duration-200',
            open && 'rotate-90'
          )}
        />
      </button>
      {open && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
          className="space-y-3 overflow-hidden pt-3"
        >
          <div className="flex flex-wrap items-center gap-2">
            <Input
              value={newGroupName}
              onChange={(event) => setNewGroupName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== 'Enter') return
                event.preventDefault()
                handleAdd()
              }}
              placeholder={t('favorites.addGroup')}
              className="h-9 flex-1 rounded-xl text-sm"
            />
            <Button
              variant="secondary"
              size="sm"
              className="rounded-xl"
              onClick={handleAdd}
              disabled={!newGroupName.trim()}
            >
              <FolderPlus className="h-4 w-4" />
              <span className="ml-1.5">{t('favorites.addGroup')}</span>
            </Button>
          </div>
          {favoritesGroups.length > 0 && (
            <div className="space-y-1">
              {favoritesGroups.map((group) => (
                <div
                  key={group.id}
                  className="flex items-center justify-between gap-2 rounded-xl px-2 py-1.5 text-sm"
                >
                  {editingGroupId === group.id ? (
                    <div className="flex w-full items-center gap-2">
                      <Input
                        value={editingGroupName}
                        onChange={(event) => setEditingGroupName(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key !== 'Enter') return
                          event.preventDefault()
                          saveEdit()
                        }}
                        className="h-8 flex-1 rounded-xl text-sm"
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        className="rounded-xl"
                        onClick={saveEdit}
                        disabled={!editingGroupName.trim()}
                      >
                        {t('favorites.rename')}
                      </Button>
                      <Button variant="ghost" size="sm" className="rounded-xl" onClick={cancelEdit}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <>
                      <span className="m3-body-md truncate font-medium">{group.name}</span>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="h-8 w-8 rounded-xl"
                          aria-label={t('favorites.rename')}
                          onClick={() => startEdit(group)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="text-destructive h-8 w-8 rounded-xl"
                          aria-label={t('favorites.delete')}
                          onClick={() => onDelete(group.id)}
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
        </motion.div>
      )}
    </div>
  )
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
  const reorderFavorites = useAppStore((s) => s.reorderFavorites)
  const addFavoriteGroup = useAppStore((s) => s.addFavoriteGroup)
  const renameFavoriteGroup = useAppStore((s) => s.renameFavoriteGroup)
  const deleteFavoriteGroup = useAppStore((s) => s.deleteFavoriteGroup)
  const assignFavoriteGroup = useAppStore((s) => s.assignFavoriteGroup)
  const clearRecents = useAppStore((s) => s.clearRecents)

  const [activeTab, setActiveTab] = React.useState<'favorites' | 'recent'>('favorites')
  const [searchQuery, setSearchQuery] = React.useState('')
  const [selectedGroup, setSelectedGroup] = React.useState<string>('all')

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

  const maps = React.useMemo<DisplayMaps>(() => {
    const mtrStationsBySta = new Map(MTR_STATIONS.map((station) => [station.sta, station]))
    const lrtStationsById = new Map(LRT_STATIONS.map((station) => [station.stationId, station]))
    const kmbStopsById = !kmbStops
      ? new Map<string, KmbStopSearchItem>()
      : new Map(kmbStops.map((stop) => [stop.stopId, stop]))
    const kmbStopIndexById = !kmbStops
      ? new Map<string, number>()
      : new Map(kmbStops.map((stop, index) => [stop.stopId, index]))
    return { kmbStopsById, kmbStopIndexById, mtrStationsBySta, lrtStationsById }
  }, [kmbStops])

  const { t } = useTranslations(lang)

  const groupNameById = React.useMemo(() => {
    return new Map(favoritesGroups.map((group) => [group.id, group.name]))
  }, [favoritesGroups])

  const normalizedSearch = searchQuery.trim().toLowerCase()
  const isFiltering = normalizedSearch.length > 0 || selectedGroup !== 'all'

  const filteredFavorites = React.useMemo(() => {
    return favorites.filter((f) => {
      const matchesSearch =
        !normalizedSearch ||
        f.title.toLowerCase().includes(normalizedSearch) ||
        f.mode.toLowerCase().includes(normalizedSearch) ||
        (groupNameById
          .get(f.groupId ?? '')
          ?.toLowerCase()
          .includes(normalizedSearch) ??
          false)
      const matchesGroup =
        selectedGroup === 'all' ||
        (selectedGroup === 'unassigned' ? !f.groupId : f.groupId === selectedGroup)
      return matchesSearch && matchesGroup
    })
  }, [favorites, normalizedSearch, selectedGroup, groupNameById])

  const pinnedItems = React.useMemo(() => favorites.filter((f) => f.pinned), [favorites])
  const unpinnedItems = React.useMemo(() => favorites.filter((f) => !f.pinned), [favorites])

  const handleReorderPinned = (next: FavoritesItem[]) => {
    reorderFavorites([...next, ...unpinnedItems])
  }

  const handleReorderUnpinned = (next: FavoritesItem[]) => {
    reorderFavorites([...pinnedItems, ...next])
  }

  const groupedRecents = React.useMemo(() => {
    const now = new Date()
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const startOfYesterday = new Date(startOfToday.getTime() - 24 * 60 * 60 * 1000)
    const startOfWeek = new Date(startOfToday.getTime() - 7 * 24 * 60 * 60 * 1000)

    const groups: { label: string; items: RecentItem[] }[] = []
    const today: RecentItem[] = []
    const yesterday: RecentItem[] = []
    const thisWeek: RecentItem[] = []
    const earlier: RecentItem[] = []

    for (const r of recents) {
      const date = new Date(r.at)
      if (date >= startOfToday) today.push(r)
      else if (date >= startOfYesterday) yesterday.push(r)
      else if (date >= startOfWeek) thisWeek.push(r)
      else earlier.push(r)
    }

    if (today.length) groups.push({ label: t('favorites.today'), items: today })
    if (yesterday.length) groups.push({ label: t('favorites.yesterday'), items: yesterday })
    if (thisWeek.length) groups.push({ label: t('favorites.thisWeek'), items: thisWeek })
    if (earlier.length) groups.push({ label: t('favorites.earlier'), items: earlier })

    return groups
  }, [recents, t])

  const groupFilterOptions = React.useMemo(
    () => [
      { id: 'all', label: t('favorites.all') },
      ...favoritesGroups.map((group) => ({ id: group.id, label: group.name })),
      { id: 'unassigned', label: t('favorites.unassigned') },
    ],
    [favoritesGroups, t]
  )

  return (
    <Card className="bg-surface-container-low rounded-3xl">
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle className="m3-title-md">{t('favorites.saved')}</CardTitle>
        <div className="bg-surface-container-high inline-flex items-center rounded-full p-1">
          <button
            type="button"
            onClick={() => setActiveTab('favorites')}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors',
              activeTab === 'favorites'
                ? 'bg-primary-container text-on-primary-container'
                : 'text-on-surface-variant hover:text-on-surface'
            )}
          >
            <Heart className="h-4 w-4" />
            {t('favorites.favorites')}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('recent')}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors',
              activeTab === 'recent'
                ? 'bg-primary-container text-on-primary-container'
                : 'text-on-surface-variant hover:text-on-surface'
            )}
          >
            <History className="h-4 w-4" />
            {t('favorites.recent')}
          </button>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {activeTab === 'favorites' ? (
          <div className="space-y-4 p-6 pt-0">
            <div className="relative">
              <Search className="text-on-surface-variant absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
              <Input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder={t('favorites.searchPlaceholder')}
                className="h-10 rounded-full pl-9 text-sm"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="text-on-surface-variant hover:text-on-surface absolute top-1/2 right-2 -translate-y-1/2 rounded-full p-1"
                  aria-label={t('favorites.clear')}
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {favoritesGroups.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {groupFilterOptions.map((option) => (
                  <Button
                    key={option.id}
                    variant={selectedGroup === option.id ? 'default' : 'outline'}
                    size="sm"
                    className="rounded-full text-xs"
                    onClick={() => setSelectedGroup(option.id)}
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
            )}

            <GroupsEditor
              favoritesGroups={favoritesGroups}
              t={t}
              onAdd={addFavoriteGroup}
              onRename={renameFavoriteGroup}
              onDelete={deleteFavoriteGroup}
            />

            {favorites.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
                <Heart className="text-on-surface-variant h-10 w-10 opacity-40" />
                <div className="m3-body-lg text-on-surface font-medium">
                  {t('favorites.noFavorites')}
                </div>
                <div className="text-on-surface-variant m3-body-md max-w-[16rem]">
                  {t('favorites.noFavoritesHint')}
                </div>
              </div>
            ) : filteredFavorites.length === 0 ? (
              <div className="text-on-surface-variant m3-body-md py-8 text-center">
                {t('errors.noResults')}
              </div>
            ) : isFiltering ? (
              <StaggerContainer className="space-y-2">
                {filteredFavorites.map((f) => (
                  <FavoriteRow
                    key={f.id}
                    item={f}
                    lang={lang}
                    maps={maps}
                    groupName={groupNameById.get(f.groupId ?? '') ?? t('favorites.unassigned')}
                    favoritesGroups={favoritesGroups}
                    t={t}
                    onSelect={onSelect}
                    onTogglePin={toggleFavoritePin}
                    onAssignGroup={assignFavoriteGroup}
                    onDelete={removeFavorite}
                  />
                ))}
              </StaggerContainer>
            ) : (
              <div className="space-y-4">
                {pinnedItems.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-on-surface-variant m3-label-md px-1">
                      {t('favorites.pinned')}
                    </div>
                    <Reorder.Group
                      axis="y"
                      values={pinnedItems}
                      onReorder={handleReorderPinned}
                      className="space-y-2"
                    >
                      {pinnedItems.map((f) => (
                        <FavoriteRow
                          key={f.id}
                          item={f}
                          lang={lang}
                          maps={maps}
                          groupName={
                            groupNameById.get(f.groupId ?? '') ?? t('favorites.unassigned')
                          }
                          favoritesGroups={favoritesGroups}
                          t={t}
                          onSelect={onSelect}
                          onTogglePin={toggleFavoritePin}
                          onAssignGroup={assignFavoriteGroup}
                          onDelete={removeFavorite}
                          draggable
                        />
                      ))}
                    </Reorder.Group>
                  </div>
                )}

                {unpinnedItems.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-on-surface-variant m3-label-md px-1">
                      {t('favorites.unpinned')}
                    </div>
                    <Reorder.Group
                      axis="y"
                      values={unpinnedItems}
                      onReorder={handleReorderUnpinned}
                      className="space-y-2"
                    >
                      {unpinnedItems.map((f) => (
                        <FavoriteRow
                          key={f.id}
                          item={f}
                          lang={lang}
                          maps={maps}
                          groupName={
                            groupNameById.get(f.groupId ?? '') ?? t('favorites.unassigned')
                          }
                          favoritesGroups={favoritesGroups}
                          t={t}
                          onSelect={onSelect}
                          onTogglePin={toggleFavoritePin}
                          onAssignGroup={assignFavoriteGroup}
                          onDelete={removeFavorite}
                          draggable
                        />
                      ))}
                    </Reorder.Group>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4 p-6 pt-0">
            <div className="flex items-center justify-between gap-2">
              <div className="text-on-surface-variant m3-body-md">{t('favorites.tip')}</div>
              <Button
                variant="ghost"
                size="sm"
                onClick={clearRecents}
                className="rounded-xl"
                disabled={!recents.length}
              >
                {t('favorites.clear')}
              </Button>
            </div>

            {recents.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
                <History className="text-on-surface-variant h-10 w-10 opacity-40" />
                <div className="m3-body-lg text-on-surface font-medium">
                  {t('favorites.noRecent')}
                </div>
                <div className="text-on-surface-variant m3-body-md max-w-[16rem]">
                  {t('favorites.noRecentHint')}
                </div>
              </div>
            ) : (
              <div className="space-y-5">
                {groupedRecents.map((group) => (
                  <div key={group.label} className="space-y-2">
                    <div className="text-on-surface-variant m3-label-md px-1">{group.label}</div>
                    <StaggerContainer className="space-y-2">
                      {group.items.map((r) => (
                        <RecentRow
                          key={`${r.id}-${r.at}`}
                          item={r}
                          lang={lang}
                          maps={maps}
                          dateFormatter={dateFormatter}
                          onSelect={onSelect}
                        />
                      ))}
                    </StaggerContainer>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
