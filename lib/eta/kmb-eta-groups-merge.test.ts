import { describe, expect, it } from 'vitest'

import type { KmbEtaEntryWithLeg } from '@/lib/eta/client'
import {
  buildDefaultKey,
  buildLegacyKey,
  defaultMergedKey,
  groupEtasByVariant,
} from '@/lib/eta/kmb-eta-groups'

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

describe('joint route ETA grouping', () => {
  it('merges KMB and CTB departures into one time-sorted group', () => {
    const items = [
      makeEta('kmb', '101', '2026-09-28T12:10:00+08:00', 1),
      makeEta('ctb', '101', '2026-09-28T12:05:00+08:00', 1),
      makeEta('kmb', '101', '2026-09-28T12:20:00+08:00', 2),
    ]
    const groups = groupEtasByVariant(items, {})
    expect(groups).toHaveLength(1)
    expect(groups[0]?.key).toBe('101|O|1|_')
    expect(groups[0]?.baseKey).toBe('101|O|1')
    expect(groups[0]?.operators).toEqual(['ctb', 'kmb'])
    expect(groups[0]?.items.map((entry) => entry.co)).toEqual(['ctb', 'kmb', 'kmb'])
  })

  it('caps merged items at 3 across operators', () => {
    const items = [
      makeEta('kmb', '101', '2026-09-28T12:10:00+08:00', 1),
      makeEta('ctb', '101', '2026-09-28T12:05:00+08:00', 1),
      makeEta('kmb', '101', '2026-09-28T12:20:00+08:00', 2),
      makeEta('ctb', '101', '2026-09-28T12:25:00+08:00', 2),
      makeEta('kmb', '101', '2026-09-28T12:30:00+08:00', 3),
    ]
    const groups = groupEtasByVariant(items, {})
    expect(groups).toHaveLength(1)
    expect(groups[0]?.items).toHaveLength(3)
  })

  it('keeps directions separate', () => {
    const items = [
      makeEta('kmb', '101', '2026-09-28T12:10:00+08:00', 1, 'O'),
      makeEta('ctb', '101', '2026-09-28T12:05:00+08:00', 1, 'I'),
    ]
    const groups = groupEtasByVariant(items, {})
    expect(groups).toHaveLength(2)
  })

  it('merges opposite KMB/CTB bound letters via the variant index', () => {
    const items = [
      makeEta('kmb', '101', '2026-09-28T12:10:00+08:00', 1, 'I'),
      makeEta('ctb', '101', '2026-09-28T12:05:00+08:00', 1, 'O'),
    ]
    const routeVariantIndex = new Map([
      ['kmb|101|I|1', { bound: { kmb: 'I', ctb: 'O' } }],
      ['ctb|101|O|1', { bound: { kmb: 'I', ctb: 'O' } }],
    ])
    const groups = groupEtasByVariant(items, {}, undefined, { routeVariantIndex })
    expect(groups).toHaveLength(1)
    expect(groups[0]?.key).toBe('101|I|1|_')
    expect(
      defaultMergedKey(makeEta('ctb', '101', '2026-09-28T12:05:00+08:00', 1, 'O'), {
        routeVariantIndex,
      })
    ).toBe('101|I|1|_')
  })

  it('builds merged keys without operator and legacy keys with it', () => {
    const entry = makeEta('ctb', '101', '2026-09-28T12:05:00+08:00', 1)
    expect(buildDefaultKey(entry)).toBe('101|O|1|_')
    expect(buildLegacyKey(entry)).toBe('ctb|101|O|1|_')
  })
})
