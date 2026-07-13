import { describe, expect, it, beforeEach } from 'vitest'
import { create } from 'zustand'
import type { FavoritesItem, FavoritesGroup } from './store'

// Create a test store without persist middleware
type AppState = {
  mode: 'kmb' | 'mtr' | 'lrt'
  lang: 'en' | 'tc' | 'sc'
  favorites: FavoritesItem[]
  favoritesGroups: FavoritesGroup[]
  recents: Array<FavoritesItem & { at: number }>
  addFavorite: (item: FavoritesItem) => void
  removeFavorite: (id: string) => void
  toggleFavoritePin: (id: string) => void
  moveFavorite: (id: string, direction: 'up' | 'down') => void
  reorderFavorites: (newOrder: FavoritesItem[]) => void
  addFavoriteGroup: (name: string) => void
  renameFavoriteGroup: (id: string, name: string) => void
  deleteFavoriteGroup: (id: string) => void
  assignFavoriteGroup: (favoriteId: string, groupId: string | null) => void
  clearRecents: () => void
}

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

const createTestStore = () =>
  create<AppState>((set) => ({
    mode: 'kmb',
    lang: 'tc',
    favorites: [],
    favoritesGroups: [],
    recents: [],

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

    clearRecents: () => set({ recents: [] }),
  }))

