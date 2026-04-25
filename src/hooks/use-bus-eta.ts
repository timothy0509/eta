import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Company } from 'hk-bus-eta'

import {
  getRouteByIdApi,
  getRouteStopsApi,
  getStopEtasApi,
  primeEtaDb,
  searchRoutesApi,
} from '@/lib/bus-eta/api'
import type { Language } from '@/lib/bus-eta/types'

export function useEtaDb() {
  return useQuery({
    queryKey: ['eta-db'],
    queryFn: () => primeEtaDb(),
    staleTime: 1000 * 60 * 60,
  })
}

export function useRouteSearch(keyword: string, language: Language = 'en') {
  return useQuery({
    queryKey: ['route-search', keyword, language],
    queryFn: () => searchRoutesApi({ keyword, language }),
    enabled: keyword.trim().length > 0,
    staleTime: 1000 * 30,
  })
}

export function useRouteStops(
  routeId: string | null,
  company: Company | null,
  language: Language = 'en',
) {
  return useQuery({
    queryKey: ['route-stops', routeId, company, language],
    queryFn: () => getRouteStopsApi({ routeId: routeId!, company: company!, language }),
    enabled: Boolean(routeId && company),
    staleTime: 1000 * 60 * 10,
  })
}

export function useStopEtas(
  routeId: string | null,
  seq: number | null,
  language: Language = 'en',
) {
  return useQuery({
    queryKey: ['stop-etas', routeId, seq, language],
    queryFn: () => getStopEtasApi({ routeId: routeId!, seq: seq!, language }),
    enabled: routeId !== null && seq !== null,
    refetchInterval: 15000,
    staleTime: 5000,
  })
}

export function useRefreshEtaDb() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => primeEtaDb(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['eta-db'] })
      await queryClient.invalidateQueries({ queryKey: ['route-search'] })
      await queryClient.invalidateQueries({ queryKey: ['route-stops'] })
      await queryClient.invalidateQueries({ queryKey: ['stop-etas'] })
    },
  })
}

export function useRoute(routeId: string | null) {
  return useQuery({
    queryKey: ['route', routeId],
    queryFn: () => getRouteByIdApi(routeId!),
    enabled: Boolean(routeId),
    staleTime: 1000 * 60 * 10,
  })
}
