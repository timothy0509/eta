import { describe, expect, it } from 'vitest'
import { LRT_STATIONS } from '@/lib/data/lrt-stations'
import { MTR_STATIONS } from '@/lib/data/mtr-stations'
import { findMtrStationBySta } from '@/lib/data/mtr-stations'

// Hong Kong territory, with margin for the boundary crossing stations (Lo Wu, Lok Ma Chau).
const HK_BOUNDS = { minLat: 22.14, maxLat: 22.57, minLng: 113.82, maxLng: 114.52 }

describe('mtr-stations', () => {
  it('has valid Hong Kong coordinates for every station', () => {
    for (const station of MTR_STATIONS) {
      expect(station.lat, `${station.sta} lat`).toBeGreaterThanOrEqual(HK_BOUNDS.minLat)
      expect(station.lat, `${station.sta} lat`).toBeLessThanOrEqual(HK_BOUNDS.maxLat)
      expect(station.lng, `${station.sta} lng`).toBeGreaterThanOrEqual(HK_BOUNDS.minLng)
      expect(station.lng, `${station.sta} lng`).toBeLessThanOrEqual(HK_BOUNDS.maxLng)
    }
  })

  it('has unique sta codes', () => {
    expect(new Set(MTR_STATIONS.map((s) => s.sta)).size).toBe(MTR_STATIONS.length)
  })

  it('finds a station by sta', () => {
    expect(findMtrStationBySta('HOK')?.nameEn).toBe('Hong Kong')
    expect(findMtrStationBySta('???')).toBeUndefined()
  })
})

describe('lrt-stations', () => {
  it('has valid Hong Kong coordinates for every stop', () => {
    for (const station of LRT_STATIONS) {
      expect(station.lat, `${station.stationId} lat`).toBeGreaterThanOrEqual(HK_BOUNDS.minLat)
      expect(station.lat, `${station.stationId} lat`).toBeLessThanOrEqual(HK_BOUNDS.maxLat)
      expect(station.lng, `${station.stationId} lng`).toBeGreaterThanOrEqual(HK_BOUNDS.minLng)
      expect(station.lng, `${station.stationId} lng`).toBeLessThanOrEqual(HK_BOUNDS.maxLng)
    }
  })

  it('has unique station ids', () => {
    expect(new Set(LRT_STATIONS.map((s) => s.stationId)).size).toBe(LRT_STATIONS.length)
  })
})
