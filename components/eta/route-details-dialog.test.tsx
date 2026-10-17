'use client'

import { describe, expect, it } from 'vitest'

import { render } from '@/lib/test-utils'
import {
  spanHhmmToDisplay,
  SpecialDeparturesLine,
  DepartureChips,
  TimetableTable,
} from '@/components/eta/route-details-dialog'
import { minsToDisplay } from '@/lib/eta/format'
import type { VariantSchedule } from '@/lib/eta/headway/types'

describe('minsToDisplay', () => {
  it('formats minutes since midnight as HH:MM', () => {
    expect(minsToDisplay(335)).toBe('05:35')
    expect(minsToDisplay(0)).toBe('00:00')
  })

  it('wraps after-midnight windows past 1440', () => {
    expect(minsToDisplay(1470)).toBe('00:30')
  })
})

describe('spanHhmmToDisplay', () => {
  it('inserts a colon into HHMM spans', () => {
    expect(spanHhmmToDisplay('0535')).toBe('05:35')
    expect(spanHhmmToDisplay('805')).toBe('08:05')
  })

  it('passes through non-numeric input', () => {
    expect(spanHhmmToDisplay('—')).toBe('—')
  })
})

const SCHEDULE: VariantSchedule = {
  src: ['1001'],
  span: { weekday: ['0535', '2305'] },
  headway: {
    weekday: [
      [335, 425, 9],
      [425, 540, 6],
    ],
  },
}

