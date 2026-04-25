import type { Company } from 'hk-bus-eta'

import { getRouteById, getRouteStops, getStopEtas, loadEtaDb, searchRoutes } from './query'
import {
  routeSearchParamsSchema,
  routeStopsParamsSchema,
  stopEtaParamsSchema,
} from './schemas'
import type { Language } from './types'

export async function primeEtaDb() {
  return loadEtaDb()
}

export async function searchRoutesApi(params: {
  keyword: string
  language?: Language
  limit?: number
}) {
  const parsed = routeSearchParamsSchema.parse(params)
  return searchRoutes(parsed)
}

export async function getRouteStopsApi(params: {
  routeId: string
  company: Company
  language?: Language
}) {
  const parsed = routeStopsParamsSchema.parse(params)
  return getRouteStops(parsed)
}

export async function getStopEtasApi(params: {
  routeId: string
  seq: number
  language?: Language
}) {
  const parsed = stopEtaParamsSchema.parse(params)
  return getStopEtas(parsed)
}

export async function getRouteByIdApi(routeId: string) {
  return getRouteById(routeId)
}
