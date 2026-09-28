import { describe, expect, it } from 'vitest'

import type { KmbEtaEntryWithLeg } from '@/lib/eta/client'
import {
  buildDefaultKey,
  buildLegacyKey,
  defaultMergedKey,
  findMergedForEntry,
  groupEtasByVariant,
} from '@/lib/eta/kmb-eta-groups'
import type { MergedDbEntry } from '@/lib/eta/eta-db-index'

function makeEta(
  co: string,
  route: string,
  eta: string,
  etaSeq: number,
  dir = 'O',
  serviceType = '1'
): KmbEtaEntryWithLeg {
  return {
    co,
    route,
    dir,
    service_type: serviceType,
    seq: etaSeq,
    stop: 'S1',
    dest_en: '',
    dest_tc: '',
    dest_sc: '',
    eta_seq: etaSeq,
    eta,
    rmk_en: '',
    rmk_tc: '',
    rmk_sc: '',
    data_timestamp: '',
    leg: null,
  }
}

function makeMerged(overrides?: Partial<MergedDbEntry>): MergedDbEntry {
  return {
    entry: {
      route: '101',
      serviceType: '1',
      orig: { en: 'A', zh: 'A' },
      dest: { en: 'B', zh: 'B' },
    } as MergedDbEntry['entry'],
    operators: ['ctb', 'kmb'] as MergedDbEntry['operators'],
    directionKey: '101|1|S1>S2>S3',
    bound: 'O',
    boundByStopId: new Map<string, Record<string, string>>([
      ['KS1', { kmb: 'O' }],
      ['CS1', { ctb: 'O' }],
    ]),
    stopCanonById: new Map([
      ['KS1', 'S1'],
      ['CS1', 'S1'],
    ]),
    orderedStops: ['S1', 'S2', 'S3'],
    representativeByCanon: new Map([['S1', 'KS1']]),
    ...overrides,
  }
}

function etaFor(
  co: string,
  stop: string,
  eta: string,
  etaSeq: number,
  dir = 'O',
  serviceType = '1'
): KmbEtaEntryWithLeg {
  const base = makeEta(co, '101', eta, etaSeq, dir, serviceType)
  return { ...base, stop }
}

describe('joint route ETA grouping', () => {
  it('merges KMB and CTB departures into one time-sorted group', () => {
    const mergedByDirection = new Map([['101|1|S1>S2>S3', makeMerged()]])
    const items = [
      etaFor('kmb', 'KS1', '2026-09-28T12:10:00+08:00', 1),
      etaFor('ctb', 'CS1', '2026-09-28T12:05:00+08:00', 1),
      etaFor('kmb', 'KS1', '2026-09-28T12:20:00+08:00', 2),
    ]
    const groups = groupEtasByVariant(items, {}, undefined, { mergedByDirection })
    expect(groups).toHaveLength(1)
    expect(groups[0]?.key).toBe('101|1|101|1|S1>S2>S3|_')
    expect(groups[0]?.baseKey).toBe('101|1|101|1|S1>S2>S3')
    expect(groups[0]?.merged?.bound).toBe('O')
    expect(groups[0]?.operators).toEqual(['ctb', 'kmb'])
    expect(groups[0]?.items.map((entry) => entry.co)).toEqual(['ctb', 'kmb', 'kmb'])
  })

  it('caps merged items at 3 across operators', () => {
    const mergedByDirection = new Map([['101|1|S1>S2>S3', makeMerged()]])
    const items = [
      etaFor('kmb', 'KS1', '2026-09-28T12:10:00+08:00', 1),
      etaFor('ctb', 'CS1', '2026-09-28T12:05:00+08:00', 1),
      etaFor('kmb', 'KS1', '2026-09-28T12:20:00+08:00', 2),
      etaFor('ctb', 'CS1', '2026-09-28T12:25:00+08:00', 2),
      etaFor('kmb', 'KS1', '2026-09-28T12:30:00+08:00', 3),
    ]
    const groups = groupEtasByVariant(items, {}, undefined, { mergedByDirection })
    expect(groups).toHaveLength(1)
    expect(groups[0]?.items).toHaveLength(3)
  })

  it('keeps directions separate', () => {
    const merged = makeMerged({
      directionKey: '101|1|S1>S2>S3',
      boundByStopId: new Map<string, Record<string, string>>([['KS1', { kmb: 'O' }]]),
      stopCanonById: new Map([['KS1', 'S1']]),
    })
    const other = makeMerged({
      directionKey: '101|1|S3>S2>S1',
      bound: 'I',
      boundByStopId: new Map<string, Record<string, string>>([['KS9', { ctb: 'I' }]]),
      stopCanonById: new Map([['KS9', 'S9']]),
      orderedStops: ['S9'],
      representativeByCanon: new Map([['S9', 'KS9']]),
    })
    const mergedByDirection = new Map([
      ['101|1|S1>S2>S3', merged],
      ['101|1|S3>S2>S1', other],
    ])
    const items = [
      etaFor('kmb', 'KS1', '2026-09-28T12:10:00+08:00', 1, 'O'),
      etaFor('ctb', 'KS9', '2026-09-28T12:05:00+08:00', 1, 'I'),
    ]
    const groups = groupEtasByVariant(items, {}, undefined, { mergedByDirection })
    expect(groups).toHaveLength(2)
  })

  it('merges opposite KMB/CTB bound letters by stop membership, not letters', () => {
    const mergedByDirection = new Map([['101|1|S1>S2>S3', makeMerged()]])
    const kmb = etaFor('kmb', 'KS1', '2026-09-28T12:10:00+08:00', 1, 'I')
    const ctb = etaFor('ctb', 'CS1', '2026-09-28T12:05:00+08:00', 1, 'O')
    expect(findMergedForEntry(mergedByDirection, kmb)?.bound).toBe('O')
    expect(findMergedForEntry(mergedByDirection, ctb)?.bound).toBe('O')
    const groups = groupEtasByVariant([kmb, ctb], {}, undefined, { mergedByDirection })
    expect(groups).toHaveLength(1)
    expect(groups[0]?.key).toBe('101|1|101|1|S1>S2>S3|_')
    expect(defaultMergedKey(ctb, { mergedByDirection })).toBe('101|1|101|1|S1>S2>S3|_')
  })

  it('falls back to the raw letter when the stop is unknown', () => {
    const entry = etaFor('ctb', 'CS1', '2026-09-28T12:05:00+08:00', 1)
    expect(defaultMergedKey(entry, { mergedByDirection: new Map() })).toBe('101|1|O|_')
  })

  it('builds merged keys without operator and legacy keys with it', () => {
    const entry = makeEta('ctb', '101', '2026-09-28T12:05:00+08:00', 1)
    expect(buildDefaultKey(entry)).toBe('101|O|1|_')
    expect(buildLegacyKey(entry)).toBe('ctb|101|O|1|_')
  })
})
