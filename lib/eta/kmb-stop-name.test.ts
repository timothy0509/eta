import { beforeEach, describe, expect, it } from 'vitest'

import {
  clearKmbStopNameCache,
  formatKmbRouteEndpointName,
  parseKmbStopName,
  parseKmbStopNameCached,
  titleCaseKmbEnName,
} from './kmb-stop-name'

beforeEach(() => {
  clearKmbStopNameCache()
})

describe('parseKmbStopName gating', () => {
  it('strips a KMB stop code when isKmb is true', () => {
    expect(
      parseKmbStopName('Chuk Yuen Estate Bus Terminus (WT916)', { isKmb: true, lang: 'tc' })
    ).toEqual({
      name: 'Chuk Yuen Estate Bus Terminus',
      platform: null,
      stopCode: 'WT916',
    })
  })

  it('passes the same string through untouched when isKmb is falsy', () => {
    const fullName = 'Chuk Yuen Estate Bus Terminus (WT916)'
    expect(parseKmbStopName(fullName, { isKmb: false })).toEqual({
      name: fullName,
      platform: null,
      stopCode: null,
    })
    expect(parseKmbStopName(fullName)).toEqual({
      name: fullName,
      platform: null,
      stopCode: null,
    })
  })

  it('parses platform plus stop code', () => {
    expect(
      parseKmbStopName('Tuen Mun Road BBI (A12) (TM744)', { isKmb: true, lang: 'tc' })
    ).toEqual({
      name: 'Tuen Mun Road BBI',
      platform: 'A12',
      stopCode: 'TM744',
    })
  })

  it('parses platform only', () => {
    expect(parseKmbStopName('Central (A1)', { isKmb: true, lang: 'tc' })).toEqual({
      name: 'Central',
      platform: 'A1',
      stopCode: null,
    })
  })

  it('returns plain names unchanged with isKmb', () => {
    expect(parseKmbStopName('Central', { isKmb: true, lang: 'tc' })).toEqual({
      name: 'Central',
      platform: null,
      stopCode: null,
    })
  })
})

describe('titleCaseKmbEnName', () => {
  const cases: Array<[string, string]> = [
    ['CHUK YUEN ESTATE BUS TERMINUS', 'Chuk Yuen Estate Bus Terminus'],
    ['TUEN MUN ROAD BBI', 'Tuen Mun Road BBI'],
    ['H.K. BAPTIST UNIVERSITY', 'H.K. Baptist University'],
    ["O'BRIEN ROAD", "O'Brien Road"],
    ['BEL-AIR ON THE PEAK', 'Bel-Air On The Peak'],
    ['CHINA HONG KONG CITY B/T', 'China Hong Kong City B/T'],
    ['METRO CITY PHASE II', 'Metro City Phase II'],
    ['apm MILLENNIUM CITY 5', 'apm Millennium City 5'],
    ['MTR TSUEN WAN STATION', 'MTR Tsuen Wan Station'],
    ['DR SUN YAT-SEN MUSEUM', 'Dr Sun Yat-Sen Museum'],
    ["ST. TERESA'S HOSPITAL", "St. Teresa's Hospital"],
    ['APM TERMINUS', 'APM Terminus'],
    ['IFC MALL', 'IFC Mall'],
    ['HK SCIENCE PARK', 'HK Science Park'],
    ['MOKO SHOPPING CENTRE', 'MOKO Shopping Centre'],
  ]

  for (const [input, expected] of cases) {
    it(`${input} -> ${expected}`, () => {
      expect(titleCaseKmbEnName(input)).toBe(expected)
    })
  }

  it('is idempotent', () => {
    for (const [, expected] of cases) {
      expect(titleCaseKmbEnName(expected)).toBe(expected)
    }
  })
})