describe('TimetableTable', () => {
  it('renders first/last plus one row per headway window', () => {
    const { getAllByText, getByText } = render(
      <TimetableTable schedule={SCHEDULE} dayType="weekday" lang="en" />
    )
    expect(getByText('05:35')).not.toBeNull()
    expect(getByText('23:05')).not.toBeNull()
    expect(getAllByText('05:35–07:05').length).toBeGreaterThanOrEqual(1)
    expect(getByText('Every ~9 min')).not.toBeNull()
    expect(getByText('07:05–09:00')).not.toBeNull()
  })

  it('shows no data when the day-type headway table is missing', () => {
    const { getByText } = render(<TimetableTable schedule={SCHEDULE} dayType="sunday" lang="en" />)
    expect(getByText('No timetable available')).not.toBeNull()
  })

  it('shows the empty state when neither windows, departures, nor span exist', () => {
    const empty: VariantSchedule = { src: ['x'], span: {} }
    const { getByText } = render(<TimetableTable schedule={empty} dayType="weekday" lang="en" />)
    expect(getByText('No timetable available')).not.toBeNull()
  })

  it('renders fixed departure chips for span-only schedules', () => {
    const fixed: VariantSchedule = {
      src: ['8092'],
      span: { weekday: ['0645', '0710'] },
      departures: { weekday: [405, 410, 430] },
    }
    const { getAllByText, getByText } = render(
      <TimetableTable schedule={fixed} dayType="weekday" lang="en" />
    )
    // 06:45 / 07:10 appear in both the first/last row and the chips.
    expect(getAllByText('06:45').length).toBeGreaterThanOrEqual(2)
    expect(getByText('06:50')).not.toBeNull()
    expect(getAllByText('07:10').length).toBeGreaterThanOrEqual(2)
  })

  it('shows no data when the day-type departures table is missing', () => {
    const fixed: VariantSchedule = {
      src: ['8092'],
      span: { weekday: ['0645', '0710'] },
      departures: { weekday: [405, 430] },
    }
    const { getByText } = render(<TimetableTable schedule={fixed} dayType="sunday" lang="en" />)
    expect(getByText('No timetable available')).not.toBeNull()
  })

  it('renders special departures with origin alongside frequency windows', () => {
    const mixed: VariantSchedule = {
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
    }
    const { getByText } = render(<TimetableTable schedule={mixed} dayType="weekday" lang="en" />)
    expect(getByText('Special departures')).not.toBeNull()
    expect(getByText('PO TAT BUS TERMINUS')).not.toBeNull()
    expect(getByText('06:45')).not.toBeNull()
    expect(getByText('06:55')).not.toBeNull()
    // Frequency rows still render.
    expect(getByText('Every ~12 min')).not.toBeNull()
  })

  it('hides the special section when no table covers the day even via fallback', () => {
    const mixed: VariantSchedule = {
      src: ['8354', '8496'],
      span: { weekday: ['0520', '2330'] },
      headway: { weekday: [[320, 1410, 12]] },
      special: [{ src: '8496', origin: 'PO TAT BUS TERMINUS', departures: { saturday: [405] } }],
    }
    const { queryByText } = render(<TimetableTable schedule={mixed} dayType="sunday" lang="en" />)
    expect(queryByText('Special departures')).toBeNull()
  })

  it('shows only specials without frequencies at a special-only stop', () => {
    const mixed: VariantSchedule = {
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
      freqSrc: [0],
      stopCov: { POTAT: [1] },
    }
    const { getAllByText, getByText, queryByText } = render(
      <TimetableTable schedule={mixed} dayType="weekday" lang="en" stopId="POTAT" />
    )
    expect(getAllByText('06:45').length).toBeGreaterThanOrEqual(2)
    expect(getAllByText('06:55').length).toBeGreaterThanOrEqual(2)
    expect(getByText('PO TAT BUS TERMINUS')).not.toBeNull()
    expect(queryByText('Every ~12 min')).toBeNull()
    expect(queryByText('Special departures')).toBeNull()
  })

  it('splits span-only departures into per-pattern groups', () => {
    const split: VariantSchedule = {
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
    const { getAllByText, getByText, queryByText } = render(
      <TimetableTable schedule={split} dayType="weekday" lang="en" />
    )
    expect(getByText('LAM WAH STREET PLAYGROUND')).not.toBeNull()
    expect(getByText('LUNG MUN OASIS BUS TERMINUS')).not.toBeNull()
    expect(getAllByText('07:00').length).toBeGreaterThanOrEqual(2)
    expect(getByText('17:25')).not.toBeNull()
    expect(queryByText('Special departures')).toBeNull()
  })

  it('keeps frequencies at a fully covered stop', () => {
    const mixed: VariantSchedule = {
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
      freqSrc: [0],
      stopCov: { POTAT: [1] },
    }
    const { getByText } = render(
      <TimetableTable schedule={mixed} dayType="weekday" lang="en" stopId="OTHER" />
    )
    expect(getByText('Every ~12 min')).not.toBeNull()
    expect(getByText('Special departures')).not.toBeNull()
  })
})

describe('SpecialDeparturesLine', () => {
  it('renders origin plus chips and caps overflow with +N', () => {
    const { getByText } = render(
      <SpecialDeparturesLine
        special={[
          { origin: 'PO TAT BUS TERMINUS', departures: [405, 415, 420, 425, 430, 435, 440] },
        ]}
        lang="en"
      />
    )
    expect(getByText('PO TAT BUS TERMINUS')).not.toBeNull()
    expect(getByText('06:45')).not.toBeNull()
    expect(getByText('+1')).not.toBeNull()
  })

  it('renders nothing for an empty list', () => {
    const { container } = render(<SpecialDeparturesLine special={[]} lang="en" />)
    expect(container.textContent).toBe('')
  })
})

describe('DepartureChips', () => {
  it('renders every chip without a cap', () => {
    const { getByText } = render(<DepartureChips departures={[405, 415, 430]} lang="en" />)
    expect(getByText('06:45')).not.toBeNull()
    expect(getByText('06:55')).not.toBeNull()
    expect(getByText('07:10')).not.toBeNull()
  })

  it('caps chips and folds the rest into +N', () => {
    const departures = Array.from({ length: 15 }, (_, i) => 400 + i * 5)
    const { getByText, queryByText } = render(
      <DepartureChips departures={departures} lang="en" cap={12} />
    )
    expect(getByText('06:40')).not.toBeNull()
    expect(getByText('+3')).not.toBeNull()
    expect(queryByText('07:50')).toBeNull()
  })
})

describe('TimetableTable now highlight', () => {
  it('marks the row covering the current time with a Now chip', () => {
    const { getAllByText, getByText } = render(
      <TimetableTable
        schedule={SCHEDULE}
        dayType="weekday"
        lang="en"
        isToday
        now={new Date('2026-10-16T07:30:00')}
      />
    )
    expect(getByText('Now')).not.toBeNull()
    const activeRow = getAllByText('07:05–09:00')[0]?.closest('li')
    expect(activeRow?.getAttribute('aria-current')).toBe('time')
    const idleRow = getAllByText('05:35–07:05')[0]?.closest('li')
    expect(idleRow?.getAttribute('aria-current')).toBeNull()
  })

  it('marks nothing when now falls outside every window', () => {
    const { queryByText } = render(
      <TimetableTable
        schedule={SCHEDULE}
        dayType="weekday"
        lang="en"
        isToday
        now={new Date('2026-10-16T04:00:00')}
      />
    )
    expect(queryByText('Now')).toBeNull()
  })

  it('marks nothing when isToday is not set', () => {
    const { queryByText } = render(
      <TimetableTable
        schedule={SCHEDULE}
        dayType="weekday"
        lang="en"
        now={new Date('2026-10-16T07:30:00')}
      />
    )
    expect(queryByText('Now')).toBeNull()
  })

  it('shows no data when today has no windows of its own', () => {
    const { getByText, queryByText } = render(
      <TimetableTable
        schedule={SCHEDULE}
        dayType="sunday"
        lang="en"
        isToday
        now={new Date('2026-10-16T07:30:00')}
      />
    )
    expect(getByText('No timetable available')).not.toBeNull()
    expect(queryByText('Now')).toBeNull()
  })
})
