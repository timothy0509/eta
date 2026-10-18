'use client'

import type { SubView, TransportMode, UiLanguage } from '@/lib/eta/types'
import { clampNearbyRadiusKm, NEARBY_RADIUS_DEFAULT_KM } from '@/lib/eta/nearby-radius'
import { create } from 'zustand'
import type { StateCreator } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

export type RouteFilterMode = 'simple' | 'advanced'

type FavoritesMeta = {
  pinned?: boolean
  groupId?: string | null
}

export type FavoritesItem = FavoritesMeta &
  // KMB: single stop
  (
    | {
        id: string
        mode: 'kmb'
        title: string
        stopId: string
        // Route filter - simple mode (legacy field name for backward compat)
        route?: string
        serviceType?: string
        // Extended route filter fields
        routeFilterMode?: RouteFilterMode
        entries?: { variantKey: string }[]
      }
    // KMB: grouped stops (multiple stops with same name)
    | {
        id: string
        mode: 'kmb'
        title: string
        stopIds: string[]
        // Route filter
        routeFilterMode?: RouteFilterMode
        route?: string
        entries?: { variantKey: string }[]
      }
    // KMB: contains query
    | {
        id: string
        mode: 'kmb'
        title: string
        query: string
        // Route filter - simple mode (legacy field name for backward compat)
        route?: string
        serviceType?: string
        // Extended route filter fields
        routeFilterMode?: RouteFilterMode
        entries?: { variantKey: string }[]
      }
    // KMB: saved route
    | {
        id: string
        mode: 'kmb'
        type: 'route'
        title: string
        route: string
        co?: string
        bound: string
        serviceType: string
        /** Region discriminator for same-number routes (GMB HKI/Kowloon/NT). */
        gtfsId?: string
        region?: string
        origin?: { en: string; tc: string; sc: string }
        destination?: { en: string; tc: string; sc: string }
      }
    | {
        id: string
        mode: 'mtr'
        // Titles are stored for display convenience only.
        // They may be regenerated in the current UI language.
        title: string
        // Keep one representative line for backward compatibility.
        line: string
        sta: string
      }
    | {
        id: string
        mode: 'lrt'
        title: string
        stationId: string
      }
  )

export type RecentItem = FavoritesItem & {
  at: number
}

export type FavoritesGroup = {
  id: string
  name: string
}

// Ephemeral nav slice: current mode plus subView. Never persisted, so a
// shared link can only reach it through URL hydrate, never through storage.
type NavSlice = {
  mode: TransportMode
  subView: SubView

  setMode: (mode: TransportMode) => void
  setSubView: (subView: SubView) => void
}

// Persisted prefs slice: language, filter defaults, refresh interval,
// nearby radius plus favorites, groups and recents. Field names stay
// backward compatible so old favorites still decode after the v5 to v6 bump.
type PrefsSlice = {
  lang: UiLanguage
  routeFilterMode: RouteFilterMode
  autoRefreshSeconds: number
  nearbyRadiusKm: number

  favorites: FavoritesItem[]
  favoritesGroups: FavoritesGroup[]
  recents: RecentItem[]

  setLang: (lang: UiLanguage) => void
  setRouteFilterMode: (mode: RouteFilterMode) => void
  setAutoRefreshSeconds: (seconds: number) => void
  setNearbyRadiusKm: (km: number) => void
  /** Restore display and update prefs to defaults. Saved data is untouched. */
  resetPrefs: () => void
  addFavorite: (item: FavoritesItem) => void
  removeFavorite: (id: string) => void
  toggleFavoritePin: (id: string) => void
  moveFavorite: (id: string, direction: 'up' | 'down') => void
  reorderFavorites: (newOrder: FavoritesItem[]) => void
  addFavoriteGroup: (name: string) => void
  renameFavoriteGroup: (id: string, name: string) => void
  deleteFavoriteGroup: (id: string) => void
  assignFavoriteGroup: (favoriteId: string, groupId: string | null) => void

  addRecent: (item: FavoritesItem) => void
  clearRecents: () => void
  clearFavorites: () => void
  /**
   * Replace the whole favorites list, used by file import. Entries that
   * fail validation are dropped, the rest are capped like manual saves.
   */
  replaceFavorites: (items: unknown) => void
}

type AppState = NavSlice & PrefsSlice

const RECENTS_LIMIT = 12

// Cap persisted favorites so localStorage stays small and the favorites
// list renders fast. Newest saves win; the oldest unpinned entries fall off.
export const FAVORITES_LIMIT = 200

const createId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return Math.random().toString(36).slice(2, 10)
}

