import tdData from '@/lib/data/td-bus-variants.json'
import type { KmbRouteStopLite } from '@/lib/eta/client'

/**
 * Static Transport Department enrichment for bus route variants.
 *
 * Generated at build time by `scripts/extract-td-bus.ts` from the TD
 * routes/fares GeoJSON (updated biweekly) joined to hk-bus-eta variants by
 * stop-coordinate alignment. The app never fetches the 78 MB TD file at
 * runtime; it reads this per-variant extract only.
 *
 * TD field semantics (see the TD data dictionary):
 * - stopPickDrop: 1 = drop-off only, 2 = pick-up only, 3 = both.
 * - serviceMode: R = regular, T = regular plus specific times,
 *   N = night, NT = night plus specific times.
 * - specialType: 0 = not applicable, 1 = time/day specific,
 *   2 = weekend and public-holiday fare, 3 = both.
 * - journeyTime: scheduled full-journey minutes.
 * - fullFare: scheduled full-journey fare in HKD.
 */

export type TdPickDrop = 1 | 2 | 3

export type TdVariantInfo = {
  serviceMode: string
  specialType: number
  journeyTimeMinutes: number | null
  fullFareHkd: number | null
  /** 1-indexed stop-sequence string of pick/drop digits; '0' means unknown. */
  pickDropBySeq: string
  tdRouteId: number
  /** TD routeSeq of the joined leg: 1 outbound/circular, 2 inbound. */
  tdRouteSeq: number | null
}

type TdVariantKey = {
  co: string
  route: string
  bound: string
  serviceType: string
}

type RawTdVariant = {
  m: string
  s: number
  t: number | null
  f: number | null
  p: string
  id: number
  q?: number
}

const variants = (tdData as { variants: Record<string, RawTdVariant> }).variants ?? {}

export function tdVariantKey(key: TdVariantKey): string {
  return `${String(key.co ?? 'kmb').toLowerCase()}|${String(key.route ?? '').toUpperCase()}|${String(
    key.bound ?? ''
  )}|${String(key.serviceType ?? '')}`
}

export function getTdVariantInfo(key: TdVariantKey): TdVariantInfo | null {
  const raw = variants[tdVariantKey(key)]
  if (!raw) return null
  return {
    serviceMode: raw.m,
    specialType: raw.s,
    journeyTimeMinutes:
      typeof raw.t === 'number' && Number.isFinite(raw.t) && raw.t > 0 ? raw.t : null,
    fullFareHkd: typeof raw.f === 'number' && Number.isFinite(raw.f) && raw.f >= 0 ? raw.f : null,
    pickDropBySeq: typeof raw.p === 'string' ? raw.p : '',
    tdRouteId: raw.id,
    tdRouteSeq: typeof raw.q === 'number' ? raw.q : null,
  }
}

/**
 * Boarding/alighting rule for the 1-indexed stop sequence of a variant.
 * Returns null when the TD extract has no usable value there.
 */
export function getTdStopPickDrop(key: TdVariantKey, seq: number): TdPickDrop | null {
  if (!Number.isInteger(seq) || seq < 1) return null
  const info = getTdVariantInfo(key)
  if (!info) return null
  const digit = info.pickDropBySeq.charAt(seq - 1)
  if (digit === '1' || digit === '2' || digit === '3') return Number(digit) as TdPickDrop
  return null
}

export function isTdDropOffOnly(key: TdVariantKey, seq: number): boolean {
  return getTdStopPickDrop(key, seq) === 1
}

export type TdVariantTag = 'night' | 'specialTimes' | 'weekendFare'

/**
 * Short distinguishing tags for a variant from its TD serviceMode and
 * specialType. Variants that otherwise look identical (same direction and
 * destination) get different tags, e.g. a night variant vs the day one.
 */
export function tdVariantTags(serviceMode: string, specialType: number): TdVariantTag[] {
  const tags: TdVariantTag[] = []
  const mode = String(serviceMode ?? '').toUpperCase()
  if (mode === 'N' || mode === 'NT') tags.push('night')
  if (mode === 'T' || mode === 'NT' || specialType === 1 || specialType === 3) {
    tags.push('specialTimes')
  }
  if (specialType === 2 || specialType === 3) tags.push('weekendFare')
  return tags
}

export function resolveTdFullFare(key: TdVariantKey): number | null {
  return getTdVariantInfo(key)?.fullFareHkd ?? null
}

/** i18n keys for variant tags, in display order. */
export function tdVariantTagKeys(tags: readonly TdVariantTag[]): string[] {
  return tags.map((tag) =>
    tag === 'night'
      ? 'kmb.tagNight'
      : tag === 'weekendFare'
        ? 'kmb.tagWeekendFare'
        : 'kmb.tagSpecialTimes'
  )
}

function parseVariantKey(variantKey: string): TdVariantKey | null {
  const parts = String(variantKey ?? '').split('|')
  if (parts.length < 4) return null
  const [co = 'kmb', route = '', bound = '', serviceType = ''] = parts
  if (!route) return null
  return { co, route, bound, serviceType }
}

function seqOfStopInVariant(
  stopId: string,
  variant: TdVariantKey,
  routeStops: readonly KmbRouteStopLite[]
): number | null {
  const needle = String(stopId ?? '').trim()
  if (!needle) return null
  const co = variant.co.toLowerCase()
  const route = variant.route.toUpperCase()
  for (const rs of routeStops) {
    if (
      String(rs.co ?? '').toLowerCase() === co &&
      String(rs.route ?? '').toUpperCase() === route &&
      String(rs.bound ?? '') === variant.bound &&
      String(rs.serviceType ?? '') === variant.serviceType &&
      String(rs.stopId ?? '').trim() === needle
    ) {
      return rs.seq
    }
  }
  return null
}

/**
 * True when every listed variant marks this stop as drop-off only. Used to
 * warn before saving such a stop as a favorite: no boarding is possible
 * there on the selected routes, so live departure boards stay empty.
 * Returns false when no variant resolves (unknown, not a refusal).
 */
export function isStopDropOffOnlyForVariants(
  stopId: string,
  variantKeys: readonly string[],
  routeStops: readonly KmbRouteStopLite[]
): boolean {
  if (variantKeys.length === 0) return false
  for (const key of variantKeys) {
    const variant = parseVariantKey(key)
    if (!variant) return false
    const seq = seqOfStopInVariant(stopId, variant, routeStops)
    if (seq === null) return false
    if (!isTdDropOffOnly(variant, seq)) return false
  }
  return true
}
