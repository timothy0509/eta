/**
 * Canonical LRT stop ID helpers.
 * The ETA DB stores unpadded IDs (LR1, LR10, LR100) — not LR001/LR010.
 */

export function lrtStopIdToStationId(stopId: string): string | null {
  const normalized = String(stopId ?? '')
    .trim()
    .toUpperCase()
  if (!normalized.startsWith('LR')) return null
  const numeric = normalized.slice(2)
  const parsed = parseInt(numeric, 10)
  if (Number.isNaN(parsed)) return null
  return String(parsed)
}

export function stationIdToLrtStopId(stationId: string): string | null {
  const raw = String(stationId ?? '').trim()
  if (!raw) return null

  const fromLr = lrtStopIdToStationId(raw.startsWith('LR') ? raw : `LR${raw}`)
  if (!fromLr) return null
  return `LR${fromLr}`
}

export function lrtStopIdsEqual(a: string, b: string): boolean {
  const canonicalA = stationIdToLrtStopId(a)
  const canonicalB = stationIdToLrtStopId(b)
  if (!canonicalA || !canonicalB) return false
  return canonicalA === canonicalB
}
