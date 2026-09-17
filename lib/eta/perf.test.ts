import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  clearPerfReports,
  getLastWebVitals,
  getPerfReports,
  initWebVitalsSampler,
  markPerf,
  measurePerf,
  timeAsync,
} from './perf'

describe('perf helpers', () => {
  beforeEach(() => {
    clearPerfReports()
    vi.unstubAllGlobals()
  })

  it('records timeAsync durations and passes values through', async () => {
    const result = await timeAsync('kmb-stop-etas', async () => 42, { mode: 'kmb' })
    expect(result).toBe(42)
    const reports = getPerfReports()
    expect(reports).toHaveLength(1)
    expect(reports[0]).toMatchObject({ name: 'kmb-stop-etas', mode: 'kmb' })
    expect(reports[0]?.durationMs).toBeGreaterThanOrEqual(0)
  })

  it('caps the report buffer', async () => {
    for (let i = 0; i < 60; i += 1) {
      await timeAsync(`op-${i}`, async () => i)
    }
    expect(getPerfReports()).toHaveLength(50)
    expect(getPerfReports()[49]?.name).toBe('op-59')
  })

  it('markPerf and measurePerf do not throw without performance APIs', () => {
    vi.stubGlobal('performance', undefined)
    expect(() => markPerf('x')).not.toThrow()
    expect(measurePerf('x')).toBeNull()
  })

  it('sampler skips saveData connections', () => {
    vi.stubGlobal('window', {})
    vi.stubGlobal('navigator', { connection: { saveData: true } })
    const cleanup = initWebVitalsSampler({ onReport: () => {} })
    expect(typeof cleanup).toBe('function')
    expect(getLastWebVitals()).toBeNull()
    cleanup()
  })

  it('sampler respects a zero sample rate', () => {
    vi.stubGlobal('window', { addEventListener: vi.fn() })
    vi.stubGlobal('navigator', {})
    const onReport = vi.fn()
    const cleanup = initWebVitalsSampler({ sampleRate: 0, onReport })
    expect(onReport).not.toHaveBeenCalled()
    expect(typeof cleanup).toBe('function')
    cleanup()
  })
})
