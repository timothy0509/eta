import { useAppStore } from '@/lib/store'
import { useShallow } from 'zustand/shallow'

export const useAppStoreState = () =>
  useAppStore(
    useShallow((s) => ({
      mode: s.mode,
      lang: s.lang,
      routeFilterMode: s.routeFilterMode,
      autoRefreshSeconds: s.autoRefreshSeconds,
    }))
  )

export const useAppStoreActions = () =>
  useAppStore(
    useShallow((s) => ({
      setMode: s.setMode,
      setLang: s.setLang,
      setRouteFilterMode: s.setRouteFilterMode,
      setAutoRefreshSeconds: s.setAutoRefreshSeconds,
      addFavorite: s.addFavorite,
      addRecent: s.addRecent,
    }))
  )
