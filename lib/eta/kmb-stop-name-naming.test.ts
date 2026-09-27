import { describe, expect, it } from 'vitest'

import { resolveJointRouteEndpoint } from '@/lib/eta/kmb-stop-name'

const info = {
  origin: { en: 'KMB Origin', tc: '九巴起點', sc: '九巴起点' },
  destination: { en: 'KMB Destination', tc: '九巴終點', sc: '九巴终点' },
  namesByOperator: {
    kmb: {
      origin: { en: 'KMB Origin', tc: '九巴起點', sc: '九巴起点' },
      destination: { en: 'KMB Destination', tc: '九巴終點', sc: '九巴终点' },
    },
    ctb: {
      origin: { en: 'CTB Origin', tc: '城巴起點', sc: '城巴起点' },
      destination: { en: 'CTB Destination', tc: '城巴終點', sc: '城巴终点' },
    },
  },
}

describe('resolveJointRouteEndpoint', () => {
  it('follows a KMB stop to KMB names', () => {
    expect(
      resolveJointRouteEndpoint(info, 'destination', {
        source: 'stop',
        isKmbStop: true,
        lang: 'tc',
      })
    ).toBe('九巴終點')
  })

  it('follows a non-KMB stop to CTB names', () => {
    expect(
      resolveJointRouteEndpoint(info, 'destination', {
        source: 'stop',
        isKmbStop: false,
        lang: 'tc',
      })
    ).toBe('城巴終點')
  })

  it('lets the setting override the stop', () => {
    expect(
      resolveJointRouteEndpoint(info, 'destination', {
        source: 'kmb',
        isKmbStop: false,
        lang: 'tc',
      })
    ).toBe('九巴終點')
    expect(
      resolveJointRouteEndpoint(info, 'destination', { source: 'ctb', isKmbStop: true, lang: 'en' })
    ).toBe('CTB Destination')
  })

  it('falls back to primary when the winner has no string', () => {
    const missing = {
      ...info,
      namesByOperator: {
        kmb: info.namesByOperator.kmb,
        ctb: {
          origin: { en: '', tc: '', sc: '' },
          destination: { en: '', tc: '', sc: '' },
        },
      },
    }
    expect(
      resolveJointRouteEndpoint(missing, 'destination', {
        source: 'stop',
        isKmbStop: false,
        lang: 'tc',
      })
    ).toBe('九巴終點')
  })
})
