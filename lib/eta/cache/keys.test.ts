import { describe, expect, it } from 'vitest'

import {
  KMB_ROUTES_CACHE_KEY,
  KMB_ROUTES_MAPPED_CACHE_KEY,
  KMB_ROUTE_STOPS_CACHE_KEY,
  KMB_ROUTE_STOPS_MAPPED_CACHE_KEY,
  kmbStopEtaKey,
} from './keys'

describe('kmbStopEtaKey', () => {
  it('keys the same stop separately per joint operator preference', () => {
    expect(kmbStopEtaKey('S1', 'kmb')).not.toBe(kmbStopEtaKey('S1', 'ctb'))
  })

  it('keeps unpreferred lookups on the legacy key', () => {
    expect(kmbStopEtaKey('S1')).toBe('stop-eta:S1')
    expect(kmbStopEtaKey('S1', null)).toBe('stop-eta:S1')
  })

  it('keys route-scoped fetches apart from the full stop fetch', () => {
    const full = kmbStopEtaKey('S1')
    const scoped = kmbStopEtaKey('S1', null, '213M', '1')
    expect(scoped).not.toBe(full)
    expect(kmbStopEtaKey('S1', null, '213m', '1')).toBe(scoped)
    expect(kmbStopEtaKey('S1', null, '213M', '2')).not.toBe(scoped)
  })

  it('keys single-hint scopes without empty segments', () => {
    const routeOnly = kmbStopEtaKey('S1', null, '213M', null)
    expect(routeOnly).toContain('213M')
    expect(routeOnly.endsWith(':')).toBe(false)
    expect(routeOnly).not.toBe(kmbStopEtaKey('S1'))
    const serviceOnly = kmbStopEtaKey('S1', null, null, '1')
    expect(serviceOnly).not.toBe(kmbStopEtaKey('S1'))
    expect(serviceOnly).not.toContain('::')
    expect(routeOnly).not.toBe(serviceOnly)
  })

  it('does not confuse a numeric route with a service type', () => {
    expect(kmbStopEtaKey('S1', null, '1', null)).not.toBe(kmbStopEtaKey('S1', null, null, '1'))
  })
})

describe('kmb static cache layers', () => {
  it('keeps distinct direct and mapped keys so bumps stay paired', () => {
    expect(KMB_ROUTE_STOPS_CACHE_KEY).toBe('kmb:route-stops:v4')
    expect(KMB_ROUTES_CACHE_KEY).toBe('kmb:routes:v4')
    expect(KMB_ROUTE_STOPS_MAPPED_CACHE_KEY).not.toBe(KMB_ROUTE_STOPS_CACHE_KEY)
    expect(KMB_ROUTES_MAPPED_CACHE_KEY).not.toBe(KMB_ROUTES_CACHE_KEY)
  })
})
