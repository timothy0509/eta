import { describe, expect, it } from 'vitest'

import {
  inferJointRouteNumbers,
  isJointRoute,
  jointRouteGroupKey,
  resolveJointOperators,
  type JointRouteManifest,
} from './joint-routes'

const manifest: JointRouteManifest = {
  updated: '2026-11-02',
  routes: {
    '102': { operators: ['ctb', 'kmb'], agency: 'KMB+CTB', longName: 'SHAU KEI WAN - MEI FOO' },
    R8: { operators: ['ctb', 'kmb'], agency: 'LWB+CTB', longName: 'DISNEYLAND' },
  },
}

describe('resolveJointOperators', () => {
  it('returns both operators for a manifest joint route', () => {
    expect(resolveJointOperators(manifest, '102', ['kmb', 'ctb'])).toEqual(['ctb', 'kmb'])
  })

  it('ignores an operator pair the manifest does not list for the route', () => {
    expect(resolveJointOperators(manifest, '102', ['kmb', 'nlb'])).toEqual([])
  })

  it('falls back to the upstream pair when the manifest has no entry', () => {
    expect(resolveJointOperators(manifest, '999', ['kmb', 'ctb'])).toEqual(['ctb', 'kmb'])
  })

  it('falls back to the upstream pair when no manifest is available', () => {
    expect(resolveJointOperators(null, '102', ['kmb', 'ctb'])).toEqual(['ctb', 'kmb'])
  })

  it('never treats one operator as joint', () => {
    expect(resolveJointOperators(manifest, '102', ['ctb'])).toEqual([])
  })

  it('reports joint status through the helper', () => {
    expect(isJointRoute(manifest, '102', ['kmb', 'ctb'])).toBe(true)
    expect(isJointRoute(manifest, '102', ['ctb'])).toBe(false)
  })
})

describe('jointRouteGroupKey', () => {
  it('groups one-operator specials under the route number', () => {
    expect(jointRouteGroupKey(manifest, '102', ['ctb'])).toBe('joint|102')
  })

  it('does not group a different operator with the same number', () => {
    expect(jointRouteGroupKey(manifest, '102', ['gmb'])).toBe('')
  })
})

describe('inferJointRouteNumbers', () => {
  it('finds routes missing from the manifest when both operators share termini', () => {
    const inferred = inferJointRouteNumbers([
      {
        co: ['kmb'],
        route: '101R',
        orig: { en: 'HAPPY VALLEY RACE COURSE' },
        dest: { en: 'KWUN TONG (YUE MAN SQUARE)' },
        serviceType: '1',
      },
      {
        co: ['ctb'],
        route: '101R',
        orig: { en: 'Happy Valley Racecourse' },
        dest: { en: 'Kwun Tong (Yue Man Square)' },
        serviceType: 1,
      },
    ])
    expect(inferred.has('101R')).toBe(true)
  })

  it('does not infer a shared number with different termini', () => {
    const inferred = inferJointRouteNumbers([
      {
        co: ['kmb'],
        route: '102',
        orig: { en: 'MEI FOO' },
        dest: { en: 'SHAU KEI WAN' },
        serviceType: '1',
      },
      {
        co: ['ctb'],
        route: '102',
        orig: { en: 'Hang Hau' },
        dest: { en: 'San Po Kong' },
        serviceType: '1',
      },
    ])
    expect(inferred.has('102')).toBe(false)
  })
})
