import { describe, expect, it } from 'vitest'

import type { KmbEtaEntryWithLeg } from '@/lib/eta/direct/kmb'
import { filterRouteStopEtas, type RouteVariantRef } from './route-eta-filter'

function entry(overrides: Partial<KmbEtaEntryWithLeg> = {}): KmbEtaEntryWithLeg {
  return {
    co: 'kmb',
    route: '213M',
    dir: 'O',
    service_type: '1',
    seq: 1,
    stop: 'STOP1',
    dest_en: 'Lam Tin Station',
    dest_tc: '藍田站',
    dest_sc: '蓝田站',
    eta_seq: 1,
    eta: '2026-01-01T12:00:00+08:00',
    rmk_en: '',
    rmk_tc: '',
    rmk_sc: '',
    data_timestamp: '2026-01-01T11:59:00+08:00',
    leg: null,
    ...overrides,
  }
}

const variant213M: RouteVariantRef = {
  co: 'kmb',
  route: '213M',
  bound: 'O',
  serviceType: '1',
  gtfsId: 'gtfs-213m-o',
  jointVariantKey: '',
}

describe('filterRouteStopEtas', () => {
  it('keeps official KMB rows that carry no gtfsId when the variant has one', () => {
    const rows = [entry({ gtfsId: undefined })]
    expect(filterRouteStopEtas(rows, variant213M)).toHaveLength(1)
  })

  it('keeps rows whose gtfsId matches the variant', () => {
    const rows = [entry({ gtfsId: 'gtfs-213m-o' })]
    expect(filterRouteStopEtas(rows, variant213M)).toHaveLength(1)
  })

  it('drops rows from another bound', () => {
    const rows = [entry({ dir: 'I' })]
    expect(filterRouteStopEtas(rows, variant213M)).toHaveLength(0)
  })

  it('drops rows from another service type', () => {
    const rows = [entry({ service_type: '2' })]
    expect(filterRouteStopEtas(rows, variant213M)).toHaveLength(0)
  })

  it('drops rows from another region when both sides carry a gtfsId', () => {
    const rows = [entry({ gtfsId: 'other-region' })]
    expect(filterRouteStopEtas(rows, variant213M)).toHaveLength(0)
  })

  it('matches joint rows by jointVariantKey across operators', () => {
    const variant: RouteVariantRef = { ...variant213M, jointVariantKey: 'jointv:1' }
    const rows = [
      entry({ co: 'ctb', jointVariantKey: 'jointv:1' }),
      entry({ co: 'kmb', jointVariantKey: 'jointv:2' }),
    ]
    const kept = filterRouteStopEtas(rows, variant)
    expect(kept).toHaveLength(1)
    expect(kept[0]?.co).toBe('ctb')
  })
})
