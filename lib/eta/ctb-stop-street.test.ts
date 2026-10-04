import { beforeEach, describe, expect, it } from 'vitest'

import {
  buildStreetRuns,
  clearCtbStopStreetCache,
  parseCtbStopName,
  parseCtbStopNameCached,
  parseCtbStopStreet,
  parseCtbStopStreetCached,
  pickCtbDisplayName,
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

  it('returns null when the name part is blank', () => {
    expect(parseCtbStopStreet(', Foo')).toBeNull()
    expect(parseCtbStopStreet(' , Foo')).toBeNull()
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

  it('trims whitespace-only names', () => {
    expect(parseCtbStopName('   ')).toEqual({ name: '', street: null })
  })

  it('keeps the full name when the name part is blank', () => {
    expect(parseCtbStopName(', Foo')).toEqual({ name: ', Foo', street: null })
    expect(parseCtbStopName(' , Foo')).toEqual({ name: ', Foo', street: null })
  })

  it('caches results per input', () => {
    const first = parseCtbStopNameCached('林士街, 德輔道中')
    expect(first).toEqual({ name: '林士街', street: '德輔道中' })
    expect(parseCtbStopNameCached('林士街, 德輔道中')).toBe(first)
  })
})

describe('pickCtbDisplayName', () => {
  it('prefers the CTB name part', () => {
    expect(pickCtbDisplayName('Rumsey Street', 'Full Name')).toBe('Rumsey Street')
  })

  it('falls back when the CTB name part is blank', () => {
    expect(pickCtbDisplayName('', 'Full Name')).toBe('Full Name')
    expect(pickCtbDisplayName(null, 'Full Name')).toBe('Full Name')
    expect(pickCtbDisplayName(undefined, 'Full Name')).toBe('Full Name')
  })
})

describe('buildStreetRuns', () => {
  it('groups consecutive stops on the same street', () => {
    expect(
      buildStreetRuns(['a', 'b', 'c'], (item) => (item === 'c' ? 'Second St' : 'Main St'))
    ).toEqual([
      { street: 'Main St', items: ['a', 'b'], colorIdx: 0 },
      { street: 'Second St', items: ['c'], colorIdx: 1 },
    ])
  })

  it('starts a new run when a street repeats non-consecutively', () => {
    const runs = buildStreetRuns(['a', 'b', 'c'], (item) =>
      item === 'b' ? 'Second St' : 'Main St'
    )
    expect(runs?.map((run) => run.street)).toEqual(['Main St', 'Second St', 'Main St'])
    expect(runs?.map((run) => run.colorIdx)).toEqual([0, 1, 2])
  })

  it('groups unknown streets without consuming palette indices', () => {
    expect(buildStreetRuns(['a', 'b', 'c'], (item) => (item === 'b' ? null : 'Main St'))).toEqual([
      { street: 'Main St', items: ['a'], colorIdx: 0 },
      { street: null, items: ['b'], colorIdx: -1 },
      { street: 'Main St', items: ['c'], colorIdx: 1 },
    ])
  })

  it('returns null when no stop has a street', () => {
    expect(buildStreetRuns(['a', 'b'], () => null)).toBeNull()
  })
})