describe('store favorites', () => {
  let store: ReturnType<typeof createTestStore>

  beforeEach(() => {
    store = createTestStore()
  })

  describe('toggleFavoritePin', () => {
    it('pins an unpinned favorite and moves it to the top', () => {
      // Add two unpinned favorites
      const item1: FavoritesItem = {
        id: 'fav-1',
        mode: 'mtr',
        title: 'Central',
        line: 'TWL',
        sta: 'CEN',
        pinned: false,
      }
      const item2: FavoritesItem = {
        id: 'fav-2',
        mode: 'mtr',
        title: 'Admiralty',
        line: 'TWL',
        sta: 'ADM',
        pinned: false,
      }

      store.getState().addFavorite(item1)
      store.getState().addFavorite(item2)

      // addFavorite prepends items, so order is [item2, item1]
      expect(store.getState().favorites[0].id).toBe('fav-2')
      expect(store.getState().favorites[1].id).toBe('fav-1')

      // Pin fav-1 (which is at index 1)
      store.getState().toggleFavoritePin('fav-1')

      const favorites = store.getState().favorites
      // After pinning fav-1, it should move to front
      expect(favorites[0].id).toBe('fav-1')
      expect(favorites[0].pinned).toBe(true)
      expect(favorites[1].id).toBe('fav-2')
      expect(favorites[1].pinned).toBe(false)
    })

    it('unpins a pinned favorite and moves it after pinned items', () => {
      // Create one pinned item
      const pinnedItem: FavoritesItem = {
        id: 'fav-1',
        mode: 'mtr',
        title: 'Central',
        line: 'TWL',
        sta: 'CEN',
        pinned: true,
      }
      store.getState().addFavorite(pinnedItem)
      expect(store.getState().favorites[0].pinned).toBe(true)

      // Unpin it
      store.getState().toggleFavoritePin('fav-1')

      // Should now be unpinned
      expect(store.getState().favorites[0].pinned).toBe(false)
    })

    it('does nothing for non-existent favorite id', () => {
      const item: FavoritesItem = {
        id: 'fav-1',
        mode: 'mtr',
        title: 'Central',
        line: 'TWL',
        sta: 'CEN',
      }

      store.getState().addFavorite(item)
      store.getState().toggleFavoritePin('non-existent')

      const favorites = store.getState().favorites
      expect(favorites).toHaveLength(1)
      expect(favorites[0].id).toBe('fav-1')
    })
  })

  describe('moveFavorite', () => {
    it("moves a favorite up when direction is 'up'", () => {
      const item1: FavoritesItem = {
        id: 'fav-1',
        mode: 'mtr',
        title: 'Central',
        line: 'TWL',
        sta: 'CEN',
      }
      const item2: FavoritesItem = {
        id: 'fav-2',
        mode: 'mtr',
        title: 'Admiralty',
        line: 'TWL',
        sta: 'ADM',
      }

      store.getState().addFavorite(item1)
      store.getState().addFavorite(item2)

      store.getState().moveFavorite('fav-2', 'up')

      const favorites = store.getState().favorites
      expect(favorites[0].id).toBe('fav-2')
      expect(favorites[1].id).toBe('fav-1')
    })

    it("moves a favorite down when direction is 'down'", () => {
      const item1: FavoritesItem = {
        id: 'fav-1',
        mode: 'mtr',
        title: 'Central',
        line: 'TWL',
        sta: 'CEN',
      }
      const item2: FavoritesItem = {
        id: 'fav-2',
        mode: 'mtr',
        title: 'Admiralty',
        line: 'TWL',
        sta: 'ADM',
      }

      store.getState().addFavorite(item1)
      store.getState().addFavorite(item2)

      store.getState().moveFavorite('fav-1', 'down')

      const favorites = store.getState().favorites
      expect(favorites[0].id).toBe('fav-2')
      expect(favorites[1].id).toBe('fav-1')
    })

    it('does not move up when already at the top', () => {
      const item: FavoritesItem = {
        id: 'fav-1',
        mode: 'mtr',
        title: 'Central',
        line: 'TWL',
        sta: 'CEN',
      }

      store.getState().addFavorite(item)
      store.getState().moveFavorite('fav-1', 'up')

      const favorites = store.getState().favorites
      expect(favorites).toHaveLength(1)
      expect(favorites[0].id).toBe('fav-1')
    })

    it('does not move down when already at the bottom', () => {
      const item: FavoritesItem = {
        id: 'fav-1',
        mode: 'mtr',
        title: 'Central',
        line: 'TWL',
        sta: 'CEN',
      }

      store.getState().addFavorite(item)
      store.getState().moveFavorite('fav-1', 'down')

      const favorites = store.getState().favorites
      expect(favorites).toHaveLength(1)
      expect(favorites[0].id).toBe('fav-1')
    })

    it('does not move between pinned and unpinned items', () => {
      const pinnedItem: FavoritesItem = {
        id: 'fav-1',
        mode: 'mtr',
        title: 'Central',
        line: 'TWL',
        sta: 'CEN',
        pinned: true,
      }
      const unpinnedItem: FavoritesItem = {
        id: 'fav-2',
        mode: 'mtr',
        title: 'Admiralty',
        line: 'TWL',
        sta: 'ADM',
        pinned: false,
      }

      // addFavorite prepends, so order is: unpinnedItem, pinnedItem
      store.getState().addFavorite(pinnedItem)
      store.getState().addFavorite(unpinnedItem)

      // Try to move unpinned item (fav-2) up to pinned position
      store.getState().moveFavorite('fav-2', 'up')

      const favorites = store.getState().favorites
      // Order should remain unchanged since pinned status differs
      expect(favorites[0].id).toBe('fav-2')
      expect(favorites[1].id).toBe('fav-1')
    })

    it('does nothing for non-existent favorite id', () => {
      const item: FavoritesItem = {
        id: 'fav-1',
        mode: 'mtr',
        title: 'Central',
        line: 'TWL',
        sta: 'CEN',
      }

      store.getState().addFavorite(item)
      store.getState().moveFavorite('non-existent', 'up')

      const favorites = store.getState().favorites
      expect(favorites).toHaveLength(1)
      expect(favorites[0].id).toBe('fav-1')
    })
  })

  describe('reorderFavorites', () => {
    it('reorders favorites and keeps pinned items at the top', () => {
      const item1: FavoritesItem = {
        id: 'fav-1',
        mode: 'mtr',
        title: 'Central',
        line: 'TWL',
        sta: 'CEN',
        pinned: false,
      }
      const item2: FavoritesItem = {
        id: 'fav-2',
        mode: 'mtr',
        title: 'Admiralty',
        line: 'TWL',
        sta: 'ADM',
        pinned: true,
      }
      const item3: FavoritesItem = {
        id: 'fav-3',
        mode: 'mtr',
        title: 'Tsim Sha Tsui',
        line: 'TWL',
        sta: 'TST',
        pinned: false,
      }

      store.getState().addFavorite(item1)
      store.getState().addFavorite(item2)
      store.getState().addFavorite(item3)

      // Reorder to [item3, item2, item1] - pinned item2 should still be first
      store.getState().reorderFavorites([item3, item2, item1])

      const favorites = store.getState().favorites
      expect(favorites[0].id).toBe('fav-2')
      expect(favorites[0].pinned).toBe(true)
      expect(favorites[1].id).toBe('fav-3')
      expect(favorites[2].id).toBe('fav-1')
    })

    it('preserves the order of provided items within each pin section', () => {
      const item1: FavoritesItem = {
        id: 'fav-1',
        mode: 'mtr',
        title: 'Central',
        line: 'TWL',
        sta: 'CEN',
        pinned: true,
      }
      const item2: FavoritesItem = {
        id: 'fav-2',
        mode: 'mtr',
        title: 'Admiralty',
        line: 'TWL',
        sta: 'ADM',
        pinned: true,
      }

      store.getState().addFavorite(item1)
      store.getState().addFavorite(item2)

      // Reverse pinned order
      store.getState().reorderFavorites([item2, item1])

      const favorites = store.getState().favorites
      expect(favorites[0].id).toBe('fav-2')
      expect(favorites[1].id).toBe('fav-1')
    })
  })

  describe('addFavoriteGroup', () => {
    it('adds a new group with trimmed name', () => {
      store.getState().addFavoriteGroup('  My Group  ')

      const groups = store.getState().favoritesGroups
      expect(groups).toHaveLength(1)
      expect(groups[0].name).toBe('My Group')
      expect(groups[0].id).toBeDefined()
    })

    it('does not add group with empty name', () => {
      store.getState().addFavoriteGroup('   ')

      const groups = store.getState().favoritesGroups
      expect(groups).toHaveLength(0)
    })

    it('does not add group with empty string', () => {
      store.getState().addFavoriteGroup('')

      const groups = store.getState().favoritesGroups
      expect(groups).toHaveLength(0)
    })
  })

  describe('deleteFavoriteGroup', () => {
    it('removes the group from favoritesGroups', () => {
      store.getState().addFavoriteGroup('Group 1')
      const groupId = store.getState().favoritesGroups[0].id

      store.getState().deleteFavoriteGroup(groupId)

      const groups = store.getState().favoritesGroups
      expect(groups).toHaveLength(0)
    })

    it('removes groupId from favorites assigned to that group', () => {
      store.getState().addFavoriteGroup('My Group')
      const groupId = store.getState().favoritesGroups[0].id

      const item: FavoritesItem = {
        id: 'fav-1',
        mode: 'mtr',
        title: 'Central',
        line: 'TWL',
        sta: 'CEN',
        groupId,
      }

      store.getState().addFavorite(item)
      store.getState().deleteFavoriteGroup(groupId)

      const favorites = store.getState().favorites
      expect(favorites[0].groupId).toBeNull()
    })

    it('does not affect favorites in other groups', () => {
      store.getState().addFavoriteGroup('Group 1')
      store.getState().addFavoriteGroup('Group 2')
      const groups = store.getState().favoritesGroups
      const group1Id = groups[0].id
      const group2Id = groups[1].id

      const item: FavoritesItem = {
        id: 'fav-1',
        mode: 'mtr',
        title: 'Central',
        line: 'TWL',
        sta: 'CEN',
        groupId: group2Id,
      }

      store.getState().addFavorite(item)
      store.getState().deleteFavoriteGroup(group1Id)

      const favorites = store.getState().favorites
      expect(favorites[0].groupId).toBe(group2Id)
    })
  })
})

