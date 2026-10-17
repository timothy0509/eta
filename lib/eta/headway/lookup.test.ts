import { beforeEach, describe, expect, it } from 'vitest'

import {
  activeHeadwayIndex,
  getDayType,
  getScheduleForVariant,
  resolveVariantKey,
  scheduleForStop,
  specialsForDay,
} from './lookup'
import type { HeadwayIndex, HeadwayWindow, VariantSchedule } from './types'

const HOLIDAYS = ['2026-02-17']

/** KMB route 1 weekday sample: 05:35-07:05 @9min, 07:05-09:00 @6min, rest @12min. */
const INDEX: HeadwayIndex = {
  updated: '2026-10-16',
  holidays: HOLIDAYS,
  variants: {
    'kmb|1|O|1': {
      src: ['1001'],
      span: {
        weekday: ['0535', '2305'],
        saturday: ['0545', '2300'],
        holiday: ['0600', '2230'],
      },
      headway: {
        weekday: [
          [335, 425, 9],
          [425, 540, 6],
          [540, 1385, 12],
        ],
        saturday: [[345, 1380, 15]],
        holiday: [[360, 1350, 20]],
      },
    },
    'kmb|N1|O|1': {
      src: ['2001'],
      span: { weekday: ['2320', '0150'] },
      headway: { weekday: [[1400, 110, 25]] },
    },
    'kmb|SINGLE|O|1': {
      src: ['3001'],
      span: { weekday: ['0600', '2200'] },
      headway: { weekday: [[360, 1320, 10]] },
    },
    'ctb|102P|O|1': {
      src: ['1000007'],
      span: { weekday: ['0739', '0835'] },
    },
  },
}

function date(iso: string): Date {
  return new Date(iso)
}

describe('activeHeadwayIndex', () => {
  const WEEKDAY_WINDOWS: HeadwayWindow[] = [
    [335, 425, 9],
    [425, 540, 6],
    [540, 1385, 12],
  ]

  it('returns the index of the window containing mins', () => {
    expect(activeHeadwayIndex(WEEKDAY_WINDOWS, 350)).toBe(0)
    expect(activeHeadwayIndex(WEEKDAY_WINDOWS, 539)).toBe(1)
    expect(activeHeadwayIndex(WEEKDAY_WINDOWS, 1384)).toBe(2)
  })

  it('treats window end as exclusive', () => {
    // 425 ends window 0 and starts window 1.
    expect(activeHeadwayIndex(WEEKDAY_WINDOWS, 425)).toBe(1)
  })

  it('returns null outside every window', () => {
    expect(activeHeadwayIndex(WEEKDAY_WINDOWS, 334)).toBeNull()
    expect(activeHeadwayIndex(WEEKDAY_WINDOWS, 1385)).toBeNull()
  })

  it('matches overnight windows on both sides of midnight', () => {
    const overnight: HeadwayWindow[] = [[1400, 110, 25]]
    expect(activeHeadwayIndex(overnight, 1450)).toBe(0)
    expect(activeHeadwayIndex(overnight, 30)).toBe(0)
    expect(activeHeadwayIndex(overnight, 110)).toBeNull()
  })
})

describe('getDayType', () => {
  it('classifies Mon-Fri as weekday', () => {
    expect(getDayType(date('2026-10-16T12:00:00'), [])).toBe('weekday') // Friday
    expect(getDayType(date('2026-10-19T12:00:00'), [])).toBe('weekday') // Monday
  })

  it('classifies Saturday and Sunday', () => {
    expect(getDayType(date('2026-10-17T12:00:00'), [])).toBe('saturday')
    expect(getDayType(date('2026-10-18T12:00:00'), [])).toBe('sunday')
  })

  it('lets a holiday-list match win over the weekday', () => {
    // 2026-02-17 is a Tuesday (Lunar New Year).
    expect(getDayType(date('2026-02-17T12:00:00'), HOLIDAYS)).toBe('holiday')
  })

  it('lets a holiday-list match win over the weekend', () => {
    expect(getDayType(date('2026-10-17T12:00:00'), ['2026-10-17'])).toBe('holiday')
  })
})

