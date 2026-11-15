import { describe, expect, it } from 'vitest'

import {
  buildStopRoutesIndex,
  getRoutesForStopIds,
  sliceStopRoutesForDisplay,
  type StopRouteBadge,
} from './stop-routes'

function row(stopId: string, route: string, co = 'kmb') {
  return { stopId, route, co }
}

describe('buildStopRoutesIndex', () => {
  it('collapses variants of one route into one badge', () => {
    const index = buildStopRoutesIndex([
      row('S1', '1A'),
      row('S1', '1a'),
      row('S1', '1A', 'ctb'),
      row('S1', '1A'),
    ])
    expect(index.get('S1')).toEqual([{ route: '1A', co: 'kmb' }])
  })

  it('sorts routes in natural order and skips blank rows', () => {
    const index = buildStopRoutesIndex([
      row('S1', '102'),
      row('S1', '2A'),
      row('S1', 'N216'),
      row('S1', '  '),
      row('', '1A'),
    ])
    expect(index.get('S1')?.map((b) => b.route)).toEqual(['2A', '102', 'N216'])
  })

  it('keeps the primary operator for a jointly served route', () => {
    const index = buildStopRoutesIndex([row('S1', '102', 'ctb'), row('S1', '102', 'kmb')])
    expect(index.get('S1')).toEqual([{ route: '102', co: 'kmb' }])
  })

  it('returns an empty map for empty input', () => {
    expect(buildStopRoutesIndex([]).size).toBe(0)
  })
})

describe('getRoutesForStopIds', () => {
  it('unions grouped stops and dedupes shared routes', () => {
    const index = buildStopRoutesIndex([
      row('S1', '1A'),
      row('S1', '2A'),
      row('S2', '2A', 'ctb'),
      row('S2', '3D'),
    ])
    expect(getRoutesForStopIds(index, ['S1', 'S2']).map((b) => b.route)).toEqual(['1A', '2A', '3D'])
  })

  it('resolves one operator when grouped stops disagree', () => {
    const index = buildStopRoutesIndex([row('S1', '102', 'ctb'), row('S2', '102', 'kmb')])
    expect(getRoutesForStopIds(index, ['S1', 'S2'])).toEqual([{ route: '102', co: 'kmb' }])
  })

  it('ignores unknown stop ids', () => {
    const index = buildStopRoutesIndex([row('S1', '1A')])
    expect(getRoutesForStopIds(index, ['S1', 'missing'])).toEqual([{ route: '1A', co: 'kmb' }])
    expect(getRoutesForStopIds(index, ['missing'])).toEqual([])
  })
})

describe('sliceStopRoutesForDisplay', () => {
  const badges = (n: number): StopRouteBadge[] =>
    Array.from({ length: n }, (_, i) => ({ route: `${i + 1}A`, co: 'kmb' }))

  it('shows all badges when there are five or fewer', () => {
    expect(sliceStopRoutesForDisplay(badges(5)).overflow).toBe(0)
    expect(sliceStopRoutesForDisplay(badges(5)).visible).toHaveLength(5)
    expect(sliceStopRoutesForDisplay(badges(3)).visible).toHaveLength(3)
  })

  it('shows four badges plus the overflow count when there are more than five', () => {
    const { visible, overflow } = sliceStopRoutesForDisplay(badges(7))
    expect(visible).toHaveLength(4)
    expect(overflow).toBe(3)
  })
})
