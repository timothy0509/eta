import { beforeEach, describe, expect, it } from 'vitest'

import {
  clearCtbStopStreetCache,
  parseCtbStopName,
  parseCtbStopNameCached,
  parseCtbStopStreet,
  parseCtbStopStreetCached,
} from './ctb-stop-street'

beforeEach(() => {
  clearCtbStopStreetCache()
})

describe('parseCtbStopStreet', () => {
  it('takes the street part after the comma', () => {
    expect(parseCtbStopStreet('Rumsey Street, Des Voeux Road Central')).toBe(
      'Des Voeux Road Central'
    )
  })

  it('works for Chinese names', () => {
    expect(parseCtbStopStreet('林士街, 德輔道中')).toBe('德輔道中')
  })

  it('returns null when there is no street', () => {
    expect(parseCtbStopStreet('Central (Macao Ferry)')).toBeNull()
    expect(parseCtbStopStreet('Green Lane')).toBeNull()
    expect(parseCtbStopStreet('')).toBeNull()
  })

  it('returns null when the street is blank', () => {
    expect(parseCtbStopStreet('Foo,   ')).toBeNull()
  })

  it('supports the fullwidth comma', () => {
    expect(parseCtbStopStreet('Foo，Bar Road')).toBe('Bar Road')
  })

  it('keeps everything after the first comma', () => {
    expect(parseCtbStopStreet('A, B, C')).toBe('B, C')
  })
})

describe('parseCtbStopStreetCached', () => {
  it('caches results per input', () => {
    const first = parseCtbStopStreetCached('Rumsey Street, Des Voeux Road Central')
    expect(first).toBe('Des Voeux Road Central')
    expect(parseCtbStopStreetCached('Rumsey Street, Des Voeux Road Central')).toBe(first)
    expect(parseCtbStopStreetCached('Green Lane')).toBeNull()
  })
})

describe('parseCtbStopName', () => {
  it('splits name and street', () => {
    expect(parseCtbStopName('Rumsey Street, Des Voeux Road Central')).toEqual({
      name: 'Rumsey Street',
      street: 'Des Voeux Road Central',
    })
  })

  it('keeps the full name when there is no street', () => {
    expect(parseCtbStopName('Central (Macao Ferry)')).toEqual({
      name: 'Central (Macao Ferry)',
      street: null,
    })
  })

  it('caches results per input', () => {
    const first = parseCtbStopNameCached('林士街, 德輔道中')
    expect(first).toEqual({ name: '林士街', street: '德輔道中' })
    expect(parseCtbStopNameCached('林士街, 德輔道中')).toBe(first)
  })
})
