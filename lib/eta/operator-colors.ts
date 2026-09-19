/**
 * Operator edge color for KMB ETA cards.
 * The left-edge strip shows the operator, not the route badge color.
 */

const OPERATOR_COLORS: Record<string, string> = {
  kmb: '#d13b31',
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
