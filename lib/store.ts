"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

import type { TransportMode, UiLanguage } from "@/lib/eta/types";

export type RouteFilterMode = "simple" | "advanced";

export type FavoritesItem =
  // KMB: single stop
  | {
      id: string;
      mode: "kmb";
      title: string;
      stopId: string;
      // Route filter - simple mode (legacy field name for backward compat)
      route?: string;
      serviceType?: string;
      // Extended route filter fields
      routeFilterMode?: RouteFilterMode;
      entries?: { variantKey: string }[];
    }
  // KMB: grouped stops (multiple stops with same name)
  | {
      id: string;
      mode: "kmb";
      title: string;
      stopIds: string[];
      // Route filter
      routeFilterMode?: RouteFilterMode;
      route?: string;
      entries?: { variantKey: string }[];
    }
  // KMB: contains query
  | {
      id: string;
      mode: "kmb";
      title: string;
      query: string;
      // Route filter - simple mode (legacy field name for backward compat)
      route?: string;
      serviceType?: string;
      // Extended route filter fields
      routeFilterMode?: RouteFilterMode;
      entries?: { variantKey: string }[];
    }
  | {
      id: string;
      mode: "mtr";
      // Titles are stored for display convenience only.
      // They may be regenerated in the current UI language.
      title: string;
      // Keep one representative line for backward compatibility.
      line: string;
      sta: string;
    }
  | {
      id: string;
      mode: "lrt";
      title: string;
      stationId: string;
    };

export type RecentItem = FavoritesItem & {
  at: number;
};

type AppState = {
  mode: TransportMode;
  lang: UiLanguage;
  routeFilterMode: RouteFilterMode;
  autoRefreshSeconds: number;

  /** Whether the Saved sheet is open (persisted). */
  savedOpen?: boolean;

  favorites: FavoritesItem[];
  recents: RecentItem[];

  setMode: (mode: TransportMode) => void;
  setLang: (lang: UiLanguage) => void;
  setRouteFilterMode: (mode: RouteFilterMode) => void;
  setAutoRefreshSeconds: (seconds: number) => void;

  setSavedOpen: (open: boolean) => void;

  addFavorite: (item: FavoritesItem) => void;
  removeFavorite: (id: string) => void;

  addRecent: (item: FavoritesItem) => void;
  clearRecents: () => void;
};

const RECENTS_LIMIT = 12;

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      mode: "kmb",
      lang: "tc",
      routeFilterMode: "simple",
      autoRefreshSeconds: 15,
      savedOpen: true,

      favorites: [],
      recents: [],

      setMode: (mode) => set({ mode }),
      setLang: (lang) => set({ lang }),
      setRouteFilterMode: (routeFilterMode) => set({ routeFilterMode }),
      setAutoRefreshSeconds: (seconds) => set({ autoRefreshSeconds: seconds }),
      setSavedOpen: (savedOpen) => set({ savedOpen }),

      addFavorite: (item) =>
        set((state) => {
          if (state.favorites.some((f) => f.id === item.id)) return state;
          return { favorites: [item, ...state.favorites] };
        }),

      removeFavorite: (id) =>
        set((state) => ({
          favorites: state.favorites.filter((f) => f.id !== id),
        })),

      addRecent: (item) =>
        set((state) => {
          const now = Date.now();
          const recent: RecentItem = { ...item, at: now };

          const updated = [
            recent,
            ...state.recents.filter((r) => r.id !== item.id),
          ].slice(0, RECENTS_LIMIT);

          return { recents: updated };
        }),

      clearRecents: () => set({ recents: [] }),
    }),
    {
      name: "hk-eta",
      partialize: (state) => ({
        mode: state.mode,
        lang: state.lang,
        routeFilterMode: state.routeFilterMode,
        autoRefreshSeconds: state.autoRefreshSeconds,
        savedOpen: state.savedOpen,
        favorites: state.favorites,
        recents: state.recents,
      }),
    }
  )
);
