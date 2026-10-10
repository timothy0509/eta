import { describe, expect, it } from 'vitest'

import { gmbPickDropKey, gmbRouteSeqToBound, groupGmbTdStops, parseGmbTdCollection } from './gmb-td'

function feature(props: Record<string, unknown>, coordinates: [number, number]) {
  return {
    type: 'Feature',
    geometry: { type: 'Point', coordinates },
    properties: {
      routeId: 2000511,
      routeNameC: '69X',
      routeNameS: '69X',
      routeNameE: '69X',
      district: 'HKI',
      serviceMode: 'R',
      journeyTime: 20,
      locStartNameC: '數碼港',
      locStartNameS: '数码港',
      locStartNameE: 'Cyberport',
      locEndNameC: '銅鑼灣(駱克道)',
      locEndNameS: '铜锣湾(骆克道)',
      locEndNameE: 'Causeway Bay (Lockhart Road)',
      fullFare: 12.5,
      lastUpdateDate: '2026-09-28T00:00:00',
      ...props,
    },
  }
}

const collection = {
  type: 'FeatureCollection',
  features: [
    feature(
      { routeSeq: 1, stopSeq: 2, stopId: 20007719, stopPickDrop: 3, stopNameE: 'Second' },
      [114.13, 22.26]
    ),
    feature(
      { routeSeq: 1, stopSeq: 1, stopId: 20003337, stopPickDrop: 2, stopNameE: 'First' },
      [114.12, 22.25]
    ),
    feature(
      { routeSeq: 2, stopSeq: 1, stopId: 20009999, stopPickDrop: 1, stopNameE: 'Back' },
      [114.14, 22.27]
    ),
    // Malformed: missing coordinates and bad routeSeq, both skipped.
    { type: 'Feature', geometry: { type: 'Point', coordinates: [] }, properties: {} },
    feature(
      { routeSeq: 9, stopSeq: 1, stopId: 1, stopPickDrop: 3, stopNameE: 'Bad' },
      [114.0, 22.0]
    ),
  ],
}

describe('parseGmbTdCollection', () => {
  it('keeps valid point features and skips malformed ones', () => {
    const stops = parseGmbTdCollection(collection)
    expect(stops).toHaveLength(3)
    expect(stops.map((s) => s.stopId).sort()).toEqual([20003337, 20007719, 20009999])
  })

  it('maps GeoJSON coordinates as lng then lat', () => {
    const stops = parseGmbTdCollection(collection)
    const first = stops.find((s) => s.stopId === 20003337)
    expect(first?.lng).toBe(114.12)
    expect(first?.lat).toBe(22.25)
  })

  it('returns empty for non-collections', () => {
    expect(parseGmbTdCollection(null)).toEqual([])
    expect(parseGmbTdCollection({})).toEqual([])
    expect(parseGmbTdCollection({ features: 'nope' })).toEqual([])
  })
})

describe('groupGmbTdStops', () => {
  it('splits routeSeq legs and orders stops by stopSeq', () => {
    const stops = parseGmbTdCollection(collection)
    const groups = groupGmbTdStops(stops)
    expect(groups).toHaveLength(1)
    expect(groups[0]?.variants).toHaveLength(2)
    const outbound = groups[0]?.variants[0]
    expect(outbound?.routeSeq).toBe(1)
    expect(outbound?.stops.map((s) => s.stopSeq)).toEqual([1, 2])
    const inbound = groups[0]?.variants[1]
    expect(inbound?.routeSeq).toBe(2)
    expect(inbound?.stops).toHaveLength(1)
  })
})

describe('gmb helpers', () => {
  it('maps routeSeq 1 to outbound and 2 to inbound', () => {
    expect(gmbRouteSeqToBound(1)).toBe('O')
    expect(gmbRouteSeqToBound(2)).toBe('I')
  })

  it('maps stopPickDrop roles to i18n keys', () => {
    expect(gmbPickDropKey(1)).toBe('gmb.dropOffOnly')
    expect(gmbPickDropKey(2)).toBe('gmb.pickUpOnly')
    expect(gmbPickDropKey(3)).toBe('gmb.pickUpDropOff')
  })
})