describe('parseKmbStopName lang handling', () => {
  it('title-cases the stripped name body for en, keeps suffixes uppercase', () => {
    expect(
      parseKmbStopName('TUEN MUN ROAD BBI (A12) (TM744)', { isKmb: true, lang: 'en' })
    ).toEqual({
      name: 'Tuen Mun Road BBI',
      platform: 'A12',
      stopCode: 'TM744',
    })
  })

  it('passes tc/sc names through un-cased', () => {
    const name = '屯門公路轉車站'
    for (const lang of ['tc', 'sc'] as const) {
      expect(parseKmbStopName(name, { isKmb: true, lang })).toEqual({
        name,
        platform: null,
        stopCode: null,
      })
    }
  })

  it('passes non-KMB mixed-case names through byte-identical', () => {
    const mixed = 'apm Millennium City 5 (some suffix)'
    for (const lang of ['en', 'tc', 'sc'] as const) {
      expect(parseKmbStopName(mixed, { isKmb: false, lang })).toEqual({
        name: mixed,
        platform: null,
        stopCode: null,
      })
    }
  })
})

describe('parseKmbStopNameCached', () => {
  it('is deterministic across flag values', () => {
    const kmb = parseKmbStopNameCached('CHUK YUEN ESTATE BUS TERMINUS (WT916)', {
      isKmb: true,
      lang: 'en',
    })
    expect(kmb).toEqual({
      name: 'Chuk Yuen Estate Bus Terminus',
      platform: null,
      stopCode: 'WT916',
    })
    // Repeating the same flags hits the cache and returns the same object.
    expect(
      parseKmbStopNameCached('CHUK YUEN ESTATE BUS TERMINUS (WT916)', {
        isKmb: true,
        lang: 'en',
      })
    ).toBe(kmb)
    // Different flags get their own cache entry, not the KMB one.
    const nonKmb = parseKmbStopNameCached('CHUK YUEN ESTATE BUS TERMINUS (WT916)', {
      isKmb: false,
      lang: 'en',
    })
    expect(nonKmb).toEqual({
      name: 'CHUK YUEN ESTATE BUS TERMINUS (WT916)',
      platform: null,
      stopCode: null,
    })
    expect(nonKmb).not.toBe(kmb)
  })
})

describe('formatKmbRouteEndpointName', () => {
  it('title-cases KMB English endpoints with the stop-name rules', () => {
    expect(formatKmbRouteEndpointName('KWUN TONG FERRY', { co: 'kmb', lang: 'en' })).toBe(
      'Kwun Tong Ferry'
    )
    expect(formatKmbRouteEndpointName('TUEN MUN ROAD BBI', { co: 'kmb', lang: 'en' })).toBe(
      'Tuen Mun Road BBI'
    )
    expect(formatKmbRouteEndpointName('CHINA HONG KONG CITY B/T', { co: 'kmb', lang: 'en' })).toBe(
      'China Hong Kong City B/T'
    )
    expect(formatKmbRouteEndpointName('METRO CITY PHASE II', { co: 'kmb', lang: 'en' })).toBe(
      'Metro City Phase II'
    )
  })

  it('passes tc/sc names through unchanged', () => {
    for (const lang of ['tc', 'sc'] as const) {
      expect(formatKmbRouteEndpointName('KWUN TONG FERRY', { co: 'kmb', lang })).toBe(
        'KWUN TONG FERRY'
      )
      expect(formatKmbRouteEndpointName('觀塘碼頭', { co: 'kmb', lang })).toBe('觀塘碼頭')
    }
  })

  it('passes non-KMB operators through unchanged', () => {
    expect(formatKmbRouteEndpointName('KWUN TONG FERRY', { co: 'ctb', lang: 'en' })).toBe(
      'KWUN TONG FERRY'
    )
    expect(formatKmbRouteEndpointName('KWUN TONG FERRY', { lang: 'en' })).toBe('Kwun Tong Ferry')
  })

  it('is idempotent', () => {
    expect(formatKmbRouteEndpointName('Kwun Tong Ferry', { co: 'kmb', lang: 'en' })).toBe(
      'Kwun Tong Ferry'
    )
  })
})