const withFavoriteMeta = (item: FavoritesItem): FavoritesItem => ({
  ...item,
  pinned: item.pinned ?? false,
  groupId: item.groupId ?? null,
})

// Imported favorites come from a user file, so shape-check before trusting
// them. Every variant needs its id, mode, title and locator fields, since
// nothing regenerates them on the way in.
function isImportableFavorite(item: unknown): item is FavoritesItem {
  if (typeof item !== 'object' || item === null) return false
  const candidate = item as Record<string, unknown>
  if (typeof candidate.id !== 'string' || !candidate.id) return false
  if (typeof candidate.title !== 'string' || !candidate.title) return false
  const nonEmptyStrings = (value: unknown): value is string[] =>
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((entry): entry is string => typeof entry === 'string' && entry.length > 0)
  if (candidate.mode === 'kmb') {
    if (candidate.type === 'route') {
      return (
        typeof candidate.route === 'string' &&
        candidate.route.length > 0 &&
        typeof candidate.bound === 'string' &&
        candidate.bound.length > 0 &&
        typeof candidate.serviceType === 'string' &&
        candidate.serviceType.length > 0
      )
    }
    return (
      (typeof candidate.stopId === 'string' && candidate.stopId.length > 0) ||
      nonEmptyStrings(candidate.stopIds) ||
      (typeof candidate.query === 'string' && candidate.query.length > 0)
    )
  }
  if (candidate.mode === 'mtr')
    return (
      typeof candidate.sta === 'string' &&
      candidate.sta.length > 0 &&
      typeof candidate.line === 'string' &&
      candidate.line.length > 0
    )
  if (candidate.mode === 'lrt')
    return typeof candidate.stationId === 'string' && candidate.stationId.length > 0
  return false
}

const createNavSlice: StateCreator<AppState, [], [], NavSlice> = (set) => ({
  mode: 'kmb',
  subView: 'stops',

  setMode: (mode) => set({ mode }),
  setSubView: (subView) => set({ subView }),
})

const createPrefsSlice: StateCreator<AppState, [], [], PrefsSlice> = (set) => ({
  lang: 'tc',
  routeFilterMode: 'simple',
  autoRefreshSeconds: 15,
  nearbyRadiusKm: NEARBY_RADIUS_DEFAULT_KM,

  favorites: [],
  favoritesGroups: [],
  recents: [],

  setLang: (lang) => set({ lang }),
  setRouteFilterMode: (routeFilterMode) => set({ routeFilterMode }),
  setAutoRefreshSeconds: (seconds) => set({ autoRefreshSeconds: seconds }),
  setNearbyRadiusKm: (km) => set({ nearbyRadiusKm: clampNearbyRadiusKm(km) }),
  resetPrefs: () =>
    set({
      lang: 'tc',
      routeFilterMode: 'simple',
      autoRefreshSeconds: 15,
      nearbyRadiusKm: NEARBY_RADIUS_DEFAULT_KM,
    }),

  addFavorite: (item) =>
    set((state) => {
      if (state.favorites.some((f) => f.id === item.id)) return state
      return { favorites: capFavorites([withFavoriteMeta(item), ...state.favorites]) }
    }),

  removeFavorite: (id) =>
    set((state) => ({
      favorites: state.favorites.filter((f) => f.id !== id),
    })),

  toggleFavoritePin: (id) =>
    set((state) => {
      const favorites = [...state.favorites]
      const index = favorites.findIndex((f) => f.id === id)
      if (index === -1) return state

      const current = favorites[index]
      const nextPinned = !current.pinned
      const updated = { ...current, pinned: nextPinned }
      favorites.splice(index, 1)

      if (nextPinned) {
        favorites.unshift(updated)
      } else {
        let insertIndex = 0
        while (insertIndex < favorites.length && favorites[insertIndex].pinned) {
          insertIndex += 1
        }
        favorites.splice(insertIndex, 0, updated)
      }

      return { favorites }
    }),

  moveFavorite: (id, direction) =>
    set((state) => {
      const favorites = [...state.favorites]
      const index = favorites.findIndex((f) => f.id === id)
      if (index === -1) return state

      const targetIndex = direction === 'up' ? index - 1 : index + 1
      if (targetIndex < 0 || targetIndex >= favorites.length) return state
      if (Boolean(favorites[index].pinned) !== Boolean(favorites[targetIndex].pinned)) {
        return state
      }

      const [moved] = favorites.splice(index, 1)
      favorites.splice(targetIndex, 0, moved)
      return { favorites }
    }),

  reorderFavorites: (newOrder) =>
    set(() => {
      const pinned = newOrder.filter((f) => f.pinned)
      const unpinned = newOrder.filter((f) => !f.pinned)
      return { favorites: [...pinned, ...unpinned] }
    }),

  addFavoriteGroup: (name) =>
    set((state) => {
      const trimmed = name.trim()
      if (!trimmed) return state
      const group: FavoritesGroup = { id: createId(), name: trimmed }
      return { favoritesGroups: [...state.favoritesGroups, group] }
    }),

  renameFavoriteGroup: (id, name) =>
    set((state) => {
      const trimmed = name.trim()
      if (!trimmed) return state
      return {
        favoritesGroups: state.favoritesGroups.map((group) =>
          group.id === id ? { ...group, name: trimmed } : group
        ),
      }
    }),

  deleteFavoriteGroup: (id) =>
    set((state) => ({
      favorites: state.favorites.map((favorite) =>
        favorite.groupId === id ? { ...favorite, groupId: null } : favorite
      ),
      favoritesGroups: state.favoritesGroups.filter((group) => group.id !== id),
    })),

  assignFavoriteGroup: (favoriteId, groupId) =>
    set((state) => ({
      favorites: state.favorites.map((favorite) =>
        favorite.id === favoriteId ? { ...favorite, groupId: groupId ?? null } : favorite
      ),
    })),

  addRecent: (item) =>
    set((state) => {
      const now = Date.now()
      const recent: RecentItem = { ...item, at: now }

      const updated = [recent, ...state.recents.filter((r) => r.id !== item.id)].slice(
        0,
        RECENTS_LIMIT
      )

      return { recents: updated }
    }),

  clearRecents: () => set({ recents: [] }),

  clearFavorites: () => set({ favorites: [] }),

  replaceFavorites: (items) =>
    set(() => {
      if (!Array.isArray(items)) return {}
      const valid = items.filter(isImportableFavorite)
      return { favorites: capFavorites(valid.map((item) => withFavoriteMeta(item))) }
    }),
})

