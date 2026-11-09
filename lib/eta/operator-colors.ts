/**
 * Operator edge color for KMB ETA cards.
 * The left-edge strip shows the operator, not the route badge color.
 */

const OPERATOR_COLORS: Record<string, string> = {
  kmb: '#d13b31',
  // Long Win Bus: KMB group, orange brand.
  lwb: '#f58220',
  ctb: '#f0dd4d',
  nwfb: '#f0dd4d',
  lrtfeeder: '#1a2b4e',
  nlb: '#559f9a',
  gmb: '#d9fcd1',
}

/** Neutral fallback for operators without a brand color. */
export const OPERATOR_COLOR_FALLBACK = '#64748b'

/** Shared normalization for operator codes. */
export function normalizeOperator(co: string | undefined): string {
  return String(co ?? 'kmb')
    .trim()
    .toLowerCase()
}

export function getOperatorColor(co: string | undefined): string {
  return OPERATOR_COLORS[normalizeOperator(co)] ?? OPERATOR_COLOR_FALLBACK
}

/**
 * Background for the left-edge operator strip on route and ETA cards.
 * Single operators get a solid brand color; joint routes get an even
 * vertical split across each operator, matching the ETA card look.
 */
export function getOperatorStripBackground(
  operators: string[],
  fallbackCo?: string | undefined
): string {
  if (operators.length > 1) {
    return `linear-gradient(180deg, ${operators
      .map((op, index) => {
        const start = Math.round((index / operators.length) * 10000) / 100
        const end = Math.round(((index + 1) / operators.length) * 10000) / 100
        return `${getOperatorColor(op)} ${start}% ${end}%`
      })
      .join(', ')})`
  }
  return getOperatorColor(operators[0] ?? fallbackCo)
}
