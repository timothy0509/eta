'use client'

import type { SubView, TransportMode, UiLanguage } from '@/lib/eta/types'
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

// Persisted prefs slice: language, filter defaults, refresh interval plus
// favorites, groups and recents. Field names stay backward compatible so
// old favorites still decode after the v4 to v5 bump.
type PrefsSlice = {
  lang: UiLanguage
  routeFilterMode: RouteFilterMode
  autoRefreshSeconds: number

  favorites: FavoritesItem[]
  favoritesGroups: FavoritesGroup[]
  recents: RecentItem[]

  setLang: (lang: UiLanguage) => void
  setRouteFilterMode: (mode: RouteFilterMode) => void
  setAutoRefreshSeconds: (seconds: number) => void
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
}

type AppState = NavSlice & PrefsSlice

const RECENTS_LIMIT = 12

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

  favorites: [],
  favoritesGroups: [],
  recents: [],

  setLang: (lang) => set({ lang }),
  setRouteFilterMode: (routeFilterMode) => set({ routeFilterMode }),
  setAutoRefreshSeconds: (seconds) => set({ autoRefreshSeconds: seconds }),

  addFavorite: (item) =>
    set((state) => {
      if (state.favorites.some((f) => f.id === item.id)) return state
      return { favorites: [withFavoriteMeta(item), ...state.favorites] }
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
})

export const useAppStore = create<AppState>()(
  persist(
    (set, get, api) => ({
      ...createNavSlice(set, get, api),
      ...createPrefsSlice(set, get, api),
    }),
    {
      name: 'hk-eta',
      version: 5,
      // Direct persist write. The previous 300 ms debounced localStorage
      // wrapper plus beforeunload flush could lose the last write on
      // mobile, where beforeunload often never fires. Zustand now writes
      // synchronously on every set, which mobile browsers persist
      // reliably without a flush hook.
      storage: createJSONStorage(() => localStorage),
      migrate: (persistedState, _fromVersion) => {
        const state = persistedState as Partial<AppState> | undefined
        const favorites = (state?.favorites ?? []).map((favorite) => withFavoriteMeta(favorite))

        // v4 persisted nav (mode, subView) alongside prefs. Carry those
        // forward once so the upgrade keeps the current view, then v5
        // writes omit nav through partialize below.
        return {
          mode: state?.mode ?? 'kmb',
          subView: state?.subView ?? 'stops',
          lang: state?.lang ?? 'tc',
          routeFilterMode: state?.routeFilterMode ?? 'simple',
          autoRefreshSeconds: state?.autoRefreshSeconds ?? 15,
          favorites,
          favoritesGroups: state?.favoritesGroups ?? [],
          recents: state?.recents ?? [],
        }
      },
      partialize: (state) => ({
        lang: state.lang,
        routeFilterMode: state.routeFilterMode,
        autoRefreshSeconds: state.autoRefreshSeconds,
        favorites: state.favorites,
        favoritesGroups: state.favoritesGroups,
        recents: state.recents,
      }),
    }
  )
)
