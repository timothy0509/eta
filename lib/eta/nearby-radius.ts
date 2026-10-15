export const NEARBY_RADIUS_MIN_KM = 0.5
export const NEARBY_RADIUS_MAX_KM = 5

/**
 * Clamps the nearby-search radius so the slider (and programmatic changes)
 * stay in a sane 0.5-5 km band, quantized to 250 m steps so the nearby key
 * stays stable across GPS-frame float noise.
 */
export function clampNearbyRadiusKm(km: number): number {
  if (Number.isNaN(km)) return 2
  const clamped = Math.min(NEARBY_RADIUS_MAX_KM, Math.max(NEARBY_RADIUS_MIN_KM, km))
  return Math.round(clamped * 4) / 4
}
