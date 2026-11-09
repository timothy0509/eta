export const ETA_DB_CACHE_KEY = 'hk-bus-eta:db'
export const ETA_DB_MD5_KEY = 'hk-bus-eta:md5'
// v6: indexes carry both the LWB company split (TD GTFS operator
// classification) and the joint KMB/CTB route merge. Bumped past both v3
// (main) and v5 (PR) so neither stale shape is read.
export const ETA_DB_INDEX_KEY = 'hk-bus-eta:db-index:v6'
export const KMB_STOPS_CACHE_KEY = 'kmb:stops:v4'
export const KMB_STOPS_MAPPED_CACHE_KEY = 'kmb:stops:mapped:v3'
export const KMB_ROUTE_STOPS_MAPPED_CACHE_KEY = 'kmb:route-stops:mapped:v5'
export const KMB_ROUTES_MAPPED_CACHE_KEY = 'kmb:routes:mapped:v5'

export function kmbStopEtaKey(stopId: string, preferredOperator?: string | null): string {
  const stop = String(stopId ?? '').trim()
  const preferred = String(preferredOperator ?? '')
    .trim()
    .toLowerCase()
  return preferred ? `stop-eta:${stop}:${preferred}` : `stop-eta:${stop}`
}

export function mtrScheduleKey(params: { line: string; sta: string; lang: string }): string {
  return `mtr:${params.line}:${params.sta}:${params.lang}`
}

export function lrtScheduleKey(params: {
  route: string
  stationId: string
  lang?: string
}): string {
  const lang = params.lang ? `:${params.lang}` : ''
  return `lrt:${params.route}:${params.stationId}${lang}`
}

export function kmbRouteGeometryKey(variantKey: string): string {
  return `kmb-route-geometry:${variantKey}`
}

export function routeWaypointsKey(gtfsId: string, direction: string): string {
  return `route-waypoints:${gtfsId}:${direction}`
}

export function lrtRouteEtaKey(params: {
  route: string
  bound: string
  serviceType: string
  stationId: string
  language: string
}): string {
  return `lrt-route-eta:${params.route}|${params.bound}|${params.serviceType}|${params.stationId}|${params.language}`
}
