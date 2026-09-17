import type { UiLanguage } from '@/lib/eta/types'

const EARTH_RADIUS_KM = 6371

export type GeoPoint = { lat: number; lng: number }

export function isValidGeoPoint(p: unknown): p is GeoPoint {
  if (typeof p !== 'object' || p === null) return false
  const { lat, lng } = p as { lat: unknown; lng: unknown }
  return (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    Number.isFinite(lat) &&
    Number.isFinite(lng)
  )
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180
}

/**
 * Calculates the great-circle distance between two lat/lng points using the haversine formula.
 * Returns distance in kilometres.
 */
export function haversineDistanceKm(a: GeoPoint, b: GeoPoint): number {
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)

  const sinLat = Math.sin(dLat / 2)
  const sinLng = Math.sin(dLng / 2)

  const x = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng
  const c = 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x))

  return EARTH_RADIUS_KM * c
}

const DISTANCE_LABELS: Record<UiLanguage, { m: string; km: string }> = {
  en: { m: 'm', km: 'km' },
  tc: { m: '米', km: '公里' },
  sc: { m: '米', km: '公里' },
}

/**
 * Formats a distance in kilometres into a localized, human-readable string.
 * Values under 1 km are shown in metres; 1 km and above are shown in kilometres
 * rounded to one decimal place.
 */
export function formatDistanceKm(km: number, lang: UiLanguage): string {
  const labels = DISTANCE_LABELS[lang]
  if (!Number.isFinite(km) || km < 0) return '—'
  if (km < 1) {
    const metres = Math.max(0, Math.round(km * 1000))
    return `${metres} ${labels.m}`
  }
  const rounded = Math.round(km * 10) / 10
  return `${rounded.toFixed(rounded % 1 === 0 ? 0 : 1)} ${labels.km}`
}

/**
 * Computes nearby stops sorted by distance from the user's location.
 * Returns a new array augmented with `distanceKm`. An optional `limit` can be
 * applied to restrict the number of results, and an optional `maxDistanceKm`
 * prefilters by a rough bounding box before the haversine runs, so a 6k-stop
 * list only pays for the few hundred stops actually in range.
 */
export function computeNearbyStops<T extends GeoPoint>(
  user: GeoPoint,
  stops: T[],
  limit?: number,
  maxDistanceKm?: number
): Array<T & { distanceKm: number }> {
  if (!isValidGeoPoint(user)) return []
  let candidates = stops.filter((stop) => isValidGeoPoint(stop))
  if (maxDistanceKm && maxDistanceKm > 0) {
    // 1 degree of latitude is about 111 km; longitude shrinks by cos(lat).
    const latDelta = maxDistanceKm / 111
    const lngDelta = maxDistanceKm / (111 * Math.max(0.2, Math.cos(toRad(user.lat))))
    candidates = candidates.filter(
      (stop) =>
        Math.abs(stop.lat - user.lat) <= latDelta && Math.abs(stop.lng - user.lng) <= lngDelta
    )
  }
  const withDistance = candidates.map((stop) => ({
    ...stop,
    distanceKm: haversineDistanceKm(user, stop),
  }))

  withDistance.sort((a, b) => a.distanceKm - b.distanceKm)

  if (limit && limit > 0) {
    return withDistance.slice(0, limit)
  }

  return withDistance
}
