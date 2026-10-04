export const ETA_DB_CACHE_KEY = 'hk-bus-eta:db'
export const ETA_DB_MD5_KEY = 'hk-bus-eta:md5'
export const ETA_DB_INDEX_KEY = 'hk-bus-eta:db-index:v3'
// v3: GMB variant keys carry gtfsId regions (StopRouteEntry, KmbRouteStopLite
// and routeVariantIndex are region-aware). v2 payloads must not be reused.
export const KMB_STOPS_CACHE_KEY = 'kmb:stops:v2'
export const KMB_STOPS_MAPPED_CACHE_KEY = 'kmb:stops:mapped:v1'
// v2: entries carry the GMB gtfsId region. v1 payloads merge regions.
export const KMB_ROUTE_STOPS_MAPPED_CACHE_KEY = 'kmb:route-stops:mapped:v2'
export const KMB_ROUTES_MAPPED_CACHE_KEY = 'kmb:routes:mapped:v2'

export function kmbStopEtaKey(stopId: string): string {
  return `stop-eta:${String(stopId ?? '').trim()}`
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

export function lrtRouteEtaKey(params: {
  route: string
  bound: string
  serviceType: string
  stationId: string
  language: string
}): string {
  return `lrt-route-eta:${params.route}|${params.bound}|${params.serviceType}|${params.stationId}|${params.language}`
}
