export function toMinutes(isoTime: string) {
  const etaDate = new Date(isoTime)
  const now = Date.now()
  const diffMs = etaDate.getTime() - now
  return Math.max(0, Math.round(diffMs / 60000))
}

export function normalizeText(value: string) {
  return value.trim().toLowerCase()
}