describe('resolveVariantKey', () => {
  it('hits exact keys', () => {
    expect(resolveVariantKey(INDEX.variants, 'kmb|1|O|1')).toBe('kmb|1|O|1')
  })

  it('falls back to serviceType "1"', () => {
    expect(resolveVariantKey(INDEX.variants, 'kmb|1|O|3')).toBe('kmb|1|O|1')
  })

  it('returns null when neither exact nor serviceType 1 exists', () => {
    expect(resolveVariantKey(INDEX.variants, 'kmb|999|O|1')).toBeNull()
    expect(resolveVariantKey(INDEX.variants, 'kmb|999|O|3')).toBeNull()
  })

  it('returns null for malformed keys', () => {
    expect(resolveVariantKey(INDEX.variants, 'kmb|1|O')).toBeNull()
    expect(resolveVariantKey(INDEX.variants, '')).toBeNull()
  })
})

describe('getScheduleForVariant', () => {
  it('returns the active window headway on a weekday morning', () => {
    const result = getScheduleForVariant(INDEX, 'kmb|1|O|1', date('2026-10-16T06:00:00'))
    expect(result).toMatchObject({
      headwayMin: 9,
      headwayRange: [6, 12],
      first: '05:35',
      last: '23:05',
      isHolidayTimetable: false,
      serviceKey: 'kmb|1|O|1',
    })
  })

  it('treats window end as exclusive (now == end -> next window)', () => {
    // 07:05 is the end of the 9-min window and the start of the 6-min one.
    const result = getScheduleForVariant(INDEX, 'kmb|1|O|1', date('2026-10-16T07:05:00'))
    expect(result?.headwayMin).toBe(6)
  })

  it('treats window start as inclusive', () => {
    const result = getScheduleForVariant(INDEX, 'kmb|1|O|1', date('2026-10-16T05:35:00'))
    expect(result?.headwayMin).toBe(9)
  })

  it('returns null headwayMin outside all windows but keeps span info', () => {
    const result = getScheduleForVariant(INDEX, 'kmb|1|O|1', date('2026-10-16T04:00:00'))
    expect(result).toMatchObject({
      headwayMin: null,
      first: '05:35',
      last: '23:05',
      serviceKey: 'kmb|1|O|1',
    })
  })

  it('resolves serviceType fallback and reports the resolved key', () => {
    const result = getScheduleForVariant(INDEX, 'kmb|1|O|7', date('2026-10-16T10:00:00'))
    expect(result?.serviceKey).toBe('kmb|1|O|1')
    expect(result?.headwayMin).toBe(12)
  })

  it('falls back to the weekday table when the day-type table is missing', () => {
    // Sunday has no table in the fixture -> weekday table.
    const result = getScheduleForVariant(INDEX, 'kmb|1|O|1', date('2026-10-18T10:00:00'))
    expect(result?.headwayMin).toBe(12)
    expect(result?.isHolidayTimetable).toBe(false)
  })

  it('uses the saturday table when present', () => {
    const result = getScheduleForVariant(INDEX, 'kmb|1|O|1', date('2026-10-17T10:00:00'))
    expect(result).toMatchObject({
      headwayMin: 15,
      headwayRange: null,
      first: '05:45',
      last: '23:00',
    })
  })

  it('uses the holiday table on a listed holiday', () => {
    const result = getScheduleForVariant(INDEX, 'kmb|1|O|1', date('2026-02-17T10:00:00'))
    expect(result).toMatchObject({
      headwayMin: 20,
      first: '06:00',
      last: '22:30',
      isHolidayTimetable: true,
      serviceKey: 'kmb|1|O|1',
    })
  })

  it('matches overnight spans on both sides of midnight', () => {
    // Window [1400, 110): 23:20 -> 01:50 next day.
    const late = getScheduleForVariant(INDEX, 'kmb|N1|O|1', date('2026-10-16T23:30:00'))
    expect(late?.headwayMin).toBe(25)
    const early = getScheduleForVariant(INDEX, 'kmb|N1|O|1', date('2026-10-16T01:00:00'))
    expect(early?.headwayMin).toBe(25)
    const outside = getScheduleForVariant(INDEX, 'kmb|N1|O|1', date('2026-10-16T02:00:00'))
    expect(outside?.headwayMin).toBeNull()
  })

  it('returns null headwayRange for a single distinct headway', () => {
    const result = getScheduleForVariant(INDEX, 'kmb|SINGLE|O|1', date('2026-10-16T10:00:00'))
    expect(result).toMatchObject({ headwayMin: 10, headwayRange: null })
  })

  it('returns null for a missing variant', () => {
    expect(getScheduleForVariant(INDEX, 'kmb|999|O|1', date('2026-10-16T10:00:00'))).toBeNull()
  })

  it('returns span-only fallback when the entry has no headway tables', () => {
    const result = getScheduleForVariant(INDEX, 'ctb|102P|O|1', date('2026-10-16T10:00:00'))
    expect(result).toMatchObject({
      headwayMin: null,
      headwayRange: null,
      first: '07:39',
      last: '08:35',
      isHolidayTimetable: false,
      serviceKey: 'ctb|102P|O|1',
    })
  })

  it('returns fixed departures for span-only entries that carry them', () => {
    const withDeps: HeadwayIndex = {
      updated: '2026-10-16',
      holidays: HOLIDAYS,
      variants: {
        'kmb|14D|O|1': {
          src: ['8092'],
          span: { weekday: ['0645', '0710'] },
          departures: { weekday: [405, 410, 412, 418, 424, 430] },
        },
      },
    }
    const result = getScheduleForVariant(withDeps, 'kmb|14D|O|1', date('2026-10-16T10:00:00'))
    expect(result).toMatchObject({
      headwayMin: null,
      headwayRange: null,
      first: '06:45',
      last: '07:10',
      departures: [405, 410, 412, 418, 424, 430],
    })
  })

  it('returns null departures when the day-type table is missing', () => {
    const withDeps: HeadwayIndex = {
      updated: '2026-10-16',
      holidays: HOLIDAYS,
      variants: {
        'kmb|14D|O|1': {
          src: ['8092'],
          span: { weekday: ['0645', '0710'] },
          departures: { weekday: [405, 430] },
        },
      },
    }
    // Sunday has no departures table: no service to show, not weekday times.
    const result = getScheduleForVariant(withDeps, 'kmb|14D|O|1', date('2026-10-18T10:00:00'))
    expect(result).toBeNull()
  })

  it('keeps departures null for frequency-based variants', () => {
    const result = getScheduleForVariant(INDEX, 'kmb|1|O|1', date('2026-10-16T06:00:00'))
    expect(result?.departures).toBeNull()
  })

  it('resolves specials for days with frequency windows', () => {
    const mixed: HeadwayIndex = {
      updated: '2026-10-16',
      holidays: HOLIDAYS,
      variants: {
        'kmb|214|O|1': {
          src: ['8354', '8496'],
          span: { weekday: ['0520', '2330'] },
          headway: { weekday: [[320, 1410, 12]] },
          special: [
            {
              src: '8496',
              origin: 'PO TAT BUS TERMINUS',
              departures: { weekday: [405, 415] },
            },
          ],
        },
      },
    }
    const result = getScheduleForVariant(mixed, 'kmb|214|O|1', date('2026-10-16T10:00:00'))
    expect(result?.special).toEqual([{ origin: 'PO TAT BUS TERMINUS', departures: [405, 415] }])
    // Frequency data still resolves alongside specials.
    expect(result?.headwayMin).toBe(12)
  })

  it('returns null specials when the day has no special table', () => {
    const mixed: HeadwayIndex = {
      updated: '2026-10-16',
      holidays: HOLIDAYS,
      variants: {
        'kmb|214|O|1': {
          src: ['8354', '8496'],
          span: { weekday: ['0520', '2330'] },
          headway: { weekday: [[320, 1410, 12]] },
          special: [{ src: '8496', origin: 'PO TAT BUS TERMINUS', departures: { weekday: [405] } }],
        },
      },
    }
    // Sunday has no special table: no weekday fallback, so specials stay null
    // while the frequency table still resolves.
    const result = getScheduleForVariant(mixed, 'kmb|214|O|1', date('2026-10-18T10:00:00'))
    expect(result?.special).toBeNull()
    expect(result?.headwayMin).toBe(12)
  })

  it('returns null specials when no table covers the day', () => {
    const mixed: HeadwayIndex = {
      updated: '2026-10-16',
      holidays: HOLIDAYS,
      variants: {
        'kmb|214|O|1': {
          src: ['8354', '8496'],
          span: { weekday: ['0520', '2330'] },
          headway: { weekday: [[320, 1410, 12]] },
          special: [
            { src: '8496', origin: 'PO TAT BUS TERMINUS', departures: { saturday: [405] } },
          ],
        },
      },
    }
    const result = getScheduleForVariant(mixed, 'kmb|214|O|1', date('2026-10-18T10:00:00'))
    expect(result?.special).toBeNull()
  })
})

