import { describe, expect, it } from 'vitest'

import {
  parseTdRouteLinesFile,
  selectTdRouteLine,
  type TdRouteLine,
} from '@/lib/eta/direct/td-route-lines'

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

const variantPoints = [
  { lat: 22.34535, lng: 114.19245 },
  { lat: 22.34, lng: 114.19 },
  { lat: 22.29407, lng: 114.16913 },
]

describe('parseTdRouteLinesFile', () => {
  it('parses compact entries keyed by route name', () => {
    const index = parseTdRouteLinesFile({
      lines: {
        1: [
          {
            co: 'KMB',
            seq: 1,
            id: 1001,
            pts: [
              [114.192, 22.345],
              [114.169, 22.294],
            ],
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
    const index = parseTdRouteLinesFile({
      lines: {
        1: [
          {
            co: 'KMB',
            seq: 1,
            id: 1001,
            pts: [
              [114.192, 22.345],
              [114.169, 22.294],
            ],
          },
          {
            co: 'KMB',
            seq: 9,
            id: 1001,
            pts: [
              [114.1, 22.3],
              [114.2, 22.4],
            ],
          },
          {
            co: '',
            seq: 1,
            id: 1001,
            pts: [
              [114.1, 22.3],
              [114.2, 22.4],
            ],
          },
          { co: 'KMB', seq: 1, id: 1001, pts: [[999, 999]] },
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
    expect(selectTdRouteLine(lines, { co: 'gmb', bound: 'O', variantPoints })).toBeNull()
    expect(selectTdRouteLine(lines, { co: 'kmb', bound: 'O', variantPoints: [] })).toBeNull()
    expect(selectTdRouteLine([], { co: 'kmb', bound: 'O', variantPoints })).toBeNull()
  })
})
