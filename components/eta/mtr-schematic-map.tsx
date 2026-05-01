'use client'

import * as React from 'react'

import mtrSystemMap from '@/mtr-system-map.json'
import { MTR_STATIONS } from '@/lib/data/mtr-stations'
import type { LineSequence, MapBranch, MapLine, UiLanguage } from '@/lib/eta/types'
import { cn } from '@/lib/utils'

// Type guard for MapLine array from JSON
function isMapLineArray(data: unknown): data is MapLine[] {
  if (!Array.isArray(data)) return false
  return data.every(
    (item) =>
      typeof item === 'object' &&
      item !== null &&
      typeof (item as MapLine).id === 'string' &&
      typeof (item as MapLine).name === 'string' &&
      typeof (item as MapLine).color === 'string'
  )
}

type Props = {
  lang: UiLanguage
  selectedSta?: string
  onSelectSta: (sta: string) => void
}

const stationSpacing = 60
const lineGap = 72
const margin = 28
const labelWidth = 120

/**
 * Normalizes a station name for lookup by converting to lowercase and removing special characters.
 * @param value - The station name to normalize
 * @returns Normalized string suitable for Map key comparison
 */
const normalizeStationKey = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '')

/**
 * Cleans a station label by removing parenthetical content and normalizing whitespace.
 * @param value - The station name/label to clean
 * @returns Cleaned label string
 */
const cleanStationLabel = (value: string) => value.replace(/\s*\(.*?\)\s*/g, ' ').replace(/\s+/g, ' ').trim()

/**
 * Builds a flat array of line sequences from the hierarchical map data.
 * Handles simple lines (with stations array) and branched lines (with trunk and branches).
 * @param lines - Array of MapLine objects from the system map
 * @returns Array of LineSequence objects for rendering
 */
const buildLineSequences = (lines: MapLine[]): LineSequence[] => {
  const sequences: LineSequence[] = []

  lines.forEach((line) => {
    if (line.stations?.length) {
      sequences.push({
        key: line.id,
        id: line.id,
        name: line.name,
        color: line.color,
        stations: line.stations,
      })
      return
    }

    const trunk = line.trunk ?? []
    if (!line.branches?.length) {
      if (trunk.length) {
        sequences.push({
          key: line.id,
          id: line.id,
          name: line.name,
          color: line.color,
          stations: trunk,
        })
      }
      return
    }

    line.branches.forEach((branch: MapBranch, branchIndex: number) => {
      if (branch.sequence?.length) {
        sequences.push({
          key: `${line.id}-${branch.id ?? branchIndex}`,
          id: line.id,
          name: line.name,
          color: line.color,
          stations: [...trunk, ...branch.sequence],
        })
      }

      if (branch.branches?.length) {
        branch.branches.forEach((nested: MapBranch, nestedIndex: number) => {
          // For nested branches, we extend from the trunk only (branch.from is already the last station of trunk)
          sequences.push({
            key: `${line.id}-${branch.id ?? branchIndex}-${nested.id ?? nestedIndex}`,
            id: line.id,
            name: line.name,
            color: line.color,
            stations: [...trunk, ...(nested.sequence ?? [])],
          })
        })
      }
    })
  })

  return sequences.filter((sequence) => sequence.stations.length > 0)
}

/**
 * MTR Schematic Map component - displays an interactive SVG schematic of the MTR system.
 * @param props - Component props
 * @param props.lang - UI language (en, tc, or sc)
 * @param props.selectedSta - Currently selected station code
 * @param props.onSelectSta - Callback when a station is selected
 * @returns React component
 */
