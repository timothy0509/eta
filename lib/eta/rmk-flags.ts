export type RmkFlags = {
  scheduled: boolean
  wheelchair: boolean
}

const SCHEDULED_MARKERS = ['scheduled bus', '原定班次']

const WHEELCHAIR_MARKERS = ['輪椅', 'wheelchair', '低地台', 'low-floor', 'low floor']

function normalizeRemark(value: string | null | undefined): string {
  if (typeof value !== 'string') return ''
  return value.trim().toLowerCase()
}

/**
 * Parse KMB `rmk_*` remarks into scheduled and wheelchair flags.
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

  const wheelchair = remarks.some(
    (remark) => remark.length > 0 && WHEELCHAIR_MARKERS.some((marker) => remark.includes(marker))
  )

  return { scheduled, wheelchair }
}
