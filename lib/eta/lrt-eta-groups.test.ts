import { describe, expect, it } from 'vitest'

import { groupLrtEntriesByRoute, type LrtRouteListEntry } from '@/lib/eta/lrt-eta-groups'

function entry(routeNo: string, timeEn: string, timeCh = timeEn): LrtRouteListEntry {
  return {
    train_length: 2,
    arrival_departure: 'D',
    dest_en: 'Tuen Mun',
    dest_ch: '屯門',
    time_en: timeEn,
    time_ch: timeCh,
    route_no: routeNo,
    stop: 0,
  }
}

describe('groupLrtEntriesByRoute', () => {
  it('groups entries by route and destination', () => {
    const groups = groupLrtEntriesByRoute([entry('505', '3'), entry('507', '5'), entry('505', '8')])
    expect(groups).toHaveLength(2)
    expect(groups[0]?.routeNo).toBe('505')
    expect(groups[0]?.items).toHaveLength(2)
    expect(groups[1]?.routeNo).toBe('507')
  })

  it('keeps different destinations as separate groups', () => {
    const a = entry('614', '3')
    const b: LrtRouteListEntry = { ...entry('614', '5'), dest_en: 'Yuen Long', dest_ch: '元朗' }
    const groups = groupLrtEntriesByRoute([a, b])
    expect(groups).toHaveLength(2)
  })

  it('sorts items inside a group by soonest first', () => {
    const groups = groupLrtEntriesByRoute([
      entry('505', '8'),
      entry('505', 'Arriving'),
      entry('505', '3'),
    ])
    const times = groups[0]?.items.map((item) => item.time_en)
    expect(times).toEqual(['Arriving', '3', '8'])
  })

  it('sorts groups by route number and pushes empty groups last', () => {
    const groups = groupLrtEntriesByRoute([entry('705', '-'), entry('505', '3'), entry('507', '5')])
    expect(groups.map((g) => g.routeNo)).toEqual(['505', '507', '705'])
    expect(groups[2]?.hasEta).toBe(false)
  })
})
