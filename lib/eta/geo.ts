import type { UiLanguage } from '@/lib/eta/types'

const EARTH_RADIUS_KM = 6371

export type GeoPoint = { lat: number; lng: number }

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
 * applied to restrict the number of results.
 */
export function computeNearbyStops<T extends GeoPoint>(
  user: GeoPoint,
  stops: T[],
  limit?: number
): Array<T & { distanceKm: number }> {
  const withDistance = stops.map((stop) => ({
    ...stop,
    distanceKm: haversineDistanceKm(user, stop),
  }))

  withDistance.sort((a, b) => a.distanceKm - b.distanceKm)

  if (limit && limit > 0) {
    return withDistance.slice(0, limit)
  }

  return withDistance
}
