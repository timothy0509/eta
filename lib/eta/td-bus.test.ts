import { describe, expect, it } from 'vitest'

import type { KmbRouteStopLite } from '@/lib/eta/client'
import {
  getTdStopPickDrop,
  getTdVariantInfo,
  isStopDropOffOnlyForVariants,
  isTdDropOffOnly,
  resolveTdFullFare,
  tdVariantKey,
  tdVariantTagKeys,
  tdVariantTags,
} from './td-bus'
describe('tdVariantKey', () => {
  it('normalizes co, route, bound and serviceType', () => {
    expect(tdVariantKey({ co: 'KMB', route: '1a', bound: 'O', serviceType: '1' })).toBe(
      'kmb|1A|O|1'
    )
  })
})

describe('getTdVariantInfo', () => {
  it('returns the TD extract for a known variant', () => {
    const info = getTdVariantInfo({ co: 'kmb', route: '1', bound: 'O', serviceType: '1' })
    expect(info).toMatchObject({
      serviceMode: 'R',
      specialType: 0,
      journeyTimeMinutes: 44,
      fullFareHkd: 6.7,
    })
  })

  it('returns null for an unknown variant', () => {
    expect(getTdVariantInfo({ co: 'kmb', route: 'ZZZ', bound: 'O', serviceType: '1' })).toBeNull()
  })
})

describe('getTdStopPickDrop', () => {
  it('reads pick-up-only for the first stop and drop-off-only for the terminus', () => {
    const key = { co: 'kmb', route: '1', bound: 'O', serviceType: '1' }
    expect(getTdStopPickDrop(key, 1)).toBe(2)
    expect(getTdStopPickDrop(key, 2)).toBe(3)
    expect(isTdDropOffOnly(key, 25)).toBe(true)
  })

  it('returns null for unknown variants and out-of-range sequences', () => {
    const unknown = { co: 'kmb', route: 'ZZZ', bound: 'O', serviceType: '1' }
    expect(getTdStopPickDrop(unknown, 1)).toBeNull()
    expect(getTdStopPickDrop({ co: 'kmb', route: '1', bound: 'O', serviceType: '1' }, 0)).toBeNull()
    expect(
      getTdStopPickDrop({ co: 'kmb', route: '1', bound: 'O', serviceType: '1' }, 999)
    ).toBeNull()
  })
})

describe('tdVariantTags', () => {
  it('tags nothing for a regular variant', () => {
    expect(tdVariantTags('R', 0)).toEqual([])
  })

  it('tags night service', () => {
    expect(tdVariantTags('N', 0)).toEqual(['night'])
  })

  it('tags night plus specific times', () => {
    expect(tdVariantTags('NT', 0)).toEqual(['night', 'specialTimes'])
  })

  it('tags time-specific and weekend-fare variants', () => {
    expect(tdVariantTags('T', 1)).toEqual(['specialTimes'])
    expect(tdVariantTags('R', 2)).toEqual(['weekendFare'])
    expect(tdVariantTags('R', 3)).toEqual(['specialTimes', 'weekendFare'])
  })

  it('maps tags to i18n keys', () => {
    expect(tdVariantTagKeys(['night', 'specialTimes', 'weekendFare'])).toEqual([
      'kmb.tagNight',
      'kmb.tagSpecialTimes',
      'kmb.tagWeekendFare',
    ])
  })
})

describe('resolveTdFullFare', () => {
  it('returns the scheduled full fare for a known variant', () => {
    expect(resolveTdFullFare({ co: 'kmb', route: '1', bound: 'O', serviceType: '1' })).toBe(6.7)
  })

  it('returns null for an unknown variant', () => {
    expect(resolveTdFullFare({ co: 'kmb', route: 'ZZZ', bound: 'O', serviceType: '1' })).toBeNull()
  })
})

describe('isStopDropOffOnlyForVariants', () => {
  const routeStops: KmbRouteStopLite[] = [
    { co: 'kmb', route: '1', bound: 'O', serviceType: '1', seq: 1, stopId: 'FIRST' },
    { co: 'kmb', route: '1', bound: 'O', serviceType: '1', seq: 25, stopId: 'LAST' },
  ]

  it('is true when every variant marks the stop drop-off only', () => {
    expect(isStopDropOffOnlyForVariants('LAST', ['kmb|1|O|1'], routeStops)).toBe(true)
  })

  it('is false for a pick-up stop', () => {
    expect(isStopDropOffOnlyForVariants('FIRST', ['kmb|1|O|1'], routeStops)).toBe(false)
  })

  it('is false when variants are empty or unresolvable', () => {
    expect(isStopDropOffOnlyForVariants('LAST', [], routeStops)).toBe(false)
    expect(isStopDropOffOnlyForVariants('MISSING', ['kmb|1|O|1'], routeStops)).toBe(false)
    expect(isStopDropOffOnlyForVariants('LAST', ['kmb|ZZZ|O|1'], routeStops)).toBe(false)
  })
})
