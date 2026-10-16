import { describe, expect, it } from 'vitest'

import type { EtaGroup } from './kmb-eta-groups'
import { sortScheduledFirst } from './kmb-eta-groups'

function makeGroup(key: string, baseKey: string, hasEta: boolean): EtaGroup {
  return { key, baseKey, items: [], hasEta, hasFare: true, isArrivingLeg: false }
}

const scheduled = { headwayMin: 12 }

describe('sortScheduledFirst', () => {
  it('keeps live groups first and moves scheduled fallbacks to the front of the no-ETA tail', () => {
    const groups = [
      makeGroup('kmb|1A|O|1|_', 'kmb|1A|O|1', true),
      makeGroup('kmb|3C|O|1|_', 'kmb|3C|O|1', false),
      makeGroup('kmb|2B|O|1|_', 'kmb|2B|O|1', false),
      makeGroup('kmb|4D|O|1|_', 'kmb|4D|O|1', false),
    ]

    const result = sortScheduledFirst(groups, {
      'kmb|2B|O|1': scheduled,
      'kmb|4D|O|1': scheduled,
    })

    expect(result.map((g) => g.key)).toEqual([
      'kmb|1A|O|1|_',
      'kmb|2B|O|1|_',
      'kmb|4D|O|1|_',
      'kmb|3C|O|1|_',
    ])
  })

  it('leaves live groups in place and only reorders the suffix after the last live group', () => {
    const groups = [
      makeGroup('kmb|2B|O|1|_', 'kmb|2B|O|1', false),
      makeGroup('kmb|1A|O|1|_', 'kmb|1A|O|1', true),
      makeGroup('kmb|3C|O|1|_', 'kmb|3C|O|1', false),
      makeGroup('kmb|4D|O|1|_', 'kmb|4D|O|1', false),
    ]

    const result = sortScheduledFirst(groups, {
      'kmb|2B|O|1': scheduled,
      'kmb|4D|O|1': scheduled,
    })

    expect(result.map((g) => g.key)).toEqual([
      'kmb|2B|O|1|_',
      'kmb|1A|O|1|_',
      'kmb|4D|O|1|_',
      'kmb|3C|O|1|_',
    ])
  })

  it('preserves route order within each part instead of re-sorting', () => {
    const groups = [
      makeGroup('kmb|9|O|1|_', 'kmb|9|O|1', false),
      makeGroup('kmb|1A|O|1|_', 'kmb|1A|O|1', false),
      makeGroup('kmb|Z|O|1|_', 'kmb|Z|O|1', false),
      makeGroup('kmb|5|O|1|_', 'kmb|5|O|1', false),
    ]

    const result = sortScheduledFirst(groups, {
      'kmb|9|O|1': scheduled,
      'kmb|1A|O|1': scheduled,
    })

    expect(result.map((g) => g.key)).toEqual([
      'kmb|9|O|1|_',
      'kmb|1A|O|1|_',
      'kmb|Z|O|1|_',
      'kmb|5|O|1|_',
    ])
  })

  it('moves both legs sharing a scheduled baseKey together', () => {
    const groups = [
      makeGroup('kmb|1A|O|1|_', 'kmb|1A|O|1', false),
      makeGroup('kmb|1A|O|1|A', 'kmb|1A|O|1', false),
      makeGroup('kmb|2B|O|1|_', 'kmb|2B|O|1', false),
    ]

    const result = sortScheduledFirst(groups, { 'kmb|1A|O|1': scheduled })

    expect(result.map((g) => g.key)).toEqual(['kmb|1A|O|1|_', 'kmb|1A|O|1|A', 'kmb|2B|O|1|_'])
  })

  it('returns the input unchanged for an empty map', () => {
    const groups = [makeGroup('kmb|1A|O|1|_', 'kmb|1A|O|1', false)]
    expect(sortScheduledFirst(groups, {})).toBe(groups)
  })

  it('returns the input unchanged when nothing in the tail has a schedule', () => {
    const groups = [
      makeGroup('kmb|1A|O|1|_', 'kmb|1A|O|1', true),
      makeGroup('kmb|2B|O|1|_', 'kmb|2B|O|1', false),
    ]
    expect(sortScheduledFirst(groups, { 'kmb|9|O|1': scheduled })).toBe(groups)
  })

  it('returns the input unchanged when every tail group has a schedule', () => {
    const groups = [
      makeGroup('kmb|1A|O|1|_', 'kmb|1A|O|1', true),
      makeGroup('kmb|2B|O|1|_', 'kmb|2B|O|1', false),
      makeGroup('kmb|3C|O|1|_', 'kmb|3C|O|1', false),
    ]
    const result = sortScheduledFirst(groups, {
      'kmb|2B|O|1': scheduled,
      'kmb|3C|O|1': scheduled,
    })
    expect(result).toBe(groups)
  })

  it('returns the input unchanged for a single trailing group', () => {
    const groups = [makeGroup('kmb|2B|O|1|_', 'kmb|2B|O|1', false)]
    expect(sortScheduledFirst(groups, { 'kmb|2B|O|1': scheduled })).toBe(groups)
  })
})
