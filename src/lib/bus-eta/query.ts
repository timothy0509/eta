import { fetchEtaDb, fetchEtaDbMd5, fetchEtas, type Company } from 'hk-bus-eta'

import { COMPANY_PRIORITY, DEFAULT_LANGUAGE, ETA_DB_CACHE_TTL_MS } from './constants'
import { normalizeText, toMinutes } from './format'
import { readEtaDbCache, writeEtaDbCache } from './storage'
import type {
  EtaResult,
  EtaDbState,
  Language,
  RouteRecord,
  RouteSearchResult,
  RouteStop,
} from './types'

function pickTerminalLabel(
  terminal: { en: string; zh: string },
  language: Language,
) {
  return language === 'zh' ? terminal.zh : terminal.en
}

function sortCompanies(companies: Company[]) {
  return [...companies].sort((a, b) => {
    return COMPANY_PRIORITY.indexOf(a) - COMPANY_PRIORITY.indexOf(b)
  })
}

function mapEtaDbToRecords(
  routeList: Record<string, RouteRecord['entry']>,
) {
  return Object.entries(routeList).map(([id, entry]) => ({
    id,
    entry,
  }))
}

function isCacheFresh(cache: EtaDbState) {
  return Date.now() - cache.fetchedAt < ETA_DB_CACHE_TTL_MS
}

export async function loadEtaDb() {
  const cache = readEtaDbCache()
  if (cache && isCacheFresh(cache)) {
    return cache.db
  }

  const [md5, db] = await Promise.all([fetchEtaDbMd5(), fetchEtaDb()])

  if (cache && cache.md5 === md5) {
    const refreshed = {
      ...cache,
      fetchedAt: Date.now(),
    }
    writeEtaDbCache(refreshed)
    return refreshed.db
  }

  const nextCache = {
    db,
    md5,
    fetchedAt: Date.now(),
  } satisfies EtaDbState

  writeEtaDbCache(nextCache)
  return db
}

export async function searchRoutes({
  keyword,
  language = DEFAULT_LANGUAGE,
  limit = 40,
}: {
  keyword: string
  language?: Language
  limit?: number
}) {
  const db = await loadEtaDb()
  const normalizedKeyword = normalizeText(keyword)

  if (!normalizedKeyword) {
    return []
  }

  const records = mapEtaDbToRecords(db.routeList)
  const results: RouteSearchResult[] = []

  for (const { id, entry } of records) {
    const origin = pickTerminalLabel(entry.orig, language)
    const destination = pickTerminalLabel(entry.dest, language)

    const haystack = normalizeText(
      `${entry.route} ${entry.serviceType} ${origin} ${destination} ${entry.co.join(' ')}`,
    )

    if (!haystack.includes(normalizedKeyword)) {
      continue
    }

    results.push({
      id,
      route: entry.route,
      serviceType: entry.serviceType,
      companies: sortCompanies(entry.co),
      origin,
      destination,
    })
  }

  return results.slice(0, limit)
}

export async function getRouteStops({
  routeId,
  company,
  language = DEFAULT_LANGUAGE,
}: {
  routeId: string
  company: Company
  language?: Language
}) {
  const db = await loadEtaDb()
  const entry = db.routeList[routeId]

  if (!entry) {
    throw new Error(`Route not found: ${routeId}`)
  }

  const stopIds = entry.stops[company]
  if (!stopIds || stopIds.length === 0) {
    return []
  }

  const stops: RouteStop[] = []

  stopIds.forEach((stopId, index) => {
    const stop = db.stopList[stopId]
    if (!stop) {
      return
    }

    stops.push({
      seq: index,
      stopId,
      company,
      name: language === 'zh' ? stop.name.zh : stop.name.en,
      location: stop.location,
    })
  })

  return stops
}

export async function getStopEtas({
  routeId,
  seq,
  language = DEFAULT_LANGUAGE,
}: {
  routeId: string
  seq: number
  language?: Language
}) {
  const db = await loadEtaDb()
  const entry = db.routeList[routeId]

  if (!entry) {
    throw new Error(`Route not found: ${routeId}`)
  }

  const etas = await fetchEtas({
    ...entry,
    seq,
    language,
    stopList: db.stopList,
    holidays: db.holidays,
    serviceDayMap: db.serviceDayMap,
  })

  return etas.map((item) => {
    const isoTime = item.eta || null
    return {
      company: item.co,
      destination: language === 'zh' ? item.dest.zh : item.dest.en,
      isoTime,
      minutes: isoTime ? toMinutes(isoTime) : null,
      remark: language === 'zh' ? item.remark.zh : item.remark.en,
    } satisfies EtaResult
  })
}

export async function getRouteById(routeId: string) {
  const db = await loadEtaDb()
  const entry = db.routeList[routeId]
  if (!entry) {
    return null
  }
  return {
    id: routeId,
    entry,
  } satisfies RouteRecord
}
