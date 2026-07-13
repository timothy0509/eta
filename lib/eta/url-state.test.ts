import { describe, expect, it } from 'vitest'
import { encodeUrlState, decodeUrlState } from './url-state'
import type { UrlEncodeInput } from './url-state'

describe('encodeUrlState', () => {
  it('returns empty string for default state', () => {
    const input: UrlEncodeInput = {
      mode: 'kmb',
      subView: 'stops',
      lang: 'tc',
      routeFilterMode: 'simple',
      autoRefreshSeconds: 15,
    }
    expect(encodeUrlState(input)).toBe('')
  })

  it('encodes non-default mode', () => {
    const input: UrlEncodeInput = {
      mode: 'mtr',
      subView: 'stops',
      lang: 'tc',
      routeFilterMode: 'simple',
      autoRefreshSeconds: 15,
    }
    expect(encodeUrlState(input)).toContain('m=mtr')
  })

  it('encodes non-default language', () => {
    const input: UrlEncodeInput = {
      mode: 'kmb',
      subView: 'stops',
      lang: 'en',
      routeFilterMode: 'simple',
      autoRefreshSeconds: 15,
    }
    expect(encodeUrlState(input)).toContain('l=en')
  })

  it('encodes KMB stop query', () => {
    const input: UrlEncodeInput = {
      mode: 'kmb',
      subView: 'stops',
      lang: 'tc',
      routeFilterMode: 'simple',
      autoRefreshSeconds: 15,
      kmb: {
        query: { mode: 'stop', stopId: '1234' },
      },
    }
    const encoded = encodeUrlState(input)
    expect(encoded).toContain('km=stop')
    expect(encoded).toContain('ks=1234')
  })

  it('encodes KMB stops query', () => {
    const input: UrlEncodeInput = {
      mode: 'kmb',
      subView: 'stops',
      lang: 'tc',
      routeFilterMode: 'simple',
      autoRefreshSeconds: 15,
      kmb: {
        query: { mode: 'stops', stopIds: ['1234', '5678'] },
      },
    }
    const encoded = encodeUrlState(input)
    expect(encoded).toContain('km=stops')
    expect(encoded).toContain('kss=1234%2C5678')
  })

  it('encodes KMB contains query', () => {
    const input: UrlEncodeInput = {
      mode: 'kmb',
      subView: 'stops',
      lang: 'tc',
      routeFilterMode: 'simple',
      autoRefreshSeconds: 15,
      kmb: {
        query: { mode: 'contains', query: '1A' },
      },
    }
    const encoded = encodeUrlState(input)
    expect(encoded).toContain('km=contains')
    expect(encoded).toContain('kq=1A')
  })

  it('encodes MTR station', () => {
    const input: UrlEncodeInput = {
      mode: 'mtr',
      subView: 'stops',
      lang: 'tc',
      routeFilterMode: 'simple',
      autoRefreshSeconds: 15,
      mtr: { sta: 'CEN' },
    }
    expect(encodeUrlState(input)).toContain('ms=CEN')
  })

  it('encodes LRT station', () => {
    const input: UrlEncodeInput = {
      mode: 'lrt',
      subView: 'stops',
      lang: 'tc',
      routeFilterMode: 'simple',
      autoRefreshSeconds: 15,
      lrt: { stationId: '100' },
    }
    expect(encodeUrlState(input)).toContain('ls=100')
  })

  it('encodes auto refresh seconds when non-default', () => {
    const input: UrlEncodeInput = {
      mode: 'kmb',
      subView: 'stops',
      lang: 'tc',
      routeFilterMode: 'simple',
      autoRefreshSeconds: 30,
    }
    expect(encodeUrlState(input)).toContain('ar=30')
  })

  it('encodes route filter mode when advanced', () => {
    const input: UrlEncodeInput = {
      mode: 'kmb',
      subView: 'stops',
      lang: 'tc',
      routeFilterMode: 'advanced',
      autoRefreshSeconds: 15,
      kmb: {
        query: { mode: 'stop', stopId: '1234' },
        routeFilter: {
          entries: [{ variantKey: 'kmb|1A|1|1' }],
        },
      },
    }
    const encoded = encodeUrlState(input)
    expect(encoded).toContain('rfm=advanced')
  })
})