describe('specialsForDay', () => {
  it('returns null when the day-type table is missing (no weekday fallback)', () => {
    const schedule = {
      src: ['8496'],
      span: {},
      special: [{ src: '8496', origin: 'PO TAT', departures: { weekday: [405] } }],
    }
    expect(specialsForDay(schedule, 'saturday')).toBeNull()
  })

  it('returns null when no entry covers the day', () => {
    const schedule = {
      src: ['8496'],
      span: {},
      special: [{ src: '8496', origin: 'PO TAT', departures: { saturday: [405] } }],
    }
    expect(specialsForDay(schedule, 'weekday')).toBeNull()
    expect(specialsForDay(schedule, 'sunday')).toBeNull()
  })

  it('returns null without a special table', () => {
    expect(specialsForDay({ src: ['x'], span: {} }, 'weekday')).toBeNull()
  })

  it('keeps only entries from the serving routes when asked', () => {
    const schedule: VariantSchedule = {
      src: ['8354', '8496'],
      span: {},
      special: [
        { src: '8354', origin: 'YAU TONG', departures: { weekday: [400] } },
        { src: '8496', origin: 'PO TAT BUS TERMINUS', departures: { weekday: [405] } },
      ],
    }
    expect(specialsForDay(schedule, 'weekday', new Set(['8496']))).toEqual([
      { origin: 'PO TAT BUS TERMINUS', departures: [405] },
    ])
    expect(specialsForDay(schedule, 'weekday', new Set(['other']))).toBeNull()
  })
})

