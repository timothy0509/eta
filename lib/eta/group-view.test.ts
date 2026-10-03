import { describe, expect, it } from 'vitest'
import type { FavoritesItem } from '@/lib/store'
import { buildGroupStopsItem, collectKmbGroupMembers } from './group-view'
import type { KmbGroupMember } from './group-view'

const single = (
  id: string,
  stopId: string,
  groupId?: string | null,
  extra?: Partial<Extract<FavoritesItem, { mode: 'kmb' }>>
): FavoritesItem => ({
  id,
  mode: 'kmb',
  title: `stop ${stopId}`,
  stopId,
  groupId: groupId ?? null,
  ...extra,
})

const grouped = (
  id: string,
  stopIds: string[],
  groupId?: string | null,
  extra?: Partial<Extract<FavoritesItem, { mode: 'kmb' }>>
): FavoritesItem => ({
  id,
  mode: 'kmb',
  title: stopIds.join(','),
  stopIds,
  routeFilterMode: 'simple',
  groupId: groupId ?? null,
  ...extra,
})

describe('collectKmbGroupMembers', () => {
  it('keeps mixed members with their filters intact and in favorites order', () => {
    const favorites: FavoritesItem[] = [
      single('a', '1', 'g1', { route: '1A', routeFilterMode: 'simple' }),
      grouped('b', ['2', '3'], 'g1', {
        routeFilterMode: 'advanced',
        entries: [{ variantKey: 'kmb|1A|O|1' }],
      }),
      single('c', '4', 'g1'),
      single('d', '9', 'other'),
    ]
    const members = collectKmbGroupMembers(favorites, 'g1')
    expect(members.map((m) => m.id)).toEqual(['a', 'b', 'c'])
    expect(members[0]).toMatchObject({ route: '1A', routeFilterMode: 'simple' })
    expect(members[1]).toMatchObject({
      routeFilterMode: 'advanced',
      entries: [{ variantKey: 'kmb|1A|O|1' }],
    })
  })

  it('skips query, route-type, mtr, lrt items and empty stop ids', () => {
    const favorites: FavoritesItem[] = [
      single('a', '1', 'g1'),
      single('empty', '', 'g1'),
      single('blank', '   ', 'g1'),
      grouped('empty-grouped', ['', '  '], 'g1'),
      {
        id: 'q',
        mode: 'kmb',
        title: 'contains',
        query: '1A',
        groupId: 'g1',
      },
      {
        id: 'r',
        mode: 'kmb',
        type: 'route',
        title: '1A',
        route: '1A',
        bound: 'outbound',
        serviceType: '1',
        groupId: 'g1',
      },
      { id: 'm', mode: 'mtr', title: 'Central', line: 'ISL', sta: 'CEN', groupId: 'g1' },
      { id: 'l', mode: 'lrt', title: 'Siu Hong', stationId: '100', groupId: 'g1' },
    ]
    expect(collectKmbGroupMembers(favorites, 'g1').map((m) => m.id)).toEqual(['a'])
  })

  it('returns [] for a group with no viewable members', () => {
    const favorites: FavoritesItem[] = [
      single('a', '1', 'other'),
      {
        id: 'q',
        mode: 'kmb',
        title: 'contains',
        query: '1A',
        groupId: 'g1',
      },
    ]
    expect(collectKmbGroupMembers(favorites, 'g1')).toEqual([])
  })
})

describe('buildGroupStopsItem', () => {
  it('unions stop ids in order and dedupes', () => {
    const members: KmbGroupMember[] = [
      single('a', '1', 'g1') as KmbGroupMember,
      grouped('b', ['2', '1', '3'], 'g1') as KmbGroupMember,
      single('c', '2', 'g1') as KmbGroupMember,
    ]
    expect(buildGroupStopsItem(members, 'Home')).toEqual({
      id: 'kmb:group:1,2,3',
      mode: 'kmb',
      title: 'Home',
      stopIds: ['1', '2', '3'],
      routeFilterMode: 'simple',
    })
  })

  it('trims ids and drops empties', () => {
    const members: KmbGroupMember[] = [
      single('a', '  1  ', 'g1') as KmbGroupMember,
      grouped('b', ['', '   ', '2'], 'g1') as KmbGroupMember,
    ]
    const item = buildGroupStopsItem(members, 'Work')
    expect(item).toMatchObject({ stopIds: ['1', '2'], id: 'kmb:group:1,2', title: 'Work' })
  })

  it('returns null on empty members or empty ids', () => {
    expect(buildGroupStopsItem([], 'Home')).toBeNull()
    expect(buildGroupStopsItem([single('a', '   ', 'g1') as KmbGroupMember], 'Home')).toBeNull()
    expect(
      buildGroupStopsItem([grouped('b', ['', '  '], 'g1') as KmbGroupMember], 'Home')
    ).toBeNull()
  })

  it('builds stable id and drops per-member filters', () => {
    const members: KmbGroupMember[] = [
      single('a', '1', 'g1', {
        route: '1A',
        routeFilterMode: 'advanced',
        entries: [{ variantKey: 'kmb|1A|O|1' }],
      }) as KmbGroupMember,
      grouped('b', ['2'], 'g1', {
        routeFilterMode: 'advanced',
        entries: [{ variantKey: 'kmb|2|O|1' }],
      }) as KmbGroupMember,
    ]
    const first = buildGroupStopsItem(members, 'Home')
    const second = buildGroupStopsItem([...members].reverse(), 'Home')
    expect(first?.id).toBe('kmb:group:1,2')
    expect(second?.id).toBe('kmb:group:2,1')
    expect(buildGroupStopsItem(members, 'Home')).toEqual(first)
    expect(first).toMatchObject({ mode: 'kmb', title: 'Home', routeFilterMode: 'simple' })
    expect(first).not.toHaveProperty('route')
    expect(first).not.toHaveProperty('entries')
    expect(first).not.toHaveProperty('stopId')
  })
})
