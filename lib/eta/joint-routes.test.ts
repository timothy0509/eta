import { describe, expect, it } from 'vitest'

import { isJointRoute, resolveJointOperators, type JointRouteManifest } from './joint-routes'

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