// Newest saves win. The list is newest-first (addFavorite prepends), so the
// overflow is dropped from the end: oldest unpinned entries first, then
// oldest pinned. Input order is always preserved.
export function capFavorites(favorites: FavoritesItem[]): FavoritesItem[] {
  if (favorites.length <= FAVORITES_LIMIT) return favorites
  const overflow = favorites.length - FAVORITES_LIMIT
  const drop = new Set<number>()
  for (let i = favorites.length - 1; i >= 0 && drop.size < overflow; i -= 1) {
    if (!favorites[i].pinned) drop.add(i)
  }
  for (let i = favorites.length - 1; i >= 0 && drop.size < overflow; i -= 1) {
    drop.add(i)
  }
  return favorites.filter((_, i) => !drop.has(i))
}

// v4 persisted nav (mode, subView) alongside prefs. Carry those forward
// once so the upgrade keeps the current view, then v5 writes omit nav
// through partialize below. v6 adds the persisted nearby radius; older
// entries fall back to the default and out-of-range values are clamped
// back into the slider band.
export function migratePersistedState(persistedState: unknown) {
  const state = persistedState as Partial<AppState> | undefined
  const favorites = capFavorites(
    (state?.favorites ?? []).map((favorite) => withFavoriteMeta(favorite))
  )

  return {
    mode: state?.mode ?? 'kmb',
    subView: state?.subView ?? 'stops',
    lang: state?.lang ?? 'tc',
    routeFilterMode: state?.routeFilterMode ?? 'simple',
    autoRefreshSeconds: state?.autoRefreshSeconds ?? 15,
    nearbyRadiusKm:
      typeof state?.nearbyRadiusKm === 'number'
        ? clampNearbyRadiusKm(state.nearbyRadiusKm)
        : NEARBY_RADIUS_DEFAULT_KM,
    favorites,
    favoritesGroups: state?.favoritesGroups ?? [],
    recents: state?.recents ?? [],
  }
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get, api) => ({
      ...createNavSlice(set, get, api),
      ...createPrefsSlice(set, get, api),
    }),
    {
      name: 'hk-eta',
      version: 6,
      // Direct persist write. The previous 300 ms debounced localStorage
      // wrapper plus beforeunload flush could lose the last write on
      // mobile, where beforeunload often never fires. Zustand now writes
      // synchronously on every set, which mobile browsers persist
      // reliably without a flush hook.
      storage: createJSONStorage(() => localStorage),
      migrate: (persistedState) => migratePersistedState(persistedState),
      partialize: (state) => ({
        lang: state.lang,
        routeFilterMode: state.routeFilterMode,
        autoRefreshSeconds: state.autoRefreshSeconds,
        nearbyRadiusKm: state.nearbyRadiusKm,
        favorites: state.favorites,
        favoritesGroups: state.favoritesGroups,
        recents: state.recents,
      }),
    }
  )
)
