export type RmkFlags = {
  scheduled: boolean
}

const SCHEDULED_MARKERS = ['scheduled bus', '原定班次']

function normalizeRemark(value: string | null | undefined): string {
  if (typeof value !== 'string') return ''
  return value.trim().toLowerCase()
}

/**
 * Parse KMB `rmk_*` remarks into the scheduled flag.
 * Pure function over the three language variants.
 */
export function parseRmkFlags(
  rmk_tc?: string | null,
  rmk_sc?: string | null,
  rmk_en?: string | null
): RmkFlags {
  const remarks = [normalizeRemark(rmk_tc), normalizeRemark(rmk_sc), normalizeRemark(rmk_en)]

  const scheduled = remarks.some(
    (remark) => remark.length > 0 && SCHEDULED_MARKERS.includes(remark)
  )

  return { scheduled }
}
