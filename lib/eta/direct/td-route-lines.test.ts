import { describe, expect, it } from 'vitest'

import {
  decodeEncodedPolyline,
  parseTdRouteLinesFile,
  selectTdRouteLine,
  type TdRouteLine,
} from '@/lib/eta/direct/td-route-lines'

/** Minimal Google-polyline encoder mirroring the build script output. */
function encodePolyline(points: Array<[number, number]>): string {
  const encodeValue = (value: number): string => {
    let v = value < 0 ? ~(value << 1) : value << 1
    let out = ''
    while (v >= 0x20) {
      out += String.fromCharCode(((v & 0x1f) | 0x20) + 63)
      v >>= 5
    }
    out += String.fromCharCode(v + 63)
    return out
  }
  let out = ''
  let prevLat = 0
  let prevLng = 0
  for (const [lng, lat] of points) {
    const latQ = Math.round(lat * 1e5)
    const lngQ = Math.round(lng * 1e5)
    out += encodeValue(latQ - prevLat)
    out += encodeValue(lngQ - prevLng)
    prevLat = latQ
    prevLng = lngQ
  }
  return out
}

function makeLine(overrides: Partial<TdRouteLine> = {}): TdRouteLine {
  return {
    routeId: 1001,
    routeSeq: 1,
    company: 'KMB',
    points: [
      { lat: 22.345, lng: 114.192 },
      { lat: 22.34, lng: 114.19 },
      { lat: 22.294, lng: 114.169 },
    ],
    ...overrides,
  }
}

function lineToPoly(line: TdRouteLine): string {
  return encodePolyline(line.points.map((p) => [p.lng, p.lat]))
}

const variantPoints = [
  { lat: 22.34535, lng: 114.19245 },
  { lat: 22.34, lng: 114.19 },
  { lat: 22.29407, lng: 114.16913 },
]

describe('decodeEncodedPolyline', () => {
  it('round-trips the exact grid values the encoder wrote', () => {
    const poly = encodePolyline([
      [114.19245, 22.34535],
      [114.19, 22.34],
    ])
    const decoded = decodeEncodedPolyline(poly)
    expect(decoded).toEqual([
      { lat: 22.34535, lng: 114.19245 },
      { lat: 22.34, lng: 114.19 },
    ])
  })

  it('drops off-world points but keeps the travel order', () => {
    const poly = encodePolyline([
      [114.19245, 22.34535],
      [999, 3],
      [114.19, 22.34],
    ])
    const decoded = decodeEncodedPolyline(poly)
    expect(decoded).toHaveLength(2)
    expect(decoded[0]).toEqual({ lat: 22.34535, lng: 114.19245 })
    expect(decoded[1]).toEqual({ lat: 22.34, lng: 114.19 })
  })
})

describe('parseTdRouteLinesFile', () => {
  it('parses compact entries keyed by route name', () => {
    const index = parseTdRouteLinesFile({
      lines: {
        1: [
          {
            co: 'KMB',
            seq: 1,
            id: 1001,
            poly: encodePolyline([
              [114.192, 22.345],
              [114.169, 22.294],
            ]),
          },
        ],
      },
    })
    expect(index.get('1')).toHaveLength(1)
    expect(index.get('1')?.[0]).toMatchObject({ routeId: 1001, routeSeq: 1, company: 'KMB' })
    expect(index.get('1')?.[0]?.points).toHaveLength(2)
  })

  it('skips malformed entries and rejects bad files', () => {
    expect(parseTdRouteLinesFile(null).size).toBe(0)
    expect(parseTdRouteLinesFile({ lines: [] }).size).toBe(0)
    const good = makeLine()
    const index = parseTdRouteLinesFile({
      lines: {
        1: [
          { co: 'KMB', seq: 1, id: 1001, poly: lineToPoly(good) },
          { co: 'KMB', seq: 9, id: 1001, poly: lineToPoly(good) },
          { co: '', seq: 1, id: 1001, poly: lineToPoly(good) },
          { co: 'KMB', seq: 1, id: 1001, poly: '__' },
          { co: 'KMB', seq: 1, id: 1001 },
        ],
      },
    })
    expect(index.get('1')).toHaveLength(1)
  })
})

