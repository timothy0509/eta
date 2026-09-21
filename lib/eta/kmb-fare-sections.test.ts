import { describe, expect, it } from 'vitest'

import { getFaresBySeq, groupIntoFareSections } from './kmb-fare-sections'

describe('getFaresBySeq', () => {
  it('maps 1-indexed sequences from array fares', () => {
    expect(getFaresBySeq({ fares: ['10.5', '8.0', '5.2'] }, 'kmb')).toEqual({
      1: 10.5,
      2: 8,
      3: 5.2,
    })
  })

  it('reads per-company fares from object fares', () => {
    expect(getFaresBySeq({ fares: { kmb: ['7.1'] } }, 'kmb')).toEqual({ 1: 7.1 })
  })

  it('skips unusable entries', () => {
    expect(getFaresBySeq({ fares: ['9.0', '', 'abc', '-1'] }, 'kmb')).toEqual({ 1: 9 })
  })

  it('returns empty when fares are missing', () => {
    expect(getFaresBySeq({ fares: null }, 'kmb')).toEqual({})
  })
})

describe('groupIntoFareSections', () => {
  it('groups consecutive stops with the same fare', () => {
    const sections = groupIntoFareSections(['a', 'b', 'c'], (item) => (item === 'c' ? 5 : 10))
    expect(sections).toEqual([
      { fare: 10, items: ['a', 'b'] },
      { fare: 5, items: ['c'] },
    ])
  })

  it('keeps unknown fares in their own section', () => {
    const sections = groupIntoFareSections(['a', 'b'], () => null)
    expect(sections).toEqual([{ fare: null, items: ['a', 'b'] }])
  })
})