/** 214-style merged variant: 8354 runs frequencies, 8496 runs Po Tat specials. */
const COV_214: VariantSchedule = {
  src: ['8354', '8496'],
  span: { weekday: ['0520', '2330'] },
  headway: { weekday: [[320, 1410, 12]] },
  special: [{ src: '8496', origin: 'PO TAT BUS TERMINUS', departures: { weekday: [405, 415] } }],
  freqSrc: [0],
  stopCov: { POTAT: [1], YAUTONG: [0], SHARED: [0, 1] },
}

describe('scheduleForStop', () => {
  it('hides frequencies at a special-only stop and derives span from specials', () => {
    const resolved = scheduleForStop(COV_214, 'POTAT', 'weekday')
    expect(resolved.windows).toBeNull()
    expect(resolved.departures).toBeNull()
    expect(resolved.departureGroups).toEqual([
      { origin: 'PO TAT BUS TERMINUS', departures: [405, 415] },
    ])
    expect(resolved.specials).toBeNull()
    expect(resolved.span).toEqual(['0645', '0655'])
  })

  it('keeps the variant-level tables at fully covered and unknown stops', () => {
    for (const stopId of ['SHARED', 'SOMEWHERE-ELSE', null, undefined]) {
      const resolved = scheduleForStop(COV_214, stopId, 'weekday')
      expect(resolved.windows).toEqual([[320, 1410, 12]])
      expect(resolved.departures).toBeNull()
      expect(resolved.specials).toEqual([{ origin: 'PO TAT BUS TERMINUS', departures: [405, 415] }])
      expect(resolved.span).toEqual(['0520', '2330'])
    }
  })

  it('keeps frequencies but filters specials at a freq-served stop', () => {
    const resolved = scheduleForStop(COV_214, 'YAUTONG', 'weekday')
    expect(resolved.windows).toEqual([[320, 1410, 12]])
    expect(resolved.specials).toBeNull()
  })

  it('filters span-only departures to the serving routes', () => {
    const schedule: VariantSchedule = {
      src: ['8092', '8096'],
      span: { weekday: ['0645', '0710'] },
      departures: { weekday: [405, 410, 412, 418, 424, 430] },
      depBySrc: {
        '0': {
          origin: 'YAU TONG BUS TERMINUS',
          departures: { weekday: [405, 412, 418, 424, 430] },
        },
        '1': {
          origin: 'LAM TIN (KWONG TIN ESTATE) BUS TERMINUS',
          departures: { weekday: [410, 430] },
        },
      },
      stopCov: { STOP8096: [1] },
    }
    const resolved = scheduleForStop(schedule, 'STOP8096', 'weekday')
    expect(resolved.windows).toBeNull()
    expect(resolved.departures).toBeNull()
    expect(resolved.departureGroups).toEqual([
      { origin: 'LAM TIN (KWONG TIN ESTATE) BUS TERMINUS', departures: [410, 430] },
    ])
    expect(resolved.span).toEqual(['0650', '0710'])
  })

  it('splits span-only departures into per-pattern groups at route level', () => {
    const schedule: VariantSchedule = {
      src: ['1000492', '8311'],
      span: { weekday: ['0700', '1740'] },
      departures: { weekday: [420, 432, 444, 456, 1045, 1060] },
      depBySrc: {
        '0': { origin: 'LAM WAH STREET PLAYGROUND', departures: { weekday: [1045, 1060] } },
        '1': {
          origin: 'LUNG MUN OASIS BUS TERMINUS',
          departures: { weekday: [420, 432, 444, 456] },
        },
      },
      stopCov: { SOME_STOP: [1] },
    }
    const resolved = scheduleForStop(schedule, null, 'weekday')
    expect(resolved.windows).toBeNull()
    expect(resolved.departures).toBeNull()
    expect(resolved.departureGroups).toEqual([
      { origin: 'LAM WAH STREET PLAYGROUND', departures: [1045, 1060] },
      { origin: 'LUNG MUN OASIS BUS TERMINUS', departures: [420, 432, 444, 456] },
    ])
  })

  it('reports no service when no serving route runs that day', () => {
    const satOnly: VariantSchedule = {
      src: ['8354', '8496'],
      span: { weekday: ['0520', '2330'] },
      headway: { weekday: [[320, 1410, 12]] },
      special: [{ src: '8496', origin: 'PO TAT BUS TERMINUS', departures: { saturday: [405] } }],
      freqSrc: [0],
      stopCov: { POTAT: [1] },
    }
    const resolved = scheduleForStop(satOnly, 'POTAT', 'weekday')
    expect(resolved.windows).toBeNull()
    expect(resolved.departures).toBeNull()
    expect(resolved.span).toBeUndefined()
  })
})

