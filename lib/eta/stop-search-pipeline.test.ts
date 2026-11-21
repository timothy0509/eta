import { describe, expect, it } from 'vitest'

import {
  areCodesSequential,
  createStopSearchSession,
  formatCodeRange,
  groupStopsByName,
  searchStopGroups,
  type StopSearchDoc,
} from '@/lib/eta/stop-search-pipeline'
import type { KmbStopSearchItem } from '@/lib/eta/types'

function stop(stopId: string, nameEn: string, nameTc: string): KmbStopSearchItem {
  return { stopId, nameEn, nameTc, nameSc: nameTc, lat: 22.3, lng: 114.2, isKmb: true }
}

function doc(
  stopId: string,
  nameEn: string,
  nameTc: string,
  stopCode: string | null
): StopSearchDoc {
  const baseName = nameEn
  return {
    stopId,
    baseName,
    stopCode,
    displaySecondary: nameTc,
    displayName: baseName,
    searchName: baseName.toLowerCase(),
    searchSecondary: nameTc.toLowerCase(),
    searchCode: (stopCode ?? '').toLowerCase(),
    normalized: `${nameEn}|${nameTc}|${nameTc}|${baseName}|${stopCode ?? ''}`.toLowerCase().trim(),
    stop: stop(stopId, nameEn, nameTc),
  }
}

const yauTong = [
  doc('YT1', 'Yau Tong Bus Terminus', '油塘巴士總站', 'YT001'),
  doc('YT2', 'Yau Tong Bus Terminus', '油塘巴士總站', 'YT002'),
  doc('YT3', 'Yau Tong Bus Terminus', '油塘巴士總站', 'YT003'),
]

const wanTauTong = [doc('WTT1', 'Wan Tau Tong Bus Terminus', '運頭塘巴士總站', 'WT001')]

const central = [doc('CE1', 'Central Exchange Square', '中環交易廣場', 'CE001')]

const FIXTURE = [...yauTong, ...wanTauTong, ...central]

function groupIds(groups: ReturnType<typeof searchStopGroups>): string[] {
  return groups.map((g) => g.id)
}

describe('searchStopGroups', () => {
  it('returns the default grouped list for an empty query', () => {
    const groups = searchStopGroups(FIXTURE, null, '   ')
    expect(groups).toHaveLength(3)
    expect(groups[0]?.displayName).toBe('Yau Tong Bus Terminus')
  })

  it('ranks exact code matches first', async () => {
    const session = await createStopSearchSession(FIXTURE)
    const groups = session.search('yt002')
    // YT2 wins scoring, then sequential-code grouping merges the YT rows.
    expect(groups[0]?.id).toBe('group:YT1,YT2,YT3')
    expect(groups[0]?.stops.map((s) => s.stopId)).toContain('YT2')
  })

  it('keeps the reported query results, including the fuzzy bonus row', async () => {
    const session = await createStopSearchSession(FIXTURE)
    const ids = groupIds(session.search('yau tong bus terminus'))
    // Exact-name groups first, the Wan Tau Tong fuzzy match kept after them.
    expect(ids[0]).toMatch(/^group:YT/)
    expect(ids).toContain('stop:WTT1')
  })

  it('matches the no-fuse branch once the prefix page is full', async () => {
    const many = Array.from({ length: 25 }, (_, i) =>
      doc(`AB${i}`, `Abc Stop Number ${i}`, `ABC車站${i}`, `AB${String(i).padStart(3, '0')}`)
    )
    const session = await createStopSearchSession(many)
    const withFuse = groupIds(session.search('abc'))
    const withoutFuse = groupIds(searchStopGroups(many, null, 'abc'))
    expect(withFuse).toEqual(withoutFuse)
    expect(withFuse).toHaveLength(20)
  })

  it('caps scored rows at 60 before grouping', async () => {
    const many = Array.from({ length: 100 }, (_, i) =>
      doc(`S${i}`, `Terminus Stop ${i}`, `總站${i}`, null)
    )
    const session = await createStopSearchSession(many)
    const groups = session.search('terminus')
    expect(groups.length).toBeLessThanOrEqual(20)
  })
})

describe('groupStopsByName', () => {
  it('merges sequential codes into one range group', () => {
    const groups = groupStopsByName(yauTong)
    expect(groups).toHaveLength(1)
    expect(groups[0]?.displayCodes).toBe('(YT001-YT003)')
    expect(groups[0]?.id).toBe('group:YT1,YT2,YT3')
  })

  it('keeps non-sequential codes as individual rows', () => {
    const groups = groupStopsByName([
      doc('A', 'Some Stop', '某站', 'KT313'),
      doc('B', 'Some Stop', '某站', 'KT681'),
    ])
    expect(groups).toHaveLength(2)
  })

  it('keeps codeless stops as individual rows', () => {
    const groups = groupStopsByName([doc('C', 'Codeless Stop', '無碼站', null)])
    expect(groups[0]?.displayCodes).toBe('')
  })
})

describe('code helpers', () => {
  it('detects sequential ranges', () => {
    expect(areCodesSequential(['KT313', 'KT314', 'KT316'])).toBe(false)
    expect(areCodesSequential(['KT313', 'KT314', 'KT315'])).toBe(true)
    expect(formatCodeRange(['KT313', 'KT314', 'KT315', 'KT316'])).toBe('KT313-KT316')
  })
})
