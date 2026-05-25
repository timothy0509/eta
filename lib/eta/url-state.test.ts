import { describe, expect, it } from 'vitest'

import { decodeUrlState, encodeUrlState, type UrlEncodeInput } from './url-state'

describe('url-state', () => {
  it('roundtrips KMB stop with advanced route filters', () => {
    const input: UrlEncodeInput = {
      mode: 'kmb',
      lang: 'en',
      routeFilterMode: 'advanced',
      autoRefreshSeconds: 30,
      kmb: {
        query: { mode: 'stop', stopId: '123' },
        routeFilter: {
          entries: [
            { variantKey: 'kmb|1|O|1' },
            { variantKey: 'kmb|2|I|1' },
          ],
        },
      },
      mtr: null,
      lrt: null,
    }

    const encoded = encodeUrlState(input)
    const decoded = decodeUrlState(encoded)

    expect(decoded.state).toMatchObject({
      mode: 'kmb',
      lang: 'en',
      routeFilterMode: 'advanced',
      autoRefreshSeconds: 30,
    })
    expect(decoded.selectedItem).toMatchObject({
      mode: 'kmb',
      stopId: '123',
      routeFilterMode: 'advanced',
      entries: [
        { variantKey: 'kmb|1|O|1' },
        { variantKey: 'kmb|2|I|1' },
      ],
    })
  })

  it('infers mode from MTR station when no explicit mode is set', () => {
    const decoded = decodeUrlState('?ms=ADM')

    expect(decoded.state.mode).toBe('mtr')
    expect(decoded.selectedItem).toMatchObject({
      mode: 'mtr',
      sta: 'ADM',
    })
  })

  it('infers advanced route filter mode when entries exist', () => {
    const decoded = decodeUrlState('?km=stop&ks=123&ke=1|O|1')

    expect(decoded.state.routeFilterMode).toBe('advanced')
    expect(decoded.selectedItem).toMatchObject({
      mode: 'kmb',
      stopId: '123',
      routeFilterMode: 'advanced',
      entries: [{ variantKey: 'kmb|1|O|1' }],
    })
  })

  it('ignores invalid auto-refresh values', () => {
    const decoded = decodeUrlState('?ar=20')

    expect(decoded.state.autoRefreshSeconds).toBeUndefined()
  })

  it('drops invalid route filter entries', () => {
    const decoded = decodeUrlState('?km=stop&ks=123&ke=bad|format')

    expect(decoded.state.routeFilterMode).toBeUndefined()
    expect(decoded.selectedItem).toMatchObject({
      mode: 'kmb',
      stopId: '123',
      routeFilterMode: 'simple',
    })
  })

  it('roundtrips simple route filters', () => {
    const input: UrlEncodeInput = {
      mode: 'kmb',
      lang: 'tc',
      routeFilterMode: 'simple',
      autoRefreshSeconds: 15,
      kmb: {
        query: { mode: 'contains', query: 'airport' },
        routeFilter: { routes: 'A21, A22' },
      },
      mtr: null,
      lrt: null,
    }

    const encoded = encodeUrlState(input)
    const decoded = decodeUrlState(encoded)

    expect(decoded.selectedItem).toMatchObject({
      mode: 'kmb',
      query: 'airport',
      routeFilterMode: 'simple',
      route: 'A21, A22',
    })
  })

  it('encodes advanced filter keys without kmb prefix', () => {
    const input: UrlEncodeInput = {
      mode: 'kmb',
      lang: 'tc',
      routeFilterMode: 'advanced',
      autoRefreshSeconds: 15,
      kmb: {
        query: { mode: 'stop', stopId: 'ABCD' },
        routeFilter: { entries: [{ variantKey: 'kmb|1|O|1' }] },
      },
      mtr: null,
      lrt: null,
    }

    const encoded = encodeUrlState(input)

    expect(encoded).toContain('ke=1%7CO%7C1')
  })

  it('roundtrips multi-stop selections', () => {
    const input: UrlEncodeInput = {
      mode: 'kmb',
      lang: 'en',
      routeFilterMode: 'simple',
      autoRefreshSeconds: 10,
      kmb: {
        query: { mode: 'stops', stopIds: ['A01', 'A02'] },
        routeFilter: { routes: '1A' },
      },
      mtr: null,
      lrt: null,
    }

    const encoded = encodeUrlState(input)
    const decoded = decodeUrlState(encoded)

    expect(decoded.selectedItem).toMatchObject({
      mode: 'kmb',
      stopIds: ['A01', 'A02'],
      routeFilterMode: 'simple',
      route: '1A',
    })
  })
})
