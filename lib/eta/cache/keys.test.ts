import { describe, expect, it } from 'vitest'

import { kmbStopEtaKey } from './keys'

describe('kmbStopEtaKey', () => {
  it('keys the same stop separately per joint operator preference', () => {
    expect(kmbStopEtaKey('S1', 'kmb')).not.toBe(kmbStopEtaKey('S1', 'ctb'))
  })

  it('keeps unpreferred lookups on the legacy key', () => {
    expect(kmbStopEtaKey('S1')).toBe('stop-eta:S1')
    expect(kmbStopEtaKey('S1', null)).toBe('stop-eta:S1')
  })
})
