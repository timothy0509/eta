'use client'

import type { SubView, TransportMode, UiLanguage } from '@/lib/eta/types'
import { create } from 'zustand'
import { persist, createJSONStorage, type StateStorage } from 'zustand/middleware'

function createDebouncedLocalStorage(delayMs = 300): StateStorage {
  let timer: ReturnType<typeof setTimeout> | null = null
  let pendingKey: string | null = null
  let pendingValue: string | null = null

  const flush = () => {
    if (pendingKey !== null && pendingValue !== null) {
      localStorage.setItem(pendingKey, pendingValue)
      pendingKey = null
      pendingValue = null
    }
    timer = null
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', flush)
  }

  return {
    getItem: (name) => localStorage.getItem(name),
    setItem: (name, value) => {
      pendingKey = name
      pendingValue = value
      if (timer !== null) clearTimeout(timer)
      timer = setTimeout(flush, delayMs)
    },
    removeItem: (name) => {
      if (timer !== null) clearTimeout(timer)
      timer = null
      pendingKey = null
      pendingValue = null
      localStorage.removeItem(name)
    },
  }
}

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

type AppState = {
  mode: TransportMode
  subView: SubView
  lang: UiLanguage
  routeFilterMode: RouteFilterMode
  autoRefreshSeconds: number

  favorites: FavoritesItem[]
  favoritesGroups: FavoritesGroup[]
  recents: RecentItem[]

  setMode: (mode: TransportMode) => void
  setSubView: (subView: SubView) => void
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

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      mode: 'kmb',
      subView: 'stops',
      lang: 'tc',
      routeFilterMode: 'simple',
      autoRefreshSeconds: 15,

      favorites: [],
      favoritesGroups: [],
      recents: [],

      setMode: (mode) => set({ mode }),
      setSubView: (subView) => set({ subView }),
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
    }),
    {
      name: 'hk-eta',
      version: 4,
      storage: createJSONStorage(() => createDebouncedLocalStorage(300)),
      migrate: (persistedState) => {
        const state = persistedState as Partial<AppState> | undefined
        const favorites = (state?.favorites ?? []).map((favorite) => withFavoriteMeta(favorite))

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
        mode: state.mode,
        subView: state.subView,
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
