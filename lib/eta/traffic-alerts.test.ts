import { describe, expect, it } from 'vitest'
import { getTrafficAlerts, TRAFFIC_ALERTS } from './traffic-alerts'

describe('TRAFFIC_ALERTS', () => {
  it('has stable unique ids', () => {
    const ids = TRAFFIC_ALERTS.map((alert) => alert.id)
    expect(ids.length).toBeGreaterThan(0)
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) {
      expect(id).toMatch(/^[a-z0-9-]+$/)
    }
  })

  it('gives every entry en plus tc plus sc text', () => {
    for (const alert of TRAFFIC_ALERTS) {
      expect(alert.en.trim().length).toBeGreaterThan(0)
      expect(alert.tc.trim().length).toBeGreaterThan(0)
      expect(alert.sc.trim().length).toBeGreaterThan(0)
    }
  })

  it('links every entry over https', () => {
    for (const alert of TRAFFIC_ALERTS) {
      expect(alert.link.startsWith('https://')).toBe(true)
    }
  })

  it('returns a copy from getTrafficAlerts', () => {
    expect(getTrafficAlerts()).toEqual(TRAFFIC_ALERTS)
    expect(getTrafficAlerts()).not.toBe(TRAFFIC_ALERTS)
  })
})
