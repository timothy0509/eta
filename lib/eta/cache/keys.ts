export const ETA_DB_CACHE_KEY = 'hk-bus-eta:db'
export const ETA_DB_MD5_KEY = 'hk-bus-eta:md5'
export const ETA_DB_INDEX_KEY = 'hk-bus-eta:db-index'

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