describe('selectTdRouteLine', () => {
  it('matches by company and bound direction', () => {
    const lines = [
      makeLine({ routeSeq: 1, company: 'KMB' }),
      makeLine({
        routeSeq: 2,
        company: 'KMB',
        points: [...variantPoints].reverse(),
      }),
    ]
    expect(selectTdRouteLine(lines, { co: 'kmb', bound: 'O', variantPoints })?.routeSeq).toBe(1)
    expect(
      selectTdRouteLine(lines, {
        co: 'kmb',
        bound: 'I',
        variantPoints: [...variantPoints].reverse(),
      })?.routeSeq
    ).toBe(2)
  })

  it('draws Long Win routes from the kmb company', () => {
    const lines = [makeLine({ company: 'LWB' })]
    expect(selectTdRouteLine(lines, { co: 'kmb', bound: 'O', variantPoints })?.company).toBe('LWB')
    expect(selectTdRouteLine(lines, { co: 'ctb', bound: 'O', variantPoints })).toBeNull()
  })

  it('picks the line whose endpoints fit the variant', () => {
    const near = makeLine({ routeId: 1001 })
    const far = makeLine({
      routeId: 9999,
      points: [
        { lat: 22.5, lng: 114.3 },
        { lat: 22.49, lng: 114.29 },
        { lat: 22.48, lng: 114.28 },
      ],
    })
    expect(selectTdRouteLine([near, far], { co: 'kmb', bound: 'O', variantPoints })?.routeId).toBe(
      1001
    )
  })

  it('returns null when endpoints are far off instead of a wrong leg', () => {
    const lines = [
      makeLine({
        points: [
          { lat: 22.5, lng: 114.3 },
          { lat: 22.49, lng: 114.29 },
        ],
      }),
    ]
    expect(selectTdRouteLine(lines, { co: 'kmb', bound: 'O', variantPoints })).toBeNull()
  })

  it('returns null for unknown companies and short inputs', () => {
    const lines = [makeLine()]
    expect(selectTdRouteLine(lines, { co: 'kmb', bound: 'O', variantPoints: [] })).toBeNull()
    expect(selectTdRouteLine([], { co: 'kmb', bound: 'O', variantPoints })).toBeNull()
  })

  it('decides direction by endpoints when the seq-to-bound mapping is inverted', () => {
    // 2E inbound: CSDI seq 1 is the shape that fits the inbound stops even
    // though bound 'I' nominally maps to seq 2.
    const lines = [
      makeLine({ routeSeq: 1 }),
      makeLine({ routeSeq: 2, points: [...variantPoints].reverse() }),
    ]
    expect(selectTdRouteLine(lines, { co: 'kmb', bound: 'I', variantPoints })?.routeSeq).toBe(1)
  })

  it('breaks ties with the nominal bound seq', () => {
    // A circular route's two legs share endpoints; the bound then decides.
    const lines = [makeLine({ routeSeq: 2 }), makeLine({ routeSeq: 1 })]
    expect(selectTdRouteLine(lines, { co: 'kmb', bound: 'I', variantPoints })?.routeSeq).toBe(2)
    expect(selectTdRouteLine(lines, { co: 'kmb', bound: 'O', variantPoints })?.routeSeq).toBe(1)
  })

  it('matches GMB variants against the GMB layer', () => {
    const lines = [makeLine({ company: 'GMB' })]
    expect(selectTdRouteLine(lines, { co: 'gmb', bound: 'O', variantPoints })?.company).toBe('GMB')
    expect(selectTdRouteLine(lines, { co: 'kmb', bound: 'O', variantPoints })).toBeNull()
  })
})
