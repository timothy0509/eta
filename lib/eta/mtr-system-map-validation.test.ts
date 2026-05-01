import { describe, expect, it } from 'vitest'

import mtrSystemMap from '../../mtr-system-map.json'
import { MTR_STATIONS } from '../data/mtr-stations'
import type { MapLine } from './types'

/**
 * Build-time validation for MTR System Map data
 * Ensures all stations referenced in the schematic map exist in MTR_STATIONS
 */
describe('MTR System Map Validation', () => {
  const allStationsInData = new Set<string>()

  // Helper to normalize station names for comparison
  const normalizeName = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, '')

  // Collect all unique station names from the map
  mtrSystemMap.lines.forEach((line: MapLine) => {
    // Add stations from simple lines
    if (line.stations) {
      line.stations.forEach((station) => allStationsInData.add(station))
    }

    // Add stations from trunk
    if (line.trunk) {
      line.trunk.forEach((station) => allStationsInData.add(station))
    }

    // Add stations from branches
    const collectFromBranch = (branch: { sequence?: string[]; branches?: Array<{ sequence?: string[] }> }) => {
      if (branch.sequence) {
        branch.sequence.forEach((station) => allStationsInData.add(station))
      }
      if (branch.branches) {
        branch.branches.forEach(collectFromBranch)
      }
    }

    if (line.branches) {
      line.branches.forEach(collectFromBranch)
    }
  })

  // Build lookup map from MTR_STATIONS
  const stationLookup = new Map<string, string>()
  MTR_STATIONS.forEach((station) => {
    stationLookup.set(normalizeName(station.nameEn), station.nameEn)
    stationLookup.set(normalizeName(station.nameTc), station.nameEn)
    // Also add the station code
    stationLookup.set(normalizeName(station.sta), station.nameEn)
  })

  it('all stations in mtr-system-map.json should exist in MTR_STATIONS', () => {
    const missing: string[] = []

    allStationsInData.forEach((stationName) => {
      const normalized = normalizeName(stationName)
      if (!stationLookup.has(normalized)) {
        missing.push(stationName)
      }
    })

    if (missing.length > 0) {
      console.error('Missing stations:', missing)
    }

    expect(missing).toEqual([])
  })

  it('should have no duplicate line IDs in the system map', () => {
    const lineIds = mtrSystemMap.lines.map((line: MapLine) => line.id)
    const uniqueIds = new Set(lineIds)
    expect(uniqueIds.size).toBe(lineIds.length)
  })

  it('should have valid line structures', () => {
    mtrSystemMap.lines.forEach((line: MapLine) => {
      // Every line should have id, name, and color
      expect(line.id).toBeDefined()
      expect(line.name).toBeDefined()
      expect(line.color).toBeDefined()

      // A line should have at least one of: stations, trunk, or branches
      const hasContent =
        (line.stations && line.stations.length > 0) ||
        (line.trunk && line.trunk.length > 0) ||
        (line.branches && line.branches.length > 0)

      expect(hasContent).toBe(true)
    })
  })
})