describe('getScheduleForVariant with stopId', () => {
  const index: HeadwayIndex = { updated: '2026-10-16', holidays: HOLIDAYS, variants: {} }
  beforeEach(() => {
    index.variants['kmb|214|O|1'] = COV_214
  })

  it('returns fixed-only fallback at a special-only stop', () => {
    const result = getScheduleForVariant(index, 'kmb|214|O|1', date('2026-10-16T10:00:00'), 'POTAT')
    expect(result?.headwayMin).toBeNull()
    expect(result?.headwayRange).toBeNull()
    expect(result?.departures).toBeNull()
    expect(result?.departureGroups).toEqual([
      { origin: 'PO TAT BUS TERMINUS', departures: [405, 415] },
    ])
    expect(result?.special).toBeNull()
    expect(result?.first).toBe('06:45')
    expect(result?.last).toBe('06:55')
  })

  it('returns null when the stop has no service that day', () => {
    index.variants['kmb|214|O|1'] = {
      src: ['8354', '8496'],
      span: { weekday: ['0520', '2330'] },
      headway: { weekday: [[320, 1410, 12]] },
      special: [{ src: '8496', origin: 'PO TAT BUS TERMINUS', departures: { saturday: [405] } }],
      freqSrc: [0],
      stopCov: { POTAT: [1] },
    }
    const result = getScheduleForVariant(index, 'kmb|214|O|1', date('2026-10-16T10:00:00'), 'POTAT')
    expect(result).toBeNull()
  })
})
