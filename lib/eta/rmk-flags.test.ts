import { describe, expect, it } from 'vitest'
import { parseRmkFlags } from './rmk-flags'

describe('parseRmkFlags scheduled', () => {
  it('detects scheduled bus in English', () => {
    expect(parseRmkFlags(undefined, undefined, 'Scheduled Bus')).toEqual({
      scheduled: true,
      wheelchair: false,
    })
  })

  it('matches case-insensitively with surrounding whitespace', () => {
    expect(parseRmkFlags(undefined, undefined, '  scheduled bus  ').scheduled).toBe(true)
  })

  it('detects scheduled marker in Traditional Chinese', () => {
    expect(parseRmkFlags('原定班次', undefined, undefined).scheduled).toBe(true)
  })

  it('detects scheduled marker in Simplified Chinese', () => {
    expect(parseRmkFlags(undefined, '原定班次', undefined).scheduled).toBe(true)
  })

  it('returns scheduled false for empty or unrelated remarks', () => {
    expect(parseRmkFlags('', '', '').scheduled).toBe(false)
    expect(parseRmkFlags('尾班車', '尾班车', 'Last Bus').scheduled).toBe(false)
  })

  it('returns scheduled false when all remarks are missing', () => {
    expect(parseRmkFlags()).toEqual({ scheduled: false, wheelchair: false })
  })
})

describe('parseRmkFlags wheelchair', () => {
  it('detects wheelchair keyword in English', () => {
    expect(parseRmkFlags(undefined, undefined, 'Wheelchair accessible bus').wheelchair).toBe(true)
  })

  it('detects wheelchair keyword in Traditional Chinese', () => {
    expect(parseRmkFlags('此班次為輪椅可用的巴士', undefined, undefined).wheelchair).toBe(true)
  })

  it('detects low-floor keywords', () => {
    expect(parseRmkFlags('低地台巴士', undefined, undefined).wheelchair).toBe(true)
    expect(parseRmkFlags(undefined, undefined, 'Low-floor bus').wheelchair).toBe(true)
  })

  it('returns wheelchair false for unrelated remarks', () => {
    expect(parseRmkFlags('原定班次', '原定班次', 'Scheduled Bus').wheelchair).toBe(false)
  })
})
