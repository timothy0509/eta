import { describe, expect, it } from 'vitest'

import {
  filterByCompanyChip,
  findJointRouteNumbers,
  getRouteNumber,
  isCitybusCompany,
  isCrossHarbourNumber,
  isCrossHarbourRoute,
  isNLineRoute,
  matchesCompanyChip,
} from '@/lib/eta/company-filter'

describe('getRouteNumber', () => {
  it('parses plain and prefixed numbers', () => {
    expect(getRouteNumber('307')).toBe(307)
    expect(getRouteNumber('N216')).toBe(216)
    expect(getRouteNumber('X962')).toBe(962)
    expect(getRouteNumber('1A')).toBe(1)
  })

  it('returns null when there is no number', () => {
    expect(getRouteNumber('')).toBeNull()
    expect(getRouteNumber('H1S')).toBe(1)
  })
})

describe('isNLineRoute', () => {
  it('matches the N prefix case-insensitively', () => {
    expect(isNLineRoute('N216')).toBe(true)
    expect(isNLineRoute('NA33')).toBe(true)
    expect(isNLineRoute('n121')).toBe(true)
  })

  it('rejects non-N routes', () => {
    expect(isNLineRoute('216')).toBe(false)
    expect(isNLineRoute('AN68')).toBe(false)
    expect(isNLineRoute('')).toBe(false)
  })
})

describe('isCrossHarbourNumber', () => {
  it('matches 1xx, 3xx, 6xx and 9xx bands', () => {
    expect(isCrossHarbourNumber('101')).toBe(true)
    expect(isCrossHarbourNumber('307')).toBe(true)
    expect(isCrossHarbourNumber('603')).toBe(true)
    expect(isCrossHarbourNumber('962')).toBe(true)
    expect(isCrossHarbourNumber('X962')).toBe(true)
  })

  it('rejects local numbers', () => {
    expect(isCrossHarbourNumber('15')).toBe(false)
    expect(isCrossHarbourNumber('2A')).toBe(false)
    expect(isCrossHarbourNumber('204')).toBe(false)
    expect(isCrossHarbourNumber('')).toBe(false)
  })
})

describe('company matching', () => {
  it('kmb chip matches kmb only', () => {
    expect(matchesCompanyChip({ route: '1A', co: 'kmb' }, 'kmb')).toBe(true)
    expect(matchesCompanyChip({ route: '1A', co: 'KMB' }, 'kmb')).toBe(true)
    expect(matchesCompanyChip({ route: '15', co: 'ctb' }, 'kmb')).toBe(false)
  })

  it('ctb chip matches ctb and legacy nwfb', () => {
    expect(matchesCompanyChip({ route: '15', co: 'ctb' }, 'ctb')).toBe(true)
    expect(matchesCompanyChip({ route: '15', co: 'nwfb' }, 'ctb')).toBe(true)
    expect(matchesCompanyChip({ route: '1A', co: 'kmb' }, 'ctb')).toBe(false)
    expect(isCitybusCompany('ctb')).toBe(true)
    expect(isCitybusCompany('kmb')).toBe(false)
  })

  it('cross-harbour chip matches number bands and jointly operated routes', () => {
    expect(matchesCompanyChip({ route: '307', co: 'kmb' }, 'cross-harbour')).toBe(true)
    expect(matchesCompanyChip({ route: '15', co: 'ctb' }, 'cross-harbour')).toBe(false)
    const joint = new Set(['66'])
    expect(isCrossHarbourRoute('66', 'kmb', joint)).toBe(true)
    expect(isCrossHarbourRoute('66', 'kmb')).toBe(false)
    expect(matchesCompanyChip({ route: '66', co: 'kmb' }, 'cross-harbour', joint)).toBe(true)
  })

  it('n-line chip matches the N prefix only', () => {
    expect(matchesCompanyChip({ route: 'N216', co: 'kmb' }, 'n-line')).toBe(true)
    expect(matchesCompanyChip({ route: '216', co: 'kmb' }, 'n-line')).toBe(false)
  })

  it('all chip passes everything through', () => {
    expect(matchesCompanyChip({ route: '15', co: 'ctb' }, 'all')).toBe(true)
  })
})

describe('findJointRouteNumbers', () => {
  it('detects route numbers served by multiple companies', () => {
    const joint = findJointRouteNumbers([
      { route: '307', co: 'kmb' },
      { route: '307', co: 'ctb' },
      { route: '1A', co: 'kmb' },
      { route: '1A', co: 'kmb' },
    ])
    expect(joint.has('307')).toBe(true)
    expect(joint.has('1A')).toBe(false)
  })
})

describe('filterByCompanyChip', () => {
  const entries = [
    { route: '1A', co: 'kmb' },
    { route: '15', co: 'ctb' },
    { route: '307', co: 'kmb' },
    { route: 'N216', co: 'kmb' },
  ]

  it('filters each chip correctly', () => {
    expect(filterByCompanyChip(entries, 'all')).toHaveLength(4)
    expect(filterByCompanyChip(entries, 'kmb').map((e) => e.route)).toEqual(['1A', '307', 'N216'])
    expect(filterByCompanyChip(entries, 'ctb').map((e) => e.route)).toEqual(['15'])
    expect(filterByCompanyChip(entries, 'cross-harbour').map((e) => e.route)).toEqual(['307'])
    expect(filterByCompanyChip(entries, 'n-line').map((e) => e.route)).toEqual(['N216'])
  })
})
