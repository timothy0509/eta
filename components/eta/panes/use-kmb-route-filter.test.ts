import { describe, expect, it } from 'vitest'

import { buildKmbQueryFromDraft, buildRouteFilterString } from './use-kmb-route-filter'

describe('buildRouteFilterString', () => {
  it('extracts route numbers from advanced entries', () => {
    const result = buildRouteFilterString(
      {
        routes: '',
        entries: [
          { id: '1', variantKey: 'kmb|1|O|1' },
          { id: '2', variantKey: 'kmb|2A|I|1' },
        ],
      },
      'advanced'
    )

    expect(result).toBe('1,2A')
  })

  it('uses query.route in simple mode', () => {
    const result = buildRouteFilterString({ routes: '3,4', entries: [] }, 'simple', '1,2')

    expect(result).toBe('1,2')
  })

  it('falls back to routeFilter.routes in simple mode when query.route is missing', () => {
    const result = buildRouteFilterString({ routes: '1, 2A', entries: [] }, 'simple')

    expect(result).toBe('1,2A')
  })

  it('returns undefined when no filter state is present', () => {
    const result = buildRouteFilterString({ routes: '', entries: [] }, 'simple')

    expect(result).toBeUndefined()
  })

  it('prefers entries over query.route and routeFilter.routes', () => {
    const result = buildRouteFilterString(
      {
        routes: '9',
        entries: [{ id: '1', variantKey: 'kmb|5|O|1' }],
      },
      'advanced',
      '1'
    )

    expect(result).toBe('5')
  })
})

describe('buildKmbQueryFromDraft', () => {
  it('includes route from routeFilter.routes in simple mode', () => {
    const result = buildKmbQueryFromDraft(
      { type: 'stop', stopId: '1234' },
      { routes: '1,2', entries: [] },
      'simple'
    )

    expect(result).toEqual({
      mode: 'stop',
      stopId: '1234',
      route: '1,2',
      serviceType: '1',
    })
  })

  it('omits route in advanced mode', () => {
    const result = buildKmbQueryFromDraft(
      { type: 'stop', stopId: '1234' },
      {
        routes: '1',
        entries: [{ id: '1', variantKey: 'kmb|1|O|1' }],
      },
      'advanced'
    )

    expect(result).toEqual({
      mode: 'stop',
      stopId: '1234',
      serviceType: '1',
    })
  })
})