describe('decodeUrlState', () => {
  it('returns empty state for empty string', () => {
    const result = decodeUrlState('')
    expect(result.state).toEqual({})
    expect(result.selectedItem).toBeNull()
  })

  it('decodes mode parameter', () => {
    const result = decodeUrlState('m=mtr')
    expect(result.state.mode).toBe('mtr')
  })

  it('decodes language parameter', () => {
    const result = decodeUrlState('l=en')
    expect(result.state.lang).toBe('en')
  })

  it('decodes KMB stop query', () => {
    const result = decodeUrlState('km=stop&ks=1234')
    expect(result.state.mode).toBe('kmb')
    expect(result.selectedItem).not.toBeNull()
    expect(result.selectedItem?.mode).toBe('kmb')
    expect(result.selectedItem).toHaveProperty('stopId', '1234')
  })

  it('decodes KMB stops query', () => {
    const result = decodeUrlState('km=stops&kss=1234,5678')
    expect(result.state.mode).toBe('kmb')
    expect(result.selectedItem).not.toBeNull()
    expect(result.selectedItem).toHaveProperty('stopIds', ['1234', '5678'])
  })

  it('decodes KMB contains query', () => {
    const result = decodeUrlState('km=contains&kq=1A')
    expect(result.state.mode).toBe('kmb')
    expect(result.selectedItem).not.toBeNull()
    expect(result.selectedItem).toHaveProperty('query', '1A')
  })

  it('decodes MTR station', () => {
    const result = decodeUrlState('ms=CEN')
    expect(result.state.mode).toBe('mtr')
    expect(result.selectedItem).not.toBeNull()
    expect(result.selectedItem?.mode).toBe('mtr')
    expect(result.selectedItem).toHaveProperty('sta', 'CEN')
  })

  it('decodes LRT station', () => {
    const result = decodeUrlState('ls=100')
    expect(result.state.mode).toBe('lrt')
    expect(result.selectedItem).not.toBeNull()
    expect(result.selectedItem?.mode).toBe('lrt')
    expect(result.selectedItem).toHaveProperty('stationId', '100')
  })

  it('decodes auto refresh seconds', () => {
    const result = decodeUrlState('ar=30')
    expect(result.state.autoRefreshSeconds).toBe(30)
  })

  it('rejects invalid auto refresh values', () => {
    const result = decodeUrlState('ar=25')
    expect(result.state.autoRefreshSeconds).toBeUndefined()
  })

  it('decodes route filter mode', () => {
    const result = decodeUrlState('rfm=advanced')
    expect(result.state.routeFilterMode).toBe('advanced')
  })

  it('decodes sub view parameter', () => {
    const result = decodeUrlState('v=nearby')
    expect(result.state.subView).toBe('nearby')
  })

  it('encodes non-default sub view', () => {
    const input: UrlEncodeInput = {
      mode: 'kmb',
      subView: 'routes',
      lang: 'tc',
      routeFilterMode: 'simple',
      autoRefreshSeconds: 15,
    }
    expect(encodeUrlState(input)).toContain('v=routes')
  })

  it('infers mode from MTR station when mode param missing', () => {
    const result = decodeUrlState('ms=CEN')
    expect(result.state.mode).toBe('mtr')
  })

  it('infers mode from LRT station when mode param missing', () => {
    const result = decodeUrlState('ls=100')
    expect(result.state.mode).toBe('lrt')
  })

  it('handles query string with leading ?', () => {
    const result = decodeUrlState('?m=mtr&ms=CEN')
    expect(result.state.mode).toBe('mtr')
    expect(result.selectedItem).not.toBeNull()
  })

  it('ignores invalid mode values', () => {
    const result = decodeUrlState('m=invalid')
    expect(result.state.mode).toBeUndefined()
  })

  it('ignores invalid language values', () => {
    const result = decodeUrlState('l=fr')
    expect(result.state.lang).toBeUndefined()
  })

  it('round-trips KMB stop state', () => {
    const input: UrlEncodeInput = {
      mode: 'kmb',
      subView: 'stops',
      lang: 'tc',
      routeFilterMode: 'simple',
      autoRefreshSeconds: 15,
      kmb: {
        query: { mode: 'stop', stopId: '1234' },
      },
    }
    const encoded = encodeUrlState(input)
    const decoded = decodeUrlState(encoded)
    expect(decoded.state.mode).toBe('kmb')
    expect(decoded.selectedItem?.mode).toBe('kmb')
    expect(decoded.selectedItem).toHaveProperty('stopId', '1234')
  })
})
