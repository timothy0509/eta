import {
  fetchKmbEtasForStop,
  findKmbRouteInfo,
  listKmbRouteStops,
  listKmbRoutes,
  listKmbStops,
  type KmbEta,
} from '@/lib/eta/hk-bus-eta'
import type { Company } from 'hk-bus-eta'

export type KmbStop = {
  stop: string
  co?: string
  name_en: string
  name_tc: string
  name_sc: string
  lat: string | number
  long: string | number
}

export type KmbEtaEntry = {
  co: string
  route: string
  dir: 'I' | 'O' | string
  service_type: number | string
  seq: number
  stop: string
  dest_en: string
  dest_tc: string
  dest_sc: string
  eta_seq: number
  eta: string // ISO timestamp, may be empty
  rmk_en: string
  rmk_tc: string
  rmk_sc: string
  data_timestamp: string
}

function normalizeDirection(direction: string): 'I' | 'O' | string {
  if (direction === 'inbound') return 'I'
  if (direction === 'outbound') return 'O'
  return direction
}

function mapKmbEtaEntry(eta: KmbEta, stopId: string): KmbEtaEntry {
  const now = new Date().toISOString()
  return {
    co: eta.co ?? 'kmb',
    route: eta.route,
    dir: eta.dir,
    service_type: eta.serviceType,
    seq: eta.seq,
    stop: stopId,
    dest_en: eta.dest?.en ?? '',
    dest_tc: eta.dest?.zh ?? '',
    dest_sc: eta.dest?.zh ?? '',
    eta_seq: eta.etaSeq,
    eta: eta.eta ?? '',
    rmk_en: eta.remark?.en ?? '',
    rmk_tc: eta.remark?.zh ?? '',
    rmk_sc: eta.remark?.zh ?? '',
    data_timestamp: now,
  }
}

export async function getKmbStops(): Promise<KmbStop[]> {
  const stops = await listKmbStops()
  return stops.map((stop) => ({
    stop: stop.stopId,
    name_en: stop.nameEn,
    name_tc: stop.nameTc,
    name_sc: stop.nameSc,
    lat: stop.lat,
    long: stop.lng,
  }))
}

export async function getKmbEta(params: {
  stopId: string
  route: string
  serviceType: string
}): Promise<KmbEtaEntry[]> {
  const etas = await fetchKmbEtasForStop({
    stopId: params.stopId,
    route: params.route,
    serviceType: params.serviceType,
    language: 'tc',
  })
  return etas.map((eta) => mapKmbEtaEntry(eta, params.stopId))
}

/**
 * Fetch all ETAs at a stop using the Stop ETA API.
 * This returns all routes' ETAs in one call, much more efficient than per-route calls.
 * See: https://data.etabus.gov.hk - Stop ETA API (/v1/transport/kmb/stop-eta/{stop_id})
 */
export async function getKmbStopEta(stopId: string): Promise<KmbEtaEntry[]> {
  const etas = await fetchKmbEtasForStop({
    stopId,
    language: 'tc',
  })
  return etas.map((eta) => mapKmbEtaEntry(eta, stopId))
}

export type KmbRouteStopEntry = {
  co: Company
  route: string
  bound: 'I' | 'O' | string
  service_type: number | string
  seq: number | string
  stop: string
}

export async function getKmbRouteStops(): Promise<KmbRouteStopEntry[]> {
  const routeStops = await listKmbRouteStops()
  return routeStops.map((entry) => ({
    co: entry.co,
    route: entry.route,
    bound: entry.bound,
    service_type: entry.serviceType,
    seq: entry.seq,
    stop: entry.stopId,
  }))
}

export type KmbRouteInfo = {
  co: Company
  route: string
  bound: 'I' | 'O' | string
  service_type: number | string
  orig_en: string
  orig_tc: string
  orig_sc: string
  dest_en: string
  dest_tc: string
  dest_sc: string
}

export type KmbRouteListEntry = {
  co: Company
  route: string
  bound: 'I' | 'O' | string
  service_type: number | string
  orig_en: string
  orig_tc: string
  orig_sc: string
  dest_en: string
  dest_tc: string
  dest_sc: string
  data_timestamp?: string
}

export async function getKmbRouteList(): Promise<KmbRouteListEntry[]> {
  const routes = await listKmbRoutes()
  return routes.map((entry) => ({
    co: entry.co,
    route: entry.route,
    bound: entry.bound,
    service_type: entry.serviceType,
    orig_en: entry.origin.en,
    orig_tc: entry.origin.tc,
    orig_sc: entry.origin.sc,
    dest_en: entry.destination.en,
    dest_tc: entry.destination.tc,
    dest_sc: entry.destination.sc,
  }))
}

export async function getKmbRouteInfo(params: {
  co?: Company
  route: string
  direction: 'I' | 'O' | 'inbound' | 'outbound' | string
  serviceType: string
}): Promise<KmbRouteInfo> {
  const bound = normalizeDirection(params.direction)
  const info = await findKmbRouteInfo({
    co: params.co,
    route: params.route,
    bound,
    serviceType: params.serviceType,
  })

  if (!info) {
    throw new Error('KMB route info not found')
  }

  return {
    co: info.co,
    route: info.route,
    bound: info.bound,
    service_type: info.serviceType,
    orig_en: info.origin.en,
    orig_tc: info.origin.tc,
    orig_sc: info.origin.sc,
    dest_en: info.destination.en,
    dest_tc: info.destination.tc,
    dest_sc: info.destination.sc,
  }
}
