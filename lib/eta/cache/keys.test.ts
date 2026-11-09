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
})

describe('kmb static cache layers', () => {
  it('keeps distinct direct and mapped keys so bumps stay paired', () => {
    expect(KMB_ROUTE_STOPS_CACHE_KEY).toBe('kmb:route-stops:v4')
    expect(KMB_ROUTES_CACHE_KEY).toBe('kmb:routes:v4')
    expect(KMB_ROUTE_STOPS_MAPPED_CACHE_KEY).not.toBe(KMB_ROUTE_STOPS_CACHE_KEY)
    expect(KMB_ROUTES_MAPPED_CACHE_KEY).not.toBe(KMB_ROUTES_CACHE_KEY)
  })
})