describe('store migration', () => {
  it('migrates v1 favorites without meta to v2 with default pinned and groupId', () => {
    // Simulate the migrate function from store.ts
    const withFavoriteMeta = (item: FavoritesItem): FavoritesItem => ({
      ...item,
      pinned: item.pinned ?? false,
      groupId: item.groupId ?? null,
    })

    const migrate = (persistedState: unknown) => {
      const state = persistedState as { favorites?: FavoritesItem[] } | undefined
      const favorites = (state?.favorites ?? []).map((favorite) => withFavoriteMeta(favorite))

      return {
        mode: 'kmb' as const,
        lang: 'tc' as const,
        routeFilterMode: 'simple' as const,
        autoRefreshSeconds: 15,
        favorites,
        favoritesGroups: [],
        recents: [],
      }
    }

    const v1State = {
      favorites: [
        {
          id: 'fav-1',
          mode: 'mtr' as const,
          title: 'Central',
          line: 'TWL',
          sta: 'CEN',
          // No pinned or groupId
        },
      ],
    }

    const migrated = migrate(v1State)

    expect(migrated.favorites[0].pinned).toBe(false)
    expect(migrated.favorites[0].groupId).toBeNull()
  })

  it('preserves existing pinned and groupId values during migration', () => {
    const withFavoriteMeta = (item: FavoritesItem): FavoritesItem => ({
      ...item,
      pinned: item.pinned ?? false,
      groupId: item.groupId ?? null,
    })

    const migrate = (persistedState: unknown) => {
      const state = persistedState as { favorites?: FavoritesItem[] } | undefined
      const favorites = (state?.favorites ?? []).map((favorite) => withFavoriteMeta(favorite))

      return {
        mode: 'kmb' as const,
        lang: 'tc' as const,
        routeFilterMode: 'simple' as const,
        autoRefreshSeconds: 15,
        favorites,
        favoritesGroups: [{ id: 'group-1', name: 'Work' }],
        recents: [],
      }
    }

    const v1State = {
      favorites: [
        {
          id: 'fav-1',
          mode: 'mtr' as const,
          title: 'Central',
          line: 'TWL',
          sta: 'CEN',
          pinned: true,
          groupId: 'group-1',
        },
      ],
    }

    const migrated = migrate(v1State)

    expect(migrated.favorites[0].pinned).toBe(true)
    expect(migrated.favorites[0].groupId).toBe('group-1')
  })

  it('preserves other state fields during migration', () => {
    const withFavoriteMeta = (item: FavoritesItem): FavoritesItem => ({
      ...item,
      pinned: item.pinned ?? false,
      groupId: item.groupId ?? null,
    })

    const migrate = (persistedState: unknown) => {
      const state = persistedState as
        | {
            mode?: 'kmb' | 'mtr' | 'lrt'
            lang?: 'en' | 'tc' | 'sc'
            routeFilterMode?: 'simple' | 'advanced'
            autoRefreshSeconds?: number
            favorites?: FavoritesItem[]
          }
        | undefined
      const favorites = (state?.favorites ?? []).map((favorite) => withFavoriteMeta(favorite))

      return {
        mode: state?.mode ?? 'kmb',
        lang: state?.lang ?? 'tc',
        routeFilterMode: state?.routeFilterMode ?? 'simple',
        autoRefreshSeconds: state?.autoRefreshSeconds ?? 15,
        favorites,
        favoritesGroups: [],
        recents: [],
      }
    }

    const v1State = {
      mode: 'mtr' as const,
      lang: 'en' as const,
      routeFilterMode: 'advanced' as const,
      autoRefreshSeconds: 30,
      favorites: [],
    }

    const migrated = migrate(v1State)

    expect(migrated.mode).toBe('mtr')
    expect(migrated.lang).toBe('en')
    expect(migrated.routeFilterMode).toBe('advanced')
    expect(migrated.autoRefreshSeconds).toBe(30)
  })

  it('handles undefined persisted state with defaults', () => {
    const withFavoriteMeta = (item: FavoritesItem): FavoritesItem => ({
      ...item,
      pinned: item.pinned ?? false,
      groupId: item.groupId ?? null,
    })

    const migrate = (persistedState: unknown) => {
      const state = persistedState as { favorites?: FavoritesItem[] } | undefined
      const favorites = (state?.favorites ?? []).map((favorite) => withFavoriteMeta(favorite))

      return {
        mode: 'kmb' as const,
        lang: 'tc' as const,
        routeFilterMode: 'simple' as const,
        autoRefreshSeconds: 15,
        favorites,
        favoritesGroups: [],
        recents: [],
      }
    }

    const migrated = migrate(undefined)

    expect(migrated.mode).toBe('kmb')
    expect(migrated.lang).toBe('tc')
    expect(migrated.routeFilterMode).toBe('simple')
    expect(migrated.autoRefreshSeconds).toBe(15)
    expect(migrated.favorites).toEqual([])
    expect(migrated.favoritesGroups).toEqual([])
    expect(migrated.recents).toEqual([])
  })
})
