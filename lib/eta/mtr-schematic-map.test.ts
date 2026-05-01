import { describe, expect, it } from 'vitest'

import type { LineSequence, MapBranch, MapLine } from './types'

// Re-implement the functions from the component for testing
const normalizeStationKey = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '')

const cleanStationLabel = (value: string) => value.replace(/\s*\(.*?\)\s*/g, ' ').replace(/\s+/g, ' ').trim()

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

describe('normalizeStationKey', () => {
  it('converts to lowercase', () => {
    expect(normalizeStationKey('Central')).toBe('central')
  })

  it('removes special characters', () => {
    expect(normalizeStationKey('Mong Kok East')).toBe('mongkokeast')
    expect(normalizeStationKey('Tiu Keng Leng')).toBe('tiukengleng')
  })

  it('removes hyphens and parentheses', () => {
    expect(normalizeStationKey('AsiaWorld-Expo')).toBe('asiaworldexpo')
    expect(normalizeStationKey('Kowloon (South)')).toBe('kowloonsouth')
  })

  it('handles empty strings', () => {
    expect(normalizeStationKey('')).toBe('')
  })
})

describe('cleanStationLabel', () => {
  it('removes parentheses and their content', () => {
    expect(cleanStationLabel('Racecourse (bypass)')).toBe('Racecourse')
    expect(cleanStationLabel('Kowloon (South)')).toBe('Kowloon')
  })

  it('normalizes whitespace', () => {
    expect(cleanStationLabel('Hello   World')).toBe('Hello World')
    expect(cleanStationLabel('  Trimmed  ')).toBe('Trimmed')
  })

  it('handles empty strings', () => {
    expect(cleanStationLabel('')).toBe('')
  })

  it('handles strings without parentheses', () => {
    expect(cleanStationLabel('Central')).toBe('Central')
  })
})

describe('buildLineSequences', () => {
  it('handles simple line with stations array', () => {
    const lines: MapLine[] = [
      {
        id: 'TEST',
        name: 'Test Line',
        color: '#FF0000',
        stations: ['Station A', 'Station B', 'Station C'],
      },
    ]

    const result = buildLineSequences(lines)
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      key: 'TEST',
      id: 'TEST',
      name: 'Test Line',
      color: '#FF0000',
      stations: ['Station A', 'Station B', 'Station C'],
    })
  })

  it('handles line with trunk only', () => {
    const lines: MapLine[] = [
      {
        id: 'TRUNK',
        name: 'Trunk Line',
        color: '#00FF00',
        trunk: ['A', 'B', 'C'],
      },
    ]

    const result = buildLineSequences(lines)
    expect(result).toHaveLength(1)
    expect(result[0].stations).toEqual(['A', 'B', 'C'])
  })

  it('handles line with trunk and branches', () => {
    const lines: MapLine[] = [
      {
        id: 'BRANCHED',
        name: 'Branched Line',
        color: '#0000FF',
        trunk: ['A', 'B'],
        branches: [
          {
            id: 'BRANCH1',
            from: 'B',
            sequence: ['C', 'D'],
          },
          {
            id: 'BRANCH2',
            from: 'B',
            sequence: ['E'],
          },
        ],
      },
    ]

    const result = buildLineSequences(lines)
    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({
      key: 'BRANCHED-BRANCH1',
      id: 'BRANCHED',
      name: 'Branched Line',
      color: '#0000FF',
      stations: ['A', 'B', 'C', 'D'],
    })
    expect(result[1]).toEqual({
      key: 'BRANCHED-BRANCH2',
      id: 'BRANCHED',
      name: 'Branched Line',
      color: '#0000FF',
      stations: ['A', 'B', 'E'],
    })
  })

  it('handles nested branches', () => {
    const lines: MapLine[] = [
      {
        id: 'NESTED',
        name: 'Nested Line',
        color: '#FFFF00',
        trunk: ['A', 'B'],
        branches: [
          {
            id: 'SPLIT',
            from: 'B',
            branches: [
              {
                id: 'LEFT',
                sequence: ['C'],
              },
              {
                id: 'RIGHT',
                sequence: ['D'],
              },
            ],
          },
        ],
      },
    ]

    const result = buildLineSequences(lines)
    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({
      key: 'NESTED-SPLIT-LEFT',
      id: 'NESTED',
      name: 'Nested Line',
      color: '#FFFF00',
      stations: ['A', 'B', 'C'],
    })
    expect(result[1]).toEqual({
      key: 'NESTED-SPLIT-RIGHT',
      id: 'NESTED',
      name: 'Nested Line',
      color: '#FFFF00',
      stations: ['A', 'B', 'D'],
    })
  })

  it('filters out empty sequences', () => {
    const lines: MapLine[] = [
      {
        id: 'EMPTY',
        name: 'Empty Line',
        color: '#000000',
        trunk: [],
      },
    ]

    const result = buildLineSequences(lines)
    expect(result).toHaveLength(0)
  })

  it('handles branch without sequence but with nested branches', () => {
    const lines: MapLine[] = [
      {
        id: 'NOSEQ',
        name: 'No Seq Line',
        color: '#CCCCCC',
        trunk: ['A'],
        branches: [
          {
            from: 'A',
            branches: [
              {
                sequence: ['B'],
              },
            ],
          },
        ],
      },
    ]

    const result = buildLineSequences(lines)
    expect(result).toHaveLength(1)
    expect(result[0].stations).toEqual(['A', 'B'])
  })

  it('uses index as fallback for missing branch IDs', () => {
    const lines: MapLine[] = [
      {
        id: 'NOID',
        name: 'No ID Line',
        color: '#123456',
        trunk: ['A'],
        branches: [
          {
            sequence: ['B'],
          },
          {
            sequence: ['C'],
          },
        ],
      },
    ]

    const result = buildLineSequences(lines)
    expect(result).toHaveLength(2)
    expect(result[0].key).toBe('NOID-0')
    expect(result[1].key).toBe('NOID-1')
  })
})
