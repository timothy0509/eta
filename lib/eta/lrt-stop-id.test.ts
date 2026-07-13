import { describe, expect, it } from 'vitest'

import { lrtStopIdsEqual, lrtStopIdToStationId, stationIdToLrtStopId } from './lrt-stop-id'

describe('lrtStopIdToStationId', () => {
  it('converts LR-prefixed stop IDs to numeric station IDs', () => {
    expect(lrtStopIdToStationId('LR1')).toBe('1')
    expect(lrtStopIdToStationId('LR10')).toBe('10')
    expect(lrtStopIdToStationId('LR100')).toBe('100')
  })

  it('strips leading zeros from LR-prefixed IDs', () => {
    expect(lrtStopIdToStationId('LR010')).toBe('10')
    expect(lrtStopIdToStationId('LR001')).toBe('1')
  })

  it('returns null for invalid input', () => {
    expect(lrtStopIdToStationId('')).toBeNull()
    expect(lrtStopIdToStationId('KMB123')).toBeNull()
    expect(lrtStopIdToStationId('LRabc')).toBeNull()
  })
})

describe('stationIdToLrtStopId', () => {
  it('converts numeric station IDs to canonical LR stop IDs', () => {
    expect(stationIdToLrtStopId('1')).toBe('LR1')
    expect(stationIdToLrtStopId('10')).toBe('LR10')
    expect(stationIdToLrtStopId('100')).toBe('LR100')
  })

  it('does not zero-pad station IDs', () => {
    expect(stationIdToLrtStopId('1')).not.toBe('LR001')
    expect(stationIdToLrtStopId('10')).not.toBe('LR010')
  })

  it('accepts LR-prefixed input', () => {
    expect(stationIdToLrtStopId('LR10')).toBe('LR10')
    expect(stationIdToLrtStopId('LR010')).toBe('LR10')
  })

  it('returns null for invalid input', () => {
    expect(stationIdToLrtStopId('')).toBeNull()
    expect(stationIdToLrtStopId('abc')).toBeNull()
  })
})

describe('lrtStopIdsEqual', () => {
  it('treats padded and unpadded forms as equal', () => {
    expect(lrtStopIdsEqual('10', 'LR10')).toBe(true)
    expect(lrtStopIdsEqual('LR010', 'LR10')).toBe(true)
    expect(lrtStopIdsEqual('1', 'LR001')).toBe(true)
    expect(lrtStopIdsEqual('100', 'LR100')).toBe(true)
  })

  it('returns false for different stops', () => {
    expect(lrtStopIdsEqual('10', 'LR1')).toBe(false)
    expect(lrtStopIdsEqual('LR10', 'LR100')).toBe(false)
  })

  it('returns false for invalid input', () => {
    expect(lrtStopIdsEqual('', 'LR10')).toBe(false)
    expect(lrtStopIdsEqual('abc', 'LR10')).toBe(false)
  })
})