export function MtrSchematicMap({ lang, selectedSta, onSelectSta }: Props) {
  const stationByName = React.useMemo(() => {
    const map = new Map<string, (typeof MTR_STATIONS)[number]>()
    MTR_STATIONS.forEach((station) => {
      map.set(normalizeStationKey(station.nameEn), station)
      map.set(normalizeStationKey(station.nameTc), station)
      map.set(normalizeStationKey(cleanStationLabel(station.nameEn)), station)
      map.set(normalizeStationKey(cleanStationLabel(station.nameTc)), station)
      map.set(normalizeStationKey(station.sta), station)
    })
    return map
  }, [])

  const sequences = React.useMemo(() => {
    if (!isMapLineArray(mtrSystemMap.lines)) {
      console.error('Invalid MTR system map data')
      return []
    }
    return buildLineSequences(mtrSystemMap.lines)
  }, [])

  const maxStations = sequences.reduce((max, sequence) => Math.max(max, sequence.stations.length), 0)
  const width = Math.max(680, labelWidth + margin * 2 + Math.max(0, maxStations - 1) * stationSpacing)
  const height = Math.max(320, margin * 2 + sequences.length * lineGap)
  const yStart = margin + 8
  const xStart = margin + labelWidth

  // Helper to get station name based on language
  // Falls back to Traditional Chinese (tc) for Simplified Chinese (sc) if nameSc is not defined
  const getStationName = (station: (typeof MTR_STATIONS)[number]): string => {
    if (lang === 'en') return station.nameEn
    if (lang === 'sc') return station.nameSc ?? station.nameTc
    return station.nameTc
  }

  return (
    <div className="rounded-3xl border bg-card/60 p-4 shadow-sm">
      <div className="text-sm font-semibold">{lang === 'en' ? 'MTR schematic' : '港鐵路線圖'}</div>
      <div className="mt-3 overflow-x-auto">
        <svg
          className="h-auto w-full min-w-[680px]"
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label={lang === 'en' ? 'MTR schematic map' : '港鐵路線圖'}
        >
          {sequences.map((sequence, index) => {
            const y = yStart + index * lineGap
            const endX = xStart + (sequence.stations.length - 1) * stationSpacing

            const labelY = y + 16

            return (
              <g key={sequence.key}>
                <text x={margin} y={y + 4} fill="currentColor" className="text-xs font-semibold">
                  {sequence.id}
                </text>
                <line x1={xStart} y1={y} x2={endX} y2={y} stroke={sequence.color} strokeWidth={6} />

                {sequence.stations.map((stationName: string, stationIndex: number) => {
                  const normalizedName = normalizeStationKey(cleanStationLabel(stationName))
                  const station = stationByName.get(normalizedName)
                  const x = xStart + stationIndex * stationSpacing
                  const isSelected = station?.sta === selectedSta
                  const label = station ? getStationName(station) : cleanStationLabel(stationName)
                  const isClickable = Boolean(station)

                  const handleSelect = () => {
                    if (station) {
                      onSelectSta(station.sta)
                    }
                  }

                  const handleKeyDown: React.KeyboardEventHandler<SVGGElement> = (event) => {
                    if (!station) return
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      onSelectSta(station.sta)
                    }
                  }

                  return (
                    <g
                      key={`${sequence.key}-${stationName}-${stationIndex}`}
                      className={cn('transition-opacity', isClickable ? 'cursor-pointer' : 'opacity-50')}
                      role={isClickable ? 'button' : undefined}
                      tabIndex={isClickable ? 0 : -1}
                      aria-disabled={!isClickable}
                      onClick={handleSelect}
                      onKeyDown={handleKeyDown}
                    >
                      <circle
                        cx={x}
                        cy={y}
                        r={isSelected ? 7 : 6}
                        fill={isSelected ? sequence.color : 'hsl(var(--card))'}
                        stroke={sequence.color}
                        strokeWidth={2}
                      />
                      <text
                        x={x}
                        y={labelY}
                        textAnchor="middle"
                        fill="currentColor"
                        className={cn(
                          'text-[10px] opacity-80',
                          isSelected ? 'font-semibold' : 'font-normal'
                        )}
                      >
                        {label}
                      </text>
                    </g>
                  )
                })}
              </g>
            )
          })}
        </svg>
      </div>
    </div>
  )
}
