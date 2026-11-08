import { describe, expect, it } from 'vitest'

import type { KmbRouteListEntry } from '@/lib/eta/direct/kmb'
import { mapKmbRouteListEntry } from './route-list'

function row(overrides: Partial<KmbRouteListEntry> = {}): KmbRouteListEntry {
  return {
    co: 'kmb',
    route: '102',
    bound: 'I',
    service_type: 1,
    gtfsId: '1484',
    region: 'joint|102|1',
    orig_en: 'MEI FOO',
    orig_tc: '美孚',
    orig_sc: '美孚',
    dest_en: 'SHAU KEI WAN',
    dest_tc: '筲箕灣',
    dest_sc: '筲箕湾',
    ...overrides,
  }
}

describe('mapKmbRouteListEntry', () => {
  it('keeps joint operators and the joint variant key', () => {
    const mapped = mapKmbRouteListEntry(
      row({ operators: ['kmb', 'ctb'], jointVariantKey: 'jointv:3' })
    )
    expect(mapped.operators).toEqual(['kmb', 'ctb'])
    expect(mapped.jointVariantKey).toBe('jointv:3')
    expect(mapped.region).toBe('joint|102|1')
  })

  it('defaults a legacy row to its own operator', () => {
    const mapped = mapKmbRouteListEntry(row({ operators: undefined, jointVariantKey: undefined }))
    expect(mapped.operators).toEqual(['kmb'])
    expect(mapped.jointVariantKey).toBe('')
  })
})
